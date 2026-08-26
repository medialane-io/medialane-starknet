"use client";

import { FastMint as SharedFastMint, type FastMintProps as SharedFastMintProps } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { useMedialaneClient } from "@/hooks/use-medialane-client";
import { useCollectionsByOwner } from "@/hooks/use-collections";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { rewardToast } from "@/lib/reward-toast";
import { invalidatePortfolioCache } from "@/lib/portfolio-cache";
import { starknetProvider } from "@/lib/starknet";

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
  const { getValidToken } = useSiwsToken();
  const client = useMedialaneClient();
  const { collections, mutate } = useCollectionsByOwner(walletAddress ?? null);
  const venueSigner = useVenueSigner();

  return (
    <SharedFastMint
      presentation={presentation}
      open={open}
      onClose={onClose}
      mediaKindLock={mediaKindLock}
      onMinted={(asset) => {
        rewardToast("mint_asset");
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
      getUploadToken={getValidToken}
      getSigner={() => {
        if (!venueSigner) throw new Error("Wallet not ready. Please reconnect and try again.");
        return venueSigner;
      }}
      client={client}
      provider={starknetProvider}
    />
  );
}
