"use client";

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { INDEXER_REVALIDATION_DELAY_MS } from "@/lib/constants";
import type { Call } from "starknet";

export interface TransferInput {
  contractAddress: string; // NFT contract address
  tokenId: string;         // Token ID — decimal ("42") or hex ("0x2a")
  toAddress: string;       // Recipient Starknet address
  /** ERC-721 uses `transfer_from(from, to, id)`; ERC-1155 needs
   *  `safe_transfer_from(from, to, id, value, data)`. Without this hint,
   *  ERC-1155 transfers silently failed with the wrong entrypoint. */
  tokenStandard?: "ERC721" | "ERC1155";
}

/** Returns true if addr is a valid non-zero Starknet address. */
function isValidStarknetAddress(addr: string): boolean {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(addr)) return false;
  // Reject 0x0 (and any all-zeros padding).
  return addr.replace(/^0x0*/, "").length > 0;
}

/**
 * Encode a token ID (decimal or hex string) into two felt252 values
 * for Starknet u256 calldata: [low_128_bits, high_128_bits].
 */
export function encodeTokenId(tokenId: string): [string, string] {
  const id = BigInt(tokenId);
  const low = (id & BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toString();
  const high = (id >> BigInt(128)).toString();
  return [low, high];
}

export function useTransfer() {
  const { address, isConnected, execute } = useUnifiedWallet();
  const { mutate } = useSWRConfig();

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "submitting" | "confirmed" | "failed">("idle");

  const invalidate = useCallback(() => {
    // Filter-only mutate: revalidate matching keys WITHOUT clearing their data.
    // Passing `undefined` would wipe the `token-<contract>-<id>` cache the asset
    // page reads, flipping it into its loading skeleton — which unmounts the
    // transfer dialog and destroys its success state before it can show. See the
    // same fix in use-marketplace's invalidateMarketplaceCaches.
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
        // Defensive validation — Zod on the dialog form catches most cases,
        // but useTransfer is callable from anywhere; protect the calldata
        // builder from malformed input.
        if (!isValidStarknetAddress(input.toAddress)) {
          throw new Error("Invalid recipient address.");
        }
        if (!isValidStarknetAddress(input.contractAddress)) {
          throw new Error("Invalid token contract address.");
        }

        const [tokenIdLow, tokenIdHigh] = encodeTokenId(input.tokenId);

        // Branch on token standard. ERC-721 uses transfer_from(from, to, id);
        // ERC-1155 uses safe_transfer_from(from, to, id, value, data). The
        // value defaults to 1 (single-unit transfer) and data is an empty
        // Array<felt252> (`[0]` for length=0). Without this branch every
        // ERC-1155 transfer fired the wrong entrypoint and silently failed.
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
