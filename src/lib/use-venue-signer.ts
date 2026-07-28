import { useCallback } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import type { Call, TypedData } from "starknet";
import type { StarknetVenueSigner } from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { markMarketplaceDebug } from "@/lib/marketplace-debug";
import { withTimeout } from "@/lib/wallet-error";

// Bounded so a stuck flow fails visibly instead of hanging `isProcessing`
// forever — long enough to cover a real PIN/passkey prompt.
const EXECUTE_TIMEOUT_MS = 45_000;

/**
 * The app's single implementation of the SDK's chain-neutral `VenueSigner`
 * — the ONE place marketplace signing/execution is resolved, over the
 * connected injected wallet (Ready/Braavos).
 *
 * It wraps the marketplace's existing execution pipeline exactly
 * (`account.execute`, then `waitForTransaction` + revert-detection), so the
 * collapse onto `StarknetVenue` changes no on-chain behavior. `execute`
 * awaits confirmation and throws on revert before resolving, so the SDK
 * adapter can treat a resolved `execute` as on-chain-and-final and safely
 * read the receipt (for the OrderCreated order id) afterwards.
 */
export function useVenueSigner(): StarknetVenueSigner | null {
  const { account } = useAccount();
  const { address } = useWallet();
  const { provider } = useProvider();

  const signTypedData = useCallback(
    async (data: TypedData): Promise<string[]> => {
      if (!account) throw new Error("Wallet not ready. Please reconnect and try again.");
      markMarketplaceDebug("signTypedData: awaiting wallet signature");
      const sig = await account.signMessage(data);
      markMarketplaceDebug("signTypedData: signature received");
      // starknet account returns [] or {r,s}
      return Array.isArray(sig) ? sig.map(String) : [String(sig.r), String(sig.s)];
    },
    [account],
  );

  const execute = useCallback(
    async (calls: Call[]): Promise<{ txHash: string }> => {
      if (!account) throw new Error("Wallet not ready. Please reconnect and try again.");
      markMarketplaceDebug("execute: awaiting wallet submit", { callCount: calls.length });
      const tx = await withTimeout(account.execute(calls), EXECUTE_TIMEOUT_MS, "Wallet");
      const txHash = tx.transaction_hash;
      markMarketplaceDebug("execute: wallet submitted, awaiting confirmation", { txHash });
      const receipt: any = await provider.waitForTransaction(txHash);
      markMarketplaceDebug("execute: confirmed", { status: receipt?.execution_status });
      if (receipt?.execution_status === "REVERTED") {
        throw new Error(receipt.revert_reason || "Transaction reverted on-chain. Check the explorer for details.");
      }
      return { txHash };
    },
    [account, provider],
  );

  if (!address) return null;
  return { address, signTypedData, execute };
}
