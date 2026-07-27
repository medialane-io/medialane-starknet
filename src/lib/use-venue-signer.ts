import { useCallback } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import type { Call, TypedData } from "starknet";
import type { StarknetVenueSigner } from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { useCartridgeWallet } from "@/contexts/cartridge-wallet-context";
import { markMarketplaceDebug } from "@/lib/marketplace-debug";
import { withTimeout } from "@/lib/wallet-error";
import { SUPPORTED_TOKENS } from "@/lib/constants";

// Long enough for a real Cartridge policy-approval or PIN/passkey prompt
// (mirrors the 20s used for connect, extended for the extra approval step
// a first-time per-collection action can require) — bounded so a stuck
// flow fails visibly instead of hanging `isProcessing` forever.
const EXECUTE_TIMEOUT_MS = 45_000;

// Compares Starknet addresses by value, not string — zero-padding varies
// between the SDK's constants and what a Call's contractAddress carries.
function sameAddress(a: string, b: string): boolean {
  try {
    return BigInt(a) === BigInt(b);
  } catch {
    return false;
  }
}

const PAYMENT_TOKEN_ADDRESSES = SUPPORTED_TOKENS.map((t) => t.address);

// A payment-token approve/set_approval_for_all is already covered by a
// connect-time Approval policy (PAYMENT_TOKEN_APPROVAL_CONTRACTS in
// cartridge-wallet-context.tsx — bounded spender+amount grants presented
// once, up front, alongside every other session policy). It needs no
// runtime ensureCartridgePolicy call here — that would try to grant it as a
// plain CallPolicy instead, which is both wrong (no amount bound) and
// redundant (already scoped via the proper Approval policy type).
function isPreGrantedPaymentApproval(call: Call): boolean {
  if (call.entrypoint !== "approve" && call.entrypoint !== "set_approval_for_all") return false;
  return PAYMENT_TOKEN_ADDRESSES.some((addr) => sameAddress(addr, call.contractAddress));
}

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
  const { wallet: szWalletRaw, ensureCartridgePolicy } = useCartridgeWallet();
  const { walletType, address } = useWallet();
  const { provider } = useProvider();

  // Active-wallet slot decides the rail — a bare `szWallet ?? account` priority
  // would let a lingering Cartridge session sign/execute for a different
  // wallet than the one the user explicitly connected.
  const szWallet = walletType === "cartridge" ? szWalletRaw : null;

  const signTypedData = useCallback(
    async (data: TypedData): Promise<string[]> => {
      const signer = szWallet ?? account;
      if (!signer) throw new Error("Wallet not ready. Please reconnect and try again.");
      markMarketplaceDebug("signTypedData: awaiting wallet signature", { rail: szWallet ? "cartridge" : "injected" });
      const sig = await signer.signMessage(data);
      markMarketplaceDebug("signTypedData: signature received");
      // starknet account returns [] or {r,s}; StarkZap returns string[].
      return Array.isArray(sig) ? sig.map(String) : [String(sig.r), String(sig.s)];
    },
    [szWallet, account],
  );

  const execute = useCallback(
    async (calls: Call[]): Promise<{ txHash: string }> => {
      let txHash: string;
      if (szWallet) {
        // Every call must be session-scoped before execute() — the silent
        // session-key path has no UI fallback for an out-of-policy call, it
        // just hangs (confirmed repeatedly). Payment-token approvals are
        // already covered by a connect-time Approval policy — nothing to do
        // here. Everything else (register_order, a collection's own
        // approve, etc.) gets a plain target+method CallPolicy, requested
        // just-in-time since per-instance contract addresses can't be
        // enumerated ahead of time the way payment tokens can.
        for (const call of calls) {
          if (isPreGrantedPaymentApproval(call)) continue;
          markMarketplaceDebug("execute: ensuring Cartridge policy", { target: call.contractAddress, method: call.entrypoint });
          await withTimeout(
            ensureCartridgePolicy(call.contractAddress, call.entrypoint),
            EXECUTE_TIMEOUT_MS,
            "Cartridge approval",
          );
        }
        markMarketplaceDebug("execute: awaiting wallet submit", { rail: "cartridge", callCount: calls.length });
        const tx = await withTimeout(szWallet.execute(calls), EXECUTE_TIMEOUT_MS, "Cartridge wallet");
        txHash = tx.hash;
      } else {
        if (!account) throw new Error("Wallet not ready. Please reconnect and try again.");
        markMarketplaceDebug("execute: awaiting wallet submit", { rail: "injected", callCount: calls.length });
        const tx = await withTimeout(account.execute(calls), EXECUTE_TIMEOUT_MS, "Wallet");
        txHash = tx.transaction_hash;
      }
      markMarketplaceDebug("execute: wallet submitted, awaiting confirmation", { txHash });
      const receipt: any = await provider.waitForTransaction(txHash);
      markMarketplaceDebug("execute: confirmed", { status: receipt?.execution_status });
      if (receipt?.execution_status === "REVERTED") {
        throw new Error(receipt.revert_reason || "Transaction reverted on-chain. Check the explorer for details.");
      }
      return { txHash };
    },
    [szWallet, account, provider, ensureCartridgePolicy],
  );

  if (!address) return null;
  return { address, signTypedData, execute };
}
