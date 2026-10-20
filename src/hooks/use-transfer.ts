"use client";

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { describeError, useMedialaneClient } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useIntentExecute } from "@/hooks/use-intent-execute";
import { syncTransactionBestEffort } from "@medialane/sdk/starknet";

export interface TransferInput {
  contractAddress: string;
  tokenId: string;
  toAddress: string;

  tokenStandard?: "ERC721" | "ERC1155";
}

function isValidStarknetAddress(addr: string): boolean {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(addr)) return false;

  return addr.replace(/^0x0*/, "").length > 0;
}

export function useTransfer() {
  const client = useMedialaneClient();
  const { address, isConnected } = useWallet();
  const runIntent = useIntentExecute();
  const { mutate } = useSWRConfig();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "submitting" | "confirmed" | "failed">("idle");

  const invalidate = useCallback(() => {

    mutate(
      (key) => {
        if (typeof key !== "string") return false;
        return key.startsWith("tokens-owned-") || key.startsWith("token-");
      }
    );
  }, [mutate]);

  const resetState = useCallback(() => {
    setIsProcessing(false);
    setError(null);
    setTxHash(null);
    setTxStatus("idle");
  }, []);

  const transferToken = useCallback(
    async (input: TransferInput) => {
      if (!address) throw new Error("Wallet not connected.");
      setIsProcessing(true);
      setError(null);
      setTxStatus("submitting");

      try {

        if (!isValidStarknetAddress(input.toAddress)) {
          throw new Error("Invalid recipient address.");
        }
        if (!isValidStarknetAddress(input.contractAddress)) {
          throw new Error("Invalid token contract address.");
        }

        const hash = await runIntent(() =>
          client.api.createTransferNftIntent({
            owner: address,
            contractAddress: input.contractAddress,
            tokenId: input.tokenId,
            recipient: input.toAddress,
            tokenStandard: input.tokenStandard === "ERC1155" ? "ERC1155" : "ERC721",
          }),
        );
        setTxHash(hash);
        setTxStatus("confirmed");

        await syncTransactionBestEffort(client, hash);
        invalidate();
        return hash;
      } catch (err: unknown) {
        const friendly = describeError(err);
        setError(friendly.message);
        setTxStatus("failed");
        console.error("transfer failed", err);
      } finally {
        setIsProcessing(false);
      }
    },
    [address, runIntent, invalidate, client]
  );

  return {
    transferToken,
    walletAddress: address ?? null,
    hasWallet: isConnected,
    isLoadingWallet: false,
    isProcessing,
    txStatus,
    txHash,
    error,
    resetState,
  };
}
