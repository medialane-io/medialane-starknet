import { useCallback } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import type { Call, TypedData } from "starknet";
import type { StarknetVenueSigner } from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
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

// Fund-moving ERC-20 `approve` calls (payment tokens: USDC/USDT/ETH/STRK/WBTC)
// must NEVER be added to Cartridge session scope — a session key with a
// standing approve grant over a payment token is a real privilege-escalation
// risk, not just a UX nuance (same precedent CARTRIDGE_POLICIES documents for
// the checkout/accept-offer/creator-coin flows: these stay a per-tx prompt).
// Only per-instance NON-fungible contracts (a specific collection's `approve`
// on a listing, etc.) are safe to extend session scope for.
function isSessionScopable(call: Call): boolean {
  if (call.entrypoint !== "approve" && call.entrypoint !== "set_approval_for_all") return true;
  return !PAYMENT_TOKEN_ADDRESSES.some((addr) => sameAddress(addr, call.contractAddress));
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
  const { wallet: szWalletRaw, ensureCartridgePolicy, executeViaCartridgeModal } = useStarkZapWallet();
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
        if (calls.some((call) => !isSessionScopable(call))) {
          // Contains a fund-moving call (a payment-token approve) that must
          // never be session-scoped. Cartridge's silent session-key execute()
          // has NO UI fallback for a call outside session policy — it just
          // waits on a signature the session key structurally cannot
          // produce, forever (confirmed: signing works and shows its own
          // modal fine, but execute() never shows anything and times out).
          // openExecute() is Cartridge's actual mechanism for an explicit,
          // one-off confirmation. Bounded (90s) inside executeViaCartridgeModal
          // itself, so a failure is always visible instead of hanging forever.
          markMarketplaceDebug("execute: awaiting Cartridge confirmation modal", { rail: "cartridge", callCount: calls.length, calls });
          const tx = await executeViaCartridgeModal(calls);
          txHash = tx.txHash;
        } else {
          // Every call here is already covered, or can be silently extended
          // via session policy — per-instance contracts (a specific
          // collection's `approve`, etc.) are never in the static
          // CARTRIDGE_POLICIES allowlist by construction, so request scope
          // just-in-time instead of letting execute() hang on an approval
          // the app never asked Cartridge for.
          for (const call of calls) {
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
        }
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
    [szWallet, account, provider, ensureCartridgePolicy, executeViaCartridgeModal],
  );

  if (!address) return null;
  return { address, signTypedData, execute };
}
