"use client";
/**
 * Transaction execution adapter for connected wallets. Injected wallets execute
 * directly through account.execute(); StarkZap Cartridge wallets use their
 * session wallet execution.
 *
 * Usage:
 *   const { execute, status, txHash, error, statusMessage, reset } = useTx();
 *   const hash = await execute(calls);
 */
import { useState, useCallback } from "react";
import type { Call } from "starknet";
import { useAccount } from "@starknet-react/core";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";

export type TxStatus =
  | "idle"
  | "submitting"
  | "confirming"
  | "confirmed"
  | "reverted"
  | "error";

export function useTx() {
  const { account } = useAccount();
  const { wallet: szWallet } = useStarkZapWallet();

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

      setTxHash(hash);
      setStatus("confirmed");
      setStatusMessage("Transaction confirmed");
      return hash;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
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
