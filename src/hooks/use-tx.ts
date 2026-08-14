"use client";

import { useState, useCallback } from "react";
import type { Call } from "starknet";
import { starknetProvider } from "@/lib/starknet";
import { useSigner } from "@/hooks/use-signer";
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
  const account = useSigner();

  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const execute = useCallback(async (calls: Call[]): Promise<string | null> => {
    setStatus("submitting");
    setStatusMessage("Submitting transaction…");
    setError(null);
    try {
      if (!account) {
        throw new Error("Wallet not connected");
      }
      const tx = await account.execute(calls);
      const hash = tx.transaction_hash;

      setTxHash(hash);
      setStatus("confirming");
      setStatusMessage("Confirming on Starknet…");

      try {
        const receipt = await starknetProvider.waitForTransaction(hash, {
          retryInterval: 3000,
        });
        if (receipt.isReverted()) {
          const reason: string = receipt.value.revert_reason ?? "Transaction reverted";
          setStatus("reverted");
          setError(reason);
          setStatusMessage(reason);

          return null;
        }
        setStatus("confirmed");
        setStatusMessage("Transaction confirmed");
        return hash;
      } catch (waitErr) {

        const reason =
          waitErr instanceof Error
            ? waitErr.message
            : "Couldn't verify on-chain status";
        setStatus("submitted");
        setStatusMessage("Submitted — confirmation pending. Check the explorer.");
        setError(null);

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
  }, [account]);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setError(null);
    setStatusMessage("");
  }, []);

  return { execute, status, txHash, error, statusMessage, reset };
}
