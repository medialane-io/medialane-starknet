"use client";
/**
 * Transaction execution adapter for connected wallets. Injected wallets execute
 * directly through account.execute(); StarkZap Cartridge wallets use their
 * session wallet execution.
 *
 * Status progression:
 *   idle → submitting → confirming → confirmed (success path)
 *                                  → reverted   (on-chain revert)
 *                                  → submitted  (RPC polling failed; tx may
 *                                                still confirm — check explorer)
 *                                  → error      (couldn't even submit)
 *
 * Return value:
 *   - txHash string + status "confirmed" → on-chain success
 *   - txHash string + status "submitted" → submitted, outcome unknown
 *   - null + status "reverted"           → on-chain revert
 *   - null + status "error"              → submission failure
 *
 * Consumers MUST check `status` (not just the return value) to distinguish
 * "confirmed" from "submitted". The previous implementation set status to
 * "confirmed" the moment the wallet returned a hash — before any on-chain
 * confirmation — which lied to the user on every revert.
 *
 * Usage:
 *   const { execute, status, txHash, error, statusMessage, reset } = useTx();
 *   const hash = await execute(calls);
 */
import { useState, useCallback } from "react";
import type { Call } from "starknet";
import { useAccount } from "@starknet-react/core";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { starknetProvider } from "@/lib/starknet";
import { getFriendlyWalletError } from "@/lib/wallet-error";

export type TxStatus =
  | "idle"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "submitted"
  | "reverted"
  | "error";

export function useTx() {
  const { account } = useAccount();
  // Gate the StarkZap wallet on the active-wallet slot — a lingering
  // Cartridge/Privy session must not execute for an injected user.
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;

  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const execute = useCallback(async (calls: Call[]): Promise<string | null> => {
    setStatus("submitting");
    setStatusMessage("Submitting transaction…");
    setError(null);
    try {
      let hash: string;

      // StarkZap (Cartridge) manages gas via session keys
      if (szWallet) {
        const tx = await szWallet.execute(calls);
        hash = tx.hash;
      } else if (!account) {
        throw new Error("Wallet not connected");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = await account.execute(calls as any);
        hash = tx.transaction_hash;
      }

      // Submission succeeded — now wait for on-chain finality. Without this
      // step the hook used to return "confirmed" the moment the wallet
      // handed back a hash, which is just submission, not confirmation.
      // Reverts on-chain would be silently reported as success.
      setTxHash(hash);
      setStatus("confirming");
      setStatusMessage("Confirming on Starknet…");

      try {
        const receipt = await starknetProvider.waitForTransaction(hash, {
          retryInterval: 3000,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = receipt as any;
        const executionStatus: string | undefined =
          r?.execution_status ?? r?.status;
        const isReverted =
          executionStatus === "REVERTED" ||
          executionStatus === "REJECTED" ||
          Boolean(r?.revert_reason);
        if (isReverted) {
          const reason: string =
            r?.revert_reason ?? `Transaction reverted (${executionStatus ?? "unknown"})`;
          setStatus("reverted");
          setError(reason);
          setStatusMessage(reason);
          // Returning null preserves the existing contract with consumers
          // that check `if (result === null) throw ...` — they now correctly
          // fire on reverts instead of believing the lie.
          return null;
        }
        setStatus("confirmed");
        setStatusMessage("Transaction confirmed");
        return hash;
      } catch (waitErr) {
        // Receipt polling failed (RPC blip / timeout / non-JSON upstream).
        // The tx may still confirm — we just couldn't verify it from here.
        // Report "submitted" so the user can check the explorer, and return
        // the hash so consumers that surface tx links still work.
        const reason =
          waitErr instanceof Error
            ? waitErr.message
            : "Couldn't verify on-chain status";
        setStatus("submitted");
        setStatusMessage("Submitted — confirmation pending. Check the explorer.");
        setError(null); // not actually an error from the user's perspective
        // Surface the polling reason in a console warn so we have a trace.
        console.warn("[useTx] receipt polling failed", { hash, reason });
        return hash;
      }
    } catch (err) {
      console.error("[useTx] error:", err);
      const msg = getFriendlyWalletError(err).message;
      setError(msg);
      setStatus("error");
      setStatusMessage(msg);
      return null;
    }
  }, [account, szWallet]);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setError(null);
    setStatusMessage("");
  }, []);

  return { execute, status, txHash, error, statusMessage, reset };
}
