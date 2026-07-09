"use client";

import Link from "next/link";
import { Handshake, ShieldCheck, Coins, ArrowRight } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ServiceHeader } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { useSponsorshipOffers } from "@/hooks/use-sponsorship";
import type { SponsorshipOffer } from "@/hooks/use-sponsorship";
import { getTokenByAddress, formatAmount } from "@medialane/sdk";

function OfferCard({ offer }: { offer: SponsorshipOffer }) {
  const token = getTokenByAddress(offer.paymentToken);
  const minDisplay = token ? formatAmount(offer.minAmount, token.decimals) : offer.minAmount;
  const durationDays = Math.round(Number(offer.duration) / 86400);

  return (
    <Link href={`/asset/${offer.nftContract}/${offer.tokenId}`} className="block group">
      <div className="bento-cell overflow-hidden flex flex-col p-5 gap-4 active:border-rose-500/40 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
            <Handshake className="h-5 w-5 text-rose-500" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-rose-500 bg-rose-500/10 rounded-full px-2 py-1">
            Open
          </span>
        </div>
        <div className="space-y-1 flex-1">
          <p className="text-sm font-semibold leading-tight">Token #{offer.tokenId}</p>
          <p className="text-xs text-muted-foreground truncate font-mono">
            {offer.nftContract.slice(0, 10)}…{offer.nftContract.slice(-6)}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Coins className="h-3 w-3" />
            Min {minDisplay} {token?.symbol ?? ""}
          </span>
          <span>{durationDays}d license</span>
        </div>
        <div className="text-xs text-rose-500 font-medium group-active:underline">View offer →</div>
      </div>
    </Link>
  );
}

function OfferCardSkeleton() {
  return (
    <div className="bento-cell p-5 space-y-4">
      <Skeleton className="h-9 w-9 rounded-xl" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

const SPONSORSHIP_FEATURES = [
  {
    icon: Handshake,
    title: "Direct settlement",
    desc: "Sponsor pays the creator directly — no escrow, no intermediary. The contract never holds funds.",
  },
  {
    icon: ShieldCheck,
    title: "Owner-verified",
    desc: "The offer author must own the asset at creation and acceptance — verified on-chain.",
  },
  {
    icon: Coins,
    title: "Open or private bidding",
    desc: "Let anyone bid, or restrict an offer to one invited sponsor.",
  },
];

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
              icon={<Handshake className="h-4 w-4 text-white" />}
              title="IP Sponsorship"
              subtitle="Sponsorship offers anchored to your IP assets — a sponsor bids, you accept, they receive a license."
            />
          </div>
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto">
        <FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SPONSORSHIP_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bento-cell p-4 space-y-3">
                <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-rose-500" />
                </div>
                <p className="text-sm font-semibold leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* Creator callout */}
      <section className="px-4 max-w-5xl mx-auto">
        <FadeIn>
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Own IP assets on Medialane?</p>
              <p className="text-xs text-muted-foreground">
                Open a sponsorship offer from any asset you own — sponsors bid, you accept, they receive a license.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0 border-rose-500/30 text-rose-500 hover:bg-rose-500/5 gap-1.5">
              <Link href="/portfolio">
                Go to my assets
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <OfferCardSkeleton key={i} />)}
          </div>
        ) : openOffers.length === 0 ? (
          <FadeIn>
            <div className="bento-cell border-dashed p-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-rose-500/8 flex items-center justify-center">
                  <Handshake className="h-8 w-8 text-rose-500/30" />
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
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {openOffers.map((offer) => (
              <StaggerItem key={offer.id}>
                <OfferCard offer={offer} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}
