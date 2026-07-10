import { useCallback } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import type { Call, TypedData } from "starknet";
import type { StarknetVenueSigner } from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";

/**
 * The app's single implementation of the SDK's chain-neutral `VenueSigner`. This
 * is the ONE place the slot-gated `szWallet ?? account` execution rule lives (per
 * CLAUDE.md's "any new hook that resolves a signer/executor must use this
 * slot-gated pattern") — the marketplace hook no longer re-threads it.
 *
 * It wraps the marketplace's existing execution pipeline exactly (raw
 * `szWallet.execute ?? account.execute`, then `waitForTransaction` +
 * revert-detection), so the collapse onto `StarknetVenue` changes no on-chain
 * behavior. `execute` awaits confirmation and throws on revert before resolving,
 * so the SDK adapter can treat a resolved `execute` as on-chain-and-final and
 * safely read the receipt (for the OrderCreated order id) afterwards.
 */
export function useVenueSigner(): StarknetVenueSigner | null {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, address } = useWallet();
  const { provider } = useProvider();

  // Active-wallet slot decides the rail — a bare `szWallet ?? account` priority
  // would let a lingering Cartridge/Privy session sign/execute for a different
  // wallet than the one the user explicitly connected.
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;

  const signTypedData = useCallback(
    async (data: TypedData): Promise<string[]> => {
      const signer = szWallet ?? account;
      if (!signer) throw new Error("Wallet not ready. Please reconnect and try again.");
      const sig = await signer.signMessage(data);
      // starknet account returns [] or {r,s}; StarkZap returns string[].
      return Array.isArray(sig) ? sig.map(String) : [String(sig.r), String(sig.s)];
    },
    [szWallet, account],
  );

  const execute = useCallback(
    async (calls: Call[]): Promise<{ txHash: string }> => {
      let txHash: string;
      if (szWallet) {
        const tx = await szWallet.execute(calls);
        txHash = tx.hash;
      } else {
        if (!account) throw new Error("Wallet not ready. Please reconnect and try again.");
        const tx = await account.execute(calls);
        txHash = tx.transaction_hash;
      }
      const receipt: any = await provider.waitForTransaction(txHash);
      if (receipt?.execution_status === "REVERTED") {
        throw new Error(receipt.revert_reason || "Transaction reverted on-chain. Check the explorer for details.");
      }
      return { txHash };
    },
    [szWallet, account, provider],
  );

  if (!address) return null;
  return { address, signTypedData, execute };
}
