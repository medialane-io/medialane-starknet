"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  Ticket,
  Plus,
  Calendar,
  Loader2,
  Users,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { useTicketEvents } from "@/hooks/use-tickets";
import { useCollection } from "@/hooks/use-collections";
import { normalizeAddress, shortenAddress } from "@medialane/sdk";
import { resolveTokenImage } from "@/lib/utils";
import { EXPLORER_URL } from "@/lib/constants";
import type { ApiToken } from "@medialane/sdk";
import { useState } from "react";

// ── EventCard ─────────────────────────────────────────────────────────────────

function EventCard({ token, contract }: { token: ApiToken; contract: string }) {
  const tokenId = token.tokenId;
  const img = resolveTokenImage(token.metadata?.image);

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col bg-muted/30">
      <div className="relative h-40 w-full bg-muted shrink-0">
        {img ? (
          <Image src={img} alt={token.metadata?.name ?? `Event #${tokenId}`} fill className="object-cover" unoptimized />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-muted">
            <Calendar className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}
        <span className="absolute top-2 left-2 text-[10px] tabular-nums bg-black/60 text-white px-2 py-0.5 rounded-full">
          #{tokenId}
        </span>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{token.metadata?.name ?? `Event #${tokenId}`}</p>
          {token.metadata?.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{token.metadata.description}</p>
          )}
        </div>
        <Button asChild size="sm" className="w-full bg-brand-blue hover:bg-brand-electric text-white gap-1.5 text-xs">
          <Link href={`/launchpad/tickets/${contract}/mint?eventId=${tokenId}`}>
            <Ticket className="h-3.5 w-3.5" />
            Mint tickets
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ── CopyAddress ───────────────────────────────────────────────────────────────

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors tabular-nums"
    >
      {shortenAddress("STARKNET", address)}
      {copied ? <Check className="h-3 w-3 text-brand-blue" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TicketCollectionPage() {
  const params = useParams<{ contract: string }>();
  const contract = params.contract ? normalizeAddress("STARKNET", params.contract) : params.contract;
  const { events, isLoading: eventsLoading } = useTicketEvents(contract);
  const { collection, isLoading: collectionLoading } = useCollection(contract);

  const collectionImage = resolveTokenImage(collection?.image);
  const totalMinted = events.reduce((sum, t) => {
    const bal = (t as any).balances;
    if (Array.isArray(bal)) return sum + bal.reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);
    return sum;
  }, 0);

  return (
    <div className="pb-20">

      {/* ── Hero ── */}
      <div className="relative">
        {collectionImage && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <Image src={collectionImage} alt="" fill className="object-cover opacity-8 blur-3xl scale-110" unoptimized aria-hidden />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
          </div>
        )}

        <div className="relative px-4 pt-8 pb-12 max-w-5xl mx-auto">
          <ClaimBackButton />

          <FadeIn>
            <div className="mt-8 flex flex-col sm:flex-row gap-7 items-start">
              {/* avatar */}
              <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden bg-muted shrink-0">
                {collectionLoading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : collectionImage ? (
                  <Image src={collectionImage} alt={collection?.name ?? "Collection"} fill className="object-cover" unoptimized />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-brand-blue/10">
                    <Ticket className="h-9 w-9 text-brand-blue/40" />
                  </div>
                )}
              </div>

              {/* identity */}
              <div className="flex-1 min-w-0 space-y-4">
                <div className="space-y-1.5">
                  {collectionLoading ? (
                    <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
                  ) : (
                    <h1 className="text-2xl sm:text-3xl font-bold truncate">
                      {collection?.name ?? "Ticket Collection"}
                    </h1>
                  )}

                  <div className="flex items-center gap-3 flex-wrap">
                    {collection?.symbol && (
                      <span className="text-xs tabular-nums text-muted-foreground">{collection.symbol}</span>
                    )}
                    <CopyAddress address={contract} />
                    <a
                      href={`${EXPLORER_URL}/contract/${contract}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Explorer <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {collection?.description && (
                    <p className="text-sm text-muted-foreground max-w-xl line-clamp-3">
                      {collection.description}
                    </p>
                  )}
                </div>

                <Button asChild size="sm" className="bg-brand-blue hover:bg-brand-electric text-white gap-1.5">
                  <Link href={`/launchpad/tickets/${contract}/create-event`}>
                    <Plus className="h-3.5 w-3.5" />
                    Add event
                  </Link>
                </Button>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* ── Stats ── */}
      <FadeIn>
        <div className="px-4 max-w-5xl mx-auto">
          <div className="flex gap-10">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Events</p>
              <p className="text-2xl font-bold tabular-nums">
                {eventsLoading ? "—" : events.length}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Tickets minted</p>
              <p className="text-2xl font-bold tabular-nums">
                {eventsLoading ? "—" : totalMinted || "—"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Standard</p>
              <p className="text-2xl font-bold tabular-nums text-muted-foreground/70 text-lg leading-none pt-1">
                ERC-1155
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── Events ── */}
      <div className="px-4 max-w-5xl mx-auto space-y-4 pt-10">
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Events</p>
              <h2 className="text-xl font-bold mt-0.5">Your events</h2>
            </div>
            {events.length > 0 && (
              <Button asChild size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                <Link href={`/launchpad/tickets/${contract}/create-event`}>
                  <Plus className="h-3.5 w-3.5" />
                  Add event
                </Link>
              </Button>
            )}
          </div>
        </FadeIn>

        {eventsLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading events…</span>
          </div>
        ) : events.length === 0 ? (
          <FadeIn>
            <div className="py-20 text-center space-y-5">
              <Calendar className="h-10 w-10 text-muted-foreground/20 mx-auto" />
              <div className="space-y-1">
                <p className="font-semibold">No events yet</p>
                <p className="text-sm text-muted-foreground">Create your first event to start selling tickets.</p>
              </div>
              <Button asChild size="sm" className="bg-brand-blue hover:bg-brand-electric text-white gap-1.5">
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
      </div>
    </div>
  );
}
