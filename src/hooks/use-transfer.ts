"use client";

import { useCallback } from "react";
import { useMedialaneClient } from "@medialane/ui";
import { executeIntent } from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { useWriteState } from "@/hooks/use-write-state";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { invalidateTokens } from "@/lib/cache";

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
  const { address } = useWallet();
  const signer = useVenueSigner();
  const { isProcessing, txHash, setTxHash, error, isConfirmed, run, resetState } = useWriteState();

  const transferToken = useCallback(
    (input: TransferInput) =>
      run(
        async () => {
          if (!signer) throw new Error("Wallet not connected.");
          if (!isValidStarknetAddress(input.toAddress)) {
            throw new Error("Invalid recipient address.");
          }
          if (!isValidStarknetAddress(input.contractAddress)) {
            throw new Error("Invalid token contract address.");
          }

          const intent = await client.api.intents.create("transfer-nft", {
            owner: signer.address,
            contractAddress: input.contractAddress,
            tokenId: input.tokenId,
            recipient: input.toAddress,
            tokenStandard: input.tokenStandard === "ERC1155" ? "ERC1155" : "ERC721",
          });
          const { txHash: hash } = await executeIntent(signer, client, intent);
          setTxHash(hash);
          invalidateTokens();
          return hash;
        },
        (err) => console.error("transfer failed", err),
      ),
    [signer, client, run, setTxHash],
  );

  return {
    transferToken,
    walletAddress: address,
    isProcessing,
    isConfirmed,
    txHash,
    error,
    resetState,
  };
}
