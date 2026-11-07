"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { ApproveMintDialog as ApproveMintDialogView, useMedialaneClient, describeError, useCollectionsByOwner, type TransactionPhase } from "@medialane/ui";
import { executeIntent, mintedTokenIdFromReceipt } from "@medialane/sdk/starknet";
import { useVenueSigner } from "@/lib/use-venue-signer";

import { useMarketplace } from "@/hooks/use-marketplace";

import { confirmRemixOffer } from "@/hooks/use-remix-offers";
import { useAccountSession } from "@/components/wallet-session-sync";
import { getService } from "@medialane/sdk";
import type { RemixOffer } from "@/types/remix-offers";
import { useConfetti } from "@medialane/ui/utils/use-confetti";
import { assetHref } from "@/lib/routes";
import { uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { pollUntil } from "@/lib/poll";

interface Props {
  offer: RemixOffer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

export function ApproveMintDialog({ offer, open, onOpenChange, onSuccess }: Props) {
  const { address: walletAddress } = useWallet();
  const { ensureSignedIn } = useAccountSession();
  const signer = useVenueSigner();
  const { createListing, error: listingError, resetState } = useMarketplace();
  const client = useMedialaneClient();

  const { collections } = useCollectionsByOwner(walletAddress ?? null);
  const eligibleCollections = collections.filter(
    (c) => getService(c.service)?.id === "mip-erc721" && c.collectionId != null
  );

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [newAssetLink, setNewAssetLink] = useState<string | null>(null);
  const [mintHash, setMintHash] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  useConfetti(done);

  const error = approveError ?? listingError;
  const phase: TransactionPhase = loading ? (mintHash ? "confirming" : "submitting") : done ? "success" : error ? "error" : "idle";

  const reset = () => {
    setDone(false);
    setNewAssetLink(null);
    setMintHash(null);
    setApproveError(null);
    resetState();
  };

  const handleApprove = async (selectedCollection: (typeof eligibleCollections)[number], effectiveName: string) => {
    if (!offer || !walletAddress || !selectedCollection.collectionId) return;
    setApproveError(null);
    setLoading(true);

    try {

      await ensureSignedIn();
      const royaltyStr = offer.royaltyPct != null ? `${offer.royaltyPct}%` : undefined;
      const metadata = {
        name: effectiveName,
        description: `Remix of Token #${offer.originalTokenId}`,
        image: "",
        attributes: [
          { trait_type: "Parent Contract", value: offer.originalContract },
          { trait_type: "Parent Token ID", value: offer.originalTokenId },
          { trait_type: "Remix Type", value: "Derivative" },
          { trait_type: "License", value: offer.licenseType },
          { trait_type: "Commercial Use", value: offer.commercial ? "Yes" : "No" },
          { trait_type: "Derivatives", value: offer.derivatives ? "Yes" : "No" },
          ...(royaltyStr ? [{ trait_type: "Royalty", value: royaltyStr }] : []),
          { trait_type: "Creator", value: walletAddress },
        ],
      };
      const pinnedUri = await uploadJsonToIpfs(metadata);

      const intentRes = await client.api.intents.create("mint", {
        owner: walletAddress,
        collectionId: selectedCollection.collectionId,
        recipient: walletAddress,
        tokenUri: pinnedUri,
        royaltyBps: 0,
      });
      if (!signer) throw new Error("Wallet not connected");
      const { txHash, receipt } = await executeIntent(signer, client, intentRes);
      setMintHash(txHash);

      const remixTokenId = mintedTokenIdFromReceipt(receipt, selectedCollection.contractAddress);
      if (!remixTokenId) throw new Error("Could not determine remix token ID");

      const listingHash = await createListing(
        selectedCollection.contractAddress,
        remixTokenId,
        offer.price?.raw ?? "0",
        offer.price?.currency ?? "STRK",
        30 * 24 * 60 * 60
      );
      if (!listingHash) return;

      const orderHash = await pollUntil(async () => {
        const ordersRes = await client.api.orders.forToken(selectedCollection.contractAddress, remixTokenId).catch(() => null);
        return ordersRes?.data?.find((o) => o.status === "ACTIVE" && o.offer.itemType === "ERC721")?.orderHash;
      });
      if (!orderHash) throw new Error("Could not confirm listing orderHash — check portfolio shortly");

      await confirmRemixOffer(
        offer.id,
        {
          remixContract: selectedCollection.contractAddress,
          remixTokenId,
          approvedCollection: selectedCollection.contractAddress,
          orderHash,
        },
      );

      setNewAssetLink(assetHref("STARKNET", selectedCollection.contractAddress, remixTokenId));
      setDone(true);
      onSuccess?.();
    } catch (err: unknown) {
      console.error("approve and mint failed", err);
      setApproveError(describeError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ApproveMintDialogView
      offer={offer}
      open={open}
      onOpenChange={onOpenChange}
      collections={eligibleCollections}
      footerNote="Grant the license: mint the derivative and list it for the requester, in one step."
      newAssetHref={newAssetLink}
      tx={{ phase, txHash: mintHash, error, retryable: !mintHash, reset }}
      onApprove={handleApprove}
    />
  );
}
