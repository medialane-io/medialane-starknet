"use client";

import { TransferDialog as TransferDialogView } from "@medialane/ui";
import { resolveImage } from "@/lib/utils";
import { useTransfer } from "@/hooks/use-transfer";

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractAddress: string;
  tokenId: string;
  tokenName?: string;
  tokenImage?: string | null;
  tokenStandard?: "ERC721" | "ERC1155";
  onSuccess?: () => void;
  hasActiveListing?: boolean;
}

export function TransferDialog({
  open,
  onOpenChange,
  contractAddress,
  tokenId,
  tokenName,
  tokenImage,
  tokenStandard,
  onSuccess,
  hasActiveListing,
}: TransferDialogProps) {
  const { transferToken, walletAddress, phase, txHash, error, resetState } = useTransfer();

  return (
    <TransferDialogView
      open={open}
      onOpenChange={onOpenChange}
      tokenId={tokenId}
      tokenName={tokenName}
      tokenImage={resolveImage(tokenImage)}
      hasActiveListing={hasActiveListing}
      walletAddress={walletAddress}
      canTransfer={!!walletAddress}
      connectLabel="Connect wallet to transfer"
      footerNote="Confirm in your wallet to complete the transfer."
      tx={{ phase, txHash, error, reset: resetState }}
      onTransfer={(toAddress) => {
        void transferToken({ contractAddress, tokenId, toAddress, tokenStandard });
      }}
      onSuccess={onSuccess}
    />
  );
}
