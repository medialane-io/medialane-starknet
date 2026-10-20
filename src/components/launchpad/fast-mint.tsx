"use client";

import { FastMint as SharedFastMint, type FastMintProps as SharedFastMintProps, useCollectionsByOwner, useMedialaneClient } from "@medialane/ui";

import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";
import { useAccountSession } from "@/components/wallet-session-sync";

import { useVenueSigner } from "@/lib/use-venue-signer";
import { RewardEarned } from "@/lib/reward-earned";
import { invalidatePortfolioCache } from "@/lib/portfolio-cache";

export interface FastMintProps {
  presentation?: "inline" | "dialog";
  open?: boolean;
  onClose?: () => void;

  mediaKindLock?: SharedFastMintProps["mediaKindLock"];
  onMinted?: SharedFastMintProps["onMinted"];
}

export function FastMint({ presentation = "inline", open = true, onClose, mediaKindLock, onMinted }: FastMintProps = {}) {
  const { isConnected, address: walletAddress } = useWallet();
  const { open: openConnectDialog } = useConnectDialog();
  const { signedIn } = useAccountSession();
  const client = useMedialaneClient();
  const { collections, mutate } = useCollectionsByOwner(walletAddress ?? null);
  const venueSigner = useVenueSigner();

  return (
    <SharedFastMint
      successFooter={<RewardEarned actionType="mint_asset" />}
      presentation={presentation}
      open={open}
      onClose={onClose}
      mediaKindLock={mediaKindLock}
      onMinted={(asset) => {
        if (walletAddress) invalidatePortfolioCache(walletAddress);
        onMinted?.(asset);
      }}
      collections={collections}
      refetchCollections={async () => {
        const res = await mutate();
        return res?.data ?? collections;
      }}
      hasWallet={isConnected}
      walletAddress={walletAddress}
      onRequireWallet={openConnectDialog}
      connectLabel="Connect wallet"
      getUploadToken={async () => ((await signedIn()) ? "signed-in" : null)}
      getSigner={() => {
        if (!venueSigner) throw new Error("Wallet not ready. Please reconnect and try again.");
        return venueSigner;
      }}
      client={client}
    />
  );
}
