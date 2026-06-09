"use client";

import { useState, useEffect } from "react";
import { withSiwsAuth } from "@/lib/pinata-fetch";
import { useWallet } from "@/hooks/use-wallet";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useMedialaneClient } from "@/hooks/use-medialane-client";
import { useTx } from "@/hooks/use-tx";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useCollectionsByOwner } from "@/hooks/use-collections";
import { confirmRemixOffer } from "@/hooks/use-remix-offers";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { formatDisplayPrice } from "@/lib/utils";
import { getTokenByAddress, getService } from "@medialane/sdk";
import { GitBranch, Loader2 } from "lucide-react";
import type { RemixOffer } from "@/types/remix-offers";
import type { Call } from "starknet";
import { INDEXER_REVALIDATION_DELAY_MS, EXPLORER_URL } from "@/lib/constants";
import { MarketplaceSuccessState } from "@/components/marketplace/marketplace-dialog-primitives";
import { fireConfetti } from "@/lib/confetti";

interface Props {
  offer: RemixOffer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

export function ApproveMintSheet({ offer, open, onOpenChange, onSuccess }: Props) {
  const { address: walletAddress } = useWallet();
  const { getValidToken } = useSiwsToken();
  const { execute: executeTransaction } = useTx();
  const { createListing } = useMarketplace();
  const client = useMedialaneClient();

  const { collections } = useCollectionsByOwner(walletAddress ?? null);
  const eligibleCollections = collections.filter(
    (c) => getService(c.service)?.id === "mip-erc721" && c.collectionId != null
  );

  const defaultCollectionId =
    eligibleCollections.find((c) => c.contractAddress === offer?.originalContract)?.collectionId ??
    eligibleCollections[0]?.collectionId ??
    null;

  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [remixName, setRemixName] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [newAssetLink, setNewAssetLink] = useState<string | null>(null);
  const [mintHash, setMintHash] = useState<string | null>(null);

  useEffect(() => {
    if (done) fireConfetti();
  }, [done]);

  const effectiveCollectionId = selectedCollectionId ?? defaultCollectionId;
  const selectedCollection = eligibleCollections.find((c) => c.collectionId === effectiveCollectionId);

  const currencyToken = offer?.proposedCurrency ? getTokenByAddress(offer.proposedCurrency) : null;
  const priceDisplay =
    offer?.proposedPrice && currencyToken
      ? `${formatDisplayPrice((Number(BigInt(offer.proposedPrice)) / 10 ** currencyToken.decimals).toString())} ${currencyToken.symbol}`
      : "—";

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedCollectionId(null);
      setRemixName("");
      setDone(false);
      setNewAssetLink(null);
      setMintHash(null);
    }
    onOpenChange(v);
  };

  const effectiveName = remixName.trim() || `Remix of Token #${offer?.originalTokenId}`;

  const handleApprove = () => {
    if (!effectiveCollectionId || !selectedCollection) {
      toast.error("No eligible collection");
      return;
    }
    setPinOpen(true);
  };

  const handlePin = async (pin: string) => {
    setPinOpen(false);
    if (!offer || !walletAddress || !effectiveCollectionId || !selectedCollection) return;
    setLoading(true);

    try {
      // 1. Upload remix IPFS metadata
      const token = await getValidToken();
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
      const pinRes = await fetch("/api/pinata/json", withSiwsAuth(token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      }));
      const pinData = await pinRes.json().catch(() => ({}));
      if (!pinRes.ok || !pinData.uri) throw new Error(pinData.error ?? "Metadata upload failed");

      // 2. Mint via createMintIntent
      const intentRes = await client.api.createMintIntent({
        owner: walletAddress,
        collectionId: effectiveCollectionId,
        recipient: walletAddress,
        tokenUri: pinData.uri,
      });
      const mintCalls = (intentRes.data as any)?.calls as Call[];
      if (!mintCalls?.length) throw new Error("No mint calls returned");

      const mintResult = await executeTransaction(mintCalls);
      if (mintResult === null) throw new Error("Mint reverted");
      setMintHash(mintResult);

      // 3. Poll for new tokenId
      let remixTokenId: string | undefined;
      const mintDeadline = Date.now() + 10_000;
      while (Date.now() < mintDeadline) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const tokensRes = await client.api.getTokensByOwner(walletAddress, 1, 5);
          const newest = tokensRes.data?.find((t) => t.contractAddress === selectedCollection.contractAddress);
          if (newest) {
            remixTokenId = newest.tokenId;
            break;
          }
        } catch { /* ignore */ }
      }
      if (!remixTokenId) throw new Error("Could not determine remix token ID");

      // 4. Create marketplace listing
      const currencySymbol = currencyToken?.symbol ?? "STRK";
      await createListing(
        selectedCollection.contractAddress,
        remixTokenId,
        offer.proposedPrice ?? "0",
        currencySymbol,
        30 * 24 * 60 * 60, // 30 days
        undefined,
        undefined,
        { silent: true }, // sheet shows its own success state for the whole flow
      );

      // 5. Poll for listing to get orderHash
      let orderHash: string | undefined;
      const listingDeadline = Date.now() + 15_000;
      while (Date.now() < listingDeadline) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const ordersRes = await client.api.getActiveOrdersForToken(
            selectedCollection.contractAddress,
            remixTokenId
          );
          const listing = ordersRes.data?.find(
            (o) => o.status === "ACTIVE" && o.offer.itemType === "ERC721"
          );
          if (listing) {
            orderHash = listing.orderHash;
            break;
          }
        } catch { /* ignore */ }
      }
      if (!orderHash) throw new Error("Could not confirm listing orderHash — check portfolio shortly");

      // 6. Confirm offer in backend
      await confirmRemixOffer(
        offer.id,
        {
          remixContract: selectedCollection.contractAddress,
          remixTokenId,
          approvedCollection: selectedCollection.contractAddress,
          orderHash,
        },
        await getValidToken()
      );

      setNewAssetLink(`/asset/${selectedCollection.contractAddress}/${remixTokenId}`);
      setDone(true);
      setTimeout(() => onSuccess?.(), INDEXER_REVALIDATION_DELAY_MS);
    } catch (err: unknown) {
      const friendly = getFriendlyWalletError(err);
      if (friendly.isUserRejection) {
        toast.info(friendly.title, { description: friendly.description });
      } else {
        toast.error(friendly.title, { description: friendly.message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="h-[90dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              Grant license &amp; mint
            </SheetTitle>
          </SheetHeader>

          {done ? (
            <MarketplaceSuccessState
              name="Remix"
              title="License granted!"
              description={'The buyer will see "Complete Purchase" in their portfolio.'}
              txHash={mintHash}
              explorerUrl={EXPLORER_URL}
              onDone={() => handleOpenChange(false)}
              footer={
                newAssetLink ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={newAssetLink}>View new asset</a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-5 pt-4">
              {offer && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm space-y-1">
                  <p><span className="text-muted-foreground">Token</span> #{offer.originalTokenId}</p>
                  <p><span className="text-muted-foreground">License</span> {offer.licenseType}</p>
                  <p><span className="text-muted-foreground">Price</span> {priceDisplay}</p>
                  {offer.message && <p className="text-muted-foreground italic">"{offer.message}"</p>}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Remix Name</Label>
                <Input
                  placeholder={effectiveName}
                  value={remixName}
                  onChange={(e) => setRemixName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Mint into collection</Label>
                {eligibleCollections.length === 0 ? (
                  <p className="text-xs text-destructive">No eligible collections.</p>
                ) : (
                  <Select
                    value={effectiveCollectionId ?? ""}
                    onValueChange={setSelectedCollectionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleCollections.map((c) => (
                        <SelectItem key={c.collectionId!} value={c.collectionId!}>
                          {c.name ?? c.contractAddress.slice(0, 14) + "…"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleApprove}
                disabled={loading || eligibleCollections.length === 0}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitBranch className="h-4 w-4 mr-2" />}
                Grant license & mint
              </Button>
              <p className="text-xs text-center text-muted-foreground">Grant the license: mint the derivative and list it for the requester. One transaction. Gas is sponsored.</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
