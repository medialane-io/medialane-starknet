"use client";

import Link from "next/link";
import { Ticket, Plus, Loader2 } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { Button } from "@/components/ui/button";
import { ServiceHeader, CollectionCard, CollectionCardSkeleton } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { ConnectGate } from "@/components/connect-gate";
import { useWallet } from "@/hooks/use-wallet";
import { useMyTicketCollections } from "@/hooks/use-tickets";

export function TicketsContent() {
  const { address, isConnected } = useWallet();
  const { collections, isLoading } = useMyTicketCollections(address ?? null);

  if (!isConnected) {
    return <ConnectGate><div /></ConnectGate>;
  }

  return (
    <div className="pb-16 space-y-10">
      <section className="px-4 pt-10 max-w-5xl mx-auto">
        <ClaimBackButton />
        <FadeIn>
          <div className="mt-6">
            <ServiceHeader
              icon={<Ticket className="h-4 w-4 text-white" />}
              title="IP Tickets"
              subtitle="Deploy a collection, add events, and mint tickets to attendees."
              headerAccessory={
                <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
                  <Link href="/launchpad/tickets/create">
                    <Plus className="h-3.5 w-3.5" />
                    Create collection
                  </Link>
                </Button>
              }
            />
          </div>
        </FadeIn>
      </section>

      <section className="px-4 space-y-4 max-w-5xl mx-auto">
        <FadeIn>
          <div>
            <p className="section-label">Your collections</p>
            <h2 className="text-xl font-bold mt-0.5">Ticket collections</h2>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
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
                <p className="font-semibold text-sm">No collections yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first ticket collection to start adding events.
                </p>
              </div>
              <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
                <Link href="/launchpad/tickets/create">
                  <Plus className="h-3.5 w-3.5" />
                  Create collection
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
