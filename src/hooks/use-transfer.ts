"use client";

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { useWallet } from "@/hooks/use-wallet";
import { INDEXER_REVALIDATION_DELAY_MS } from "@/lib/constants";
import type { Call } from "starknet";

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

export function encodeTokenId(tokenId: string): [string, string] {
  const id = BigInt(tokenId);
  const low = (id & BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toString();
  const high = (id >> BigInt(128)).toString();
  return [low, high];
}

export function useTransfer() {
  const { address, isConnected, execute } = useWallet();
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

        const [tokenIdLow, tokenIdHigh] = encodeTokenId(input.tokenId);

        const isERC1155 = input.tokenStandard === "ERC1155";
        const call: Call = isERC1155
          ? {
              contractAddress: input.contractAddress,
              entrypoint: "safe_transfer_from",
              calldata: [address, input.toAddress, tokenIdLow, tokenIdHigh, "1", "0", "0"],
            }
          : {
              contractAddress: input.contractAddress,
              entrypoint: "transfer_from",
              calldata: [address, input.toAddress, tokenIdLow, tokenIdHigh],
            };

        const hash = await execute([call]);
        setTxHash(hash);
        setTxStatus("confirmed");

        invalidate();
        setTimeout(() => invalidate(), INDEXER_REVALIDATION_DELAY_MS);
        return hash;
      } catch (err: unknown) {
        const friendly = getFriendlyWalletError(err);
        setError(friendly.message);
        setTxStatus("failed");
        if (friendly.isUserRejection) {
          toast.info(friendly.title, { description: friendly.description });
        } else {
          toast.error(friendly.title, { description: friendly.message });
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [address, execute, invalidate]
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
