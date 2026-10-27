import { useCallback } from "react";
import type { Call, TypedData } from "starknet";
import type { StarknetVenueSigner } from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { useSigner } from "@/hooks/use-signer";
import { markMarketplaceDebug } from "@/lib/marketplace-debug";

export function useVenueSigner(): StarknetVenueSigner | null {
  const account = useSigner();
  const { address } = useWallet();

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
      if (!account || !address) throw new Error("Wallet not ready. Please reconnect and try again.");
      markMarketplaceDebug("execute: awaiting wallet submit", { callCount: calls.length });
      const txHash = (await account.execute(calls)).transaction_hash;
      markMarketplaceDebug("execute: wallet submitted", { txHash });
      return { txHash };
    },
    [account, address],
  );

  if (!address) return null;
  return { address, signTypedData, execute };
}
