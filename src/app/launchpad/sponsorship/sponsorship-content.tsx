"use client";

import Link from "next/link";
import { Handshake, ArrowRight, Check } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { Button } from "@/components/ui/button";
import { ServiceHeader, AssetCard, AssetCardSkeleton } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { useSponsorshipOffers } from "@/hooks/use-sponsorship";
import type { SponsorshipOffer } from "@/hooks/use-sponsorship";
import { useToken } from "@/hooks/use-tokens";
import { getTokenByAddress, formatAmount, shortenAddress } from "@medialane/sdk";

const SPONSORSHIP_FEATURES = [
  "No escrow — direct settlement",
  "Owner-verified on-chain",
  "Open bidding or one invited sponsor",
];

function SponsorshipOfferCard({ offer }: { offer: SponsorshipOffer }) {
  const { token } = useToken(offer.nftContract, offer.tokenId);
  const paymentToken = getTokenByAddress(offer.paymentToken);
  const minDisplay = paymentToken
    ? `Min ${formatAmount(offer.minAmount, paymentToken.decimals)} ${paymentToken.symbol}`
    : `Min ${offer.minAmount}`;
  const durationDays = Math.round(Number(offer.duration) / 86400);

  return (
    <AssetCard
      href={`/launchpad/sponsorship/${offer.offerId}`}
      name={token?.metadata?.name ?? `Token #${offer.tokenId}`}
      image={token?.metadata?.image ?? null}
      subtitle={shortenAddress("STARKNET", offer.nftContract)}
      fallbackId={offer.tokenId}
      price={{ formatted: `${minDisplay} · ${durationDays}d`, currency: null }}
    />
  );
}

export function SponsorshipContent() {
  const { offers, isLoading } = useSponsorshipOffers();
  const openOffers = offers.filter((o) => o.open);

  return (
    <div className="pb-16 space-y-10">
      <section className="px-4 pt-10 max-w-5xl mx-auto">
        <ClaimBackButton />
        <FadeIn>
          <div className="mt-6">
            <ServiceHeader
              plain
              icon={<Handshake className="h-4 w-4 text-white" />}
              title="IP Sponsorship"
              subtitle="Sponsorship offers anchored to your IP assets — a sponsor bids, you accept, they receive a license."
            />
          </div>
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto">
        <FadeIn>
          <div className="flex flex-wrap gap-2">
            {SPONSORSHIP_FEATURES.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/30 text-xs font-medium text-muted-foreground"
              >
                <Check className="h-3 w-3 text-brand-rose shrink-0" />
                {f}
              </span>
            ))}
          </div>
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto">
        <FadeIn>
          <div className="rounded-2xl border border-brand-rose/20 bg-brand-rose/5 p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Start a sponsorship deal</p>
              <p className="text-xs text-muted-foreground">
                Offer one of your assets for sponsors to bid on, or propose terms directly on one you&apos;d like to sponsor.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0 bg-brand-rose hover:brightness-110 text-white gap-1.5">
              <Link href="/launchpad/sponsorship/create">
                Get started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </FadeIn>
      </section>

      <section className="px-4 space-y-4 max-w-5xl mx-auto">
        <FadeIn>
          <div>
            <p className="section-label">Open</p>
            <h2 className="text-xl font-bold mt-0.5">Sponsorship offers</h2>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <AssetCardSkeleton key={i} />
            ))}
          </div>
        ) : openOffers.length === 0 ? (
          <FadeIn>
            <div className="bento-cell border-dashed p-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-brand-rose/8 flex items-center justify-center">
                  <Handshake className="h-8 w-8 text-brand-rose/30" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">No open sponsorship offers yet</p>
                <p className="text-xs text-muted-foreground">
                  Creators open offers from their asset pages — sponsors bid on them here.
                </p>
              </div>
            </div>
          </FadeIn>
        ) : (
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {openOffers.map((offer) => (
              <StaggerItem key={offer.id}>
                <SponsorshipOfferCard offer={offer} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}
