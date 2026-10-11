"use client";

import { useState, useCallback } from "react";
import type { Call, TypedData } from "starknet";
import { starknetProvider } from "@/lib/starknet";
import { useSigner } from "@/hooks/use-signer";
import { describeError } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { executeWithSponsorship } from "@/lib/sponsored-execute";

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
  const { address } = useWallet();
  const { getValidToken } = useSiwsToken();

  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const execute = useCallback(async (calls: Call[], opts?: { intentIds?: string[] }): Promise<string | null> => {
    setStatus("submitting");
    setStatusMessage("Submitting transaction…");
    setError(null);
    try {
      if (!account || !address) {
        throw new Error("Wallet not connected");
      }
      const { txHash: hash } = await executeWithSponsorship(
        {
          token: getValidToken,
          fallback: async (c) => ({ txHash: (await account.execute(c)).transaction_hash }),
        },
        {
          address,
          signTypedData: async (data: TypedData) => {
            const sig = await account.signMessage(data);
            return Array.isArray(sig) ? sig.map(String) : [String(sig.r), String(sig.s)];
          },
        },
        calls,
        opts?.intentIds,
      );

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
      const msg = describeError(err).message;
      setError(msg);
      setStatus("error");
      setStatusMessage(msg);
      return null;
    }
  }, [account, address, getValidToken]);

  const reset = useCallback(() => {
    setStatus("idle");
    setTxHash(null);
    setError(null);
    setStatusMessage("");
  }, []);

  return { execute, status, txHash, error, statusMessage, reset };
}
