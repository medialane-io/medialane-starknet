"use client";

import Link from "next/link";
import { Ticket, Plus, Check } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { Button } from "@/components/ui/button";
import { ServiceHeader, CollectionCard, CollectionCardSkeleton } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { useTicketCollections } from "@/hooks/use-tickets";

const TICKET_FEATURES = [
  "Your own contract",
  "Redeemable at the door",
  "Built-in expiration",
  "Multiple events, one contract",
];

export function TicketsContent() {
  const { collections, isLoading } = useTicketCollections();

  return (
    <div className="pb-16 space-y-10">
      <section className="px-4 pt-10 max-w-5xl mx-auto">
        <ClaimBackButton />
        <FadeIn>
          <div className="mt-6">
            <ServiceHeader
              icon={<Ticket className="h-4 w-4 text-white" />}
              title="IP Tickets"
              subtitle="Sell verifiable tickets for your events — each one a real NFT your buyers can hold, trade, and show at the door."
              headerAccessory={
                <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
                  <Link href="/launchpad/tickets/create">
                    <Plus className="h-3.5 w-3.5" />
                    Sell Tickets
                  </Link>
                </Button>
              }
            />
          </div>
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto">
        <FadeIn>
          <div className="flex flex-wrap gap-2">
            {TICKET_FEATURES.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/30 text-xs font-medium text-muted-foreground"
              >
                <Check className="h-3 w-3 text-teal-500 shrink-0" />
                {f}
              </span>
            ))}
          </div>
        </FadeIn>
      </section>

      <section className="px-4 space-y-4 max-w-5xl mx-auto">
        <FadeIn>
          <div>
            <p className="section-label">Live</p>
            <h2 className="text-xl font-bold mt-0.5">Ticket collections</h2>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CollectionCardSkeleton key={i} />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <FadeIn>
            <div className="bento-cell border-dashed p-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-teal-500/8 flex items-center justify-center">
                  <Ticket className="h-8 w-8 text-teal-500/30" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">No ticket collections yet</p>
                <p className="text-xs text-muted-foreground">Be the first to sell tickets on Medialane.</p>
              </div>
              <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
                <Link href="/launchpad/tickets/create">
                  <Plus className="h-3.5 w-3.5" />
                  Sell Tickets
                </Link>
              </Button>
            </div>
          </FadeIn>
        ) : (
          <Stagger className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {collections.map((col) => (
              <StaggerItem key={col.contractAddress}>
                <CollectionCard
                  collection={col}
                  href={`/launchpad/tickets/${col.contractAddress}`}
                />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}
