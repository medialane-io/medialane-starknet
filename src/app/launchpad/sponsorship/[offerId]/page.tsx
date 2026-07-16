"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { Handshake, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceHeader } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { FadeIn } from "@/components/ui/motion-primitives";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useSponsorshipOffer, useSponsorshipBids } from "@/hooks/use-sponsorship";
import { useToken } from "@/hooks/use-tokens";
import { getMedialaneClient } from "@/lib/medialane-client";
import { rewardToast } from "@/lib/reward-toast";
import { resolveTokenImage, shortenAddress } from "@/lib/utils";
import { getTokenByAddress, formatAmount, normalizeAddress } from "@medialane/sdk";
import { toast } from "sonner";

export default function SponsorshipOfferPage() {
  const params = useParams();
  const offerId = typeof params.offerId === "string" ? params.offerId : null;

  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, address: activeAddress, isConnected } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;

  const { offer, isLoading: offerLoading, mutate: mutateOffer } = useSponsorshipOffer(offerId);
  const { bids, isLoading: bidsLoading, mutate: mutateBids } = useSponsorshipBids(offerId);
  const { token } = useToken(offer?.nftContract ?? "", offer?.tokenId ?? "");

  const [bidAmount, setBidAmount] = useState("");
  const [isPlacingBid, setIsPlacingBid] = useState(false);
  const [acceptingSponsor, setAcceptingSponsor] = useState<string | null>(null);

  const isOwner = !!activeAddress && !!offer && normalizeAddress("STARKNET", activeAddress) === normalizeAddress("STARKNET", offer.author);
  const paymentToken = offer ? getTokenByAddress(offer.paymentToken) : null;
  const durationDays = offer ? Math.round(offer.duration / 86400) : 0;

  const onPlaceBid = async () => {
    if (!signer || !offer) { toast.error("Connect a wallet first"); return; }
    if (!bidAmount || Number(bidAmount) <= 0) { toast.error("Enter a bid amount"); return; }
    if (!paymentToken) { toast.error("Unsupported payment token"); return; }
    setIsPlacingBid(true);
    try {
      const client = getMedialaneClient();
      await client.services.sponsorship.placeBid(signer, {
        offerId: offer.offerId,
        amount: BigInt(Math.round(Number(bidAmount) * 10 ** paymentToken.decimals)),
        paymentToken: offer.paymentToken,
        sponsorshipAddress: offer.contractAddress,
      });
      toast.success("Bid placed");
      rewardToast("place_sponsorship_bid");
      setBidAmount("");
      await mutateBids();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setIsPlacingBid(false);
    }
  };

  const onAcceptBid = async (sponsor: string) => {
    if (!signer || !offer) { toast.error("Connect a wallet first"); return; }
    setAcceptingSponsor(sponsor);
    try {
      const client = getMedialaneClient();
      await client.services.sponsorship.acceptBid(signer, {
        offerId: offer.offerId,
        sponsor,
        sponsorshipAddress: offer.contractAddress,
      });
      toast.success("Bid accepted — license minted to the sponsor");
      await Promise.all([mutateOffer(), mutateBids()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept bid");
    } finally {
      setAcceptingSponsor(null);
    }
  };

  if (offerLoading) {
    return <div className="max-w-3xl mx-auto px-4 pt-24 pb-8 text-center text-sm text-muted-foreground">Loading offer…</div>;
  }
  if (!offer) {
    return <div className="max-w-3xl mx-auto px-4 pt-24 pb-8 text-center text-sm text-muted-foreground">Offer not found.</div>;
  }

  const imageUrl = resolveTokenImage(token?.metadata?.image);
  const minDisplay = paymentToken ? `${formatAmount(offer.minAmount, paymentToken.decimals)} ${paymentToken.symbol}` : offer.minAmount;

  return (
    <div className="pb-16">
      <section className="px-4 pt-10 max-w-3xl mx-auto space-y-6">
        <ClaimBackButton />
        <FadeIn>
          <ServiceHeader
            plain
            icon={<Handshake className="h-4 w-4 text-white" />}
            title={token?.metadata?.name ?? `Token #${offer.tokenId}`}
            subtitle={offer.open ? "Open for bids" : "Closed"}
          />
        </FadeIn>

        <FadeIn>
          <div className="rounded-2xl border border-border/40 overflow-hidden">
            <div className="relative aspect-video bg-muted/40">
              {imageUrl ? (
                <Image src={imageUrl} alt={token?.metadata?.name ?? "Asset"} fill className="object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Minimum bid</p>
                <p className="font-semibold">{minDisplay}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">License length</p>
                <p className="font-semibold">{durationDays} days</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resale royalty</p>
                <p className="font-semibold">{(offer.royaltyBps / 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Owner</p>
                <p className="font-semibold">{shortenAddress(offer.author)}</p>
              </div>
            </div>
          </div>
        </FadeIn>

        {!offer.open ? (
          <FadeIn>
            <p className="text-sm text-muted-foreground text-center py-6">This offer is no longer open.</p>
          </FadeIn>
        ) : isOwner ? (
          <FadeIn>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Bids</p>
              {bidsLoading ? (
                <p className="text-xs text-muted-foreground">Loading bids…</p>
              ) : bids.length === 0 ? (
                <p className="text-xs text-muted-foreground">No bids yet.</p>
              ) : (
                <div className="space-y-2">
                  {bids.map((bid) => (
                    <div key={bid.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/30 p-3">
                      <div>
                        <p className="text-sm font-medium">{shortenAddress(bid.sponsor)}</p>
                        <p className="text-xs text-muted-foreground">
                          {paymentToken ? `${formatAmount(bid.amount, paymentToken.decimals)} ${paymentToken.symbol}` : bid.amount}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-brand-rose hover:brightness-110 text-white"
                        disabled={acceptingSponsor !== null}
                        onClick={() => onAcceptBid(bid.sponsor)}
                      >
                        {acceptingSponsor === bid.sponsor ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Accept"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FadeIn>
        ) : (
          <FadeIn>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Place a bid</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Your bid"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  disabled={isPlacingBid}
                />
                <Button
                  className="bg-brand-rose hover:brightness-110 text-white shrink-0"
                  disabled={isPlacingBid || !isConnected}
                  onClick={onPlaceBid}
                >
                  {isPlacingBid ? <Loader2 className="h-4 w-4 animate-spin" /> : "Place bid"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Placing a bid approves the offer&apos;s payment token — no funds move until the owner accepts.
              </p>
            </div>
          </FadeIn>
        )}
      </section>
    </div>
  );
}
