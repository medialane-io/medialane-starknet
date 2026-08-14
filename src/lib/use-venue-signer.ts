import { useCallback } from "react";
import { useProvider } from "@starknet-react/core";
import type { Call, TypedData } from "starknet";
import type { StarknetVenueSigner } from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { useSigner } from "@/hooks/use-signer";
import { markMarketplaceDebug } from "@/lib/marketplace-debug";

export function useVenueSigner(): StarknetVenueSigner | null {
  const account = useSigner();
  const { address } = useWallet();
  const { provider } = useProvider();

  const signTypedData = useCallback(
    async (data: TypedData): Promise<string[]> => {
      if (!account) throw new Error("Wallet not ready. Please reconnect and try again.");
      markMarketplaceDebug("signTypedData: awaiting wallet signature");
      const sig = await account.signMessage(data);
      markMarketplaceDebug("signTypedData: signature received");

      return Array.isArray(sig) ? sig.map(String) : [String(sig.r), String(sig.s)];
    },
    [account],
  );

  const execute = useCallback(
    async (calls: Call[]): Promise<{ txHash: string }> => {
      if (!account) throw new Error("Wallet not ready. Please reconnect and try again.");
      markMarketplaceDebug("execute: awaiting wallet submit", { callCount: calls.length });
      const tx = await account.execute(calls);
      const txHash = tx.transaction_hash;
      markMarketplaceDebug("execute: wallet submitted, awaiting confirmation", { txHash });
      const receipt = await provider.waitForTransaction(txHash);
      markMarketplaceDebug("execute: confirmed", { status: receipt.statusReceipt });
      if (receipt.isReverted()) {
        throw new Error(receipt.value.revert_reason || "Transaction reverted on-chain. Check the explorer for details.");
      }
      return { txHash };
    },
    [account, provider],
  );

  if (!address) return null;
  return { address, signTypedData, execute };
}
