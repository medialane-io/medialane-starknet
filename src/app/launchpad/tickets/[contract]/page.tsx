"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Ticket, Plus, Calendar, Hash, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceHeader } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { useWallet } from "@/hooks/use-wallet";
import { useTicketEvents } from "@/hooks/use-tickets";
import { normalizeAddress } from "@medialane/sdk";
import { shortenAddress } from "@medialane/sdk";
import type { ApiToken } from "@medialane/sdk";

function EventCard({ token, contract }: { token: ApiToken; contract: string }) {
  const tokenId = token.tokenId;
  return (
    <div className="bento-cell p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
          <Calendar className="h-5 w-5 text-teal-500" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{token.metadata?.name ?? `Event #${tokenId}`}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Hash className="h-3 w-3" />
            Token ID {tokenId}
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline" className="w-full text-xs">
        <Link href={`/launchpad/tickets/${contract}/mint?eventId=${tokenId}`}>
          Mint tickets
        </Link>
      </Button>
    </div>
  );
}

export default function TicketCollectionPage() {
  const params = useParams<{ contract: string }>();
  const contract = params.contract ? normalizeAddress("STARKNET", params.contract) : params.contract;
  const { address } = useWallet();
  const { events, isLoading } = useTicketEvents(contract);

  return (
    <div className="pb-16 space-y-10">
      <section className="px-4 pt-10 max-w-5xl mx-auto">
        <ClaimBackButton />
        <FadeIn>
          <div className="mt-6">
            <ServiceHeader
              icon={<Ticket className="h-4 w-4 text-white" />}
              title="Manage ticket collection"
              subtitle={contract ? shortenAddress("STARKNET", contract) : ""}
              headerAccessory={
                <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
                  <Link href={`/launchpad/tickets/${contract}/create-event`}>
                    <Plus className="h-3.5 w-3.5" />
                    Add event
                  </Link>
                </Button>
              }
            />
          </div>
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto space-y-4">
        <FadeIn>
          <div>
            <p className="section-label">Events</p>
            <h2 className="text-xl font-bold mt-0.5">Your events</h2>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading events…</span>
          </div>
        ) : events.length === 0 ? (
          <FadeIn>
            <div className="bento-cell border-dashed p-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-teal-500/8 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-teal-500/30" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">No events yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first event to start selling tickets.
                </p>
              </div>
              <Button asChild size="sm" className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5">
                <Link href={`/launchpad/tickets/${contract}/create-event`}>
                  <Plus className="h-3.5 w-3.5" />
                  Add event
                </Link>
              </Button>
            </div>
          </FadeIn>
        ) : (
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((token) => (
              <StaggerItem key={token.tokenId}>
                <EventCard token={token} contract={contract} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}
