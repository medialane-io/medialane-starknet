"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  Ticket,
  Plus,
  Calendar,
  Hash,
  Loader2,
  Users,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { useWallet } from "@/hooks/use-wallet";
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
    <div className="bento-cell overflow-hidden flex flex-col">
      {/* event image */}
      <div className="relative h-36 w-full bg-muted shrink-0">
        {img ? (
          <Image src={img} alt={token.metadata?.name ?? `Event #${tokenId}`} fill className="object-cover" unoptimized />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Calendar className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="pill-badge bg-black/60 text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
            #{tokenId}
          </span>
        </div>
      </div>

      {/* event info */}
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
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
    >
      {shortenAddress("STARKNET", address)}
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TicketCollectionPage() {
  const params = useParams<{ contract: string }>();
  const contract = params.contract ? normalizeAddress("STARKNET", params.contract) : params.contract;
  const { address } = useWallet();
  const { events, isLoading: eventsLoading } = useTicketEvents(contract);
  const { collection, isLoading: collectionLoading } = useCollection(contract);

  const collectionImage = resolveTokenImage(collection?.image);
  const totalMinted = events.reduce((sum, t) => {
    const bal = (t as any).balances;
    if (Array.isArray(bal)) return sum + bal.reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);
    return sum;
  }, 0);

  return (
    <div className="pb-20 space-y-0">

      {/* ── Hero: collection image + identity ── */}
      <div className="relative">
        {/* backdrop blur from image */}
        {collectionImage && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <Image
              src={collectionImage}
              alt=""
              fill
              className="object-cover opacity-10 blur-2xl scale-110"
              unoptimized
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
          </div>
        )}

        <div className="relative px-4 pt-8 pb-10 max-w-5xl mx-auto">
          <ClaimBackButton />

          <FadeIn>
            <div className="mt-6 flex flex-col sm:flex-row gap-6 items-start">
              {/* collection avatar */}
              <div className="shrink-0">
                <div className="relative h-24 w-24 sm:h-32 sm:w-32 rounded-2xl overflow-hidden border-2 border-border bg-muted shadow-xl">
                  {collectionLoading ? (
                    <div className="h-full w-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : collectionImage ? (
                    <Image src={collectionImage} alt={collection?.name ?? "Collection"} fill className="object-cover" unoptimized />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-brand-blue/10">
                      <Ticket className="h-10 w-10 text-brand-blue/50" />
                    </div>
                  )}
                </div>
              </div>

              {/* identity + actions */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  {collectionLoading ? (
                    <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
                  ) : (
                    <h1 className="text-2xl sm:text-3xl font-bold truncate">
                      {collection?.name ?? "Ticket Collection"}
                    </h1>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {collection?.symbol && (
                      <span className="pill-badge text-xs font-mono bg-brand-purple/10 text-brand-purple border border-brand-purple/20 px-2 py-0.5 rounded-full">
                        {collection.symbol}
                      </span>
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
                    <p className="text-sm text-muted-foreground mt-2 max-w-xl line-clamp-3">
                      {collection.description}
                    </p>
                  )}
                </div>

                {/* primary action */}
                <div className="flex items-center gap-2 pt-1">
                  <Button asChild size="sm" className="bg-brand-blue hover:bg-brand-electric text-white gap-1.5">
                    <Link href={`/launchpad/tickets/${contract}/create-event`}>
                      <Plus className="h-3.5 w-3.5" />
                      Add event
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <FadeIn>
        <div className="px-4 max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bento-cell p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Events
              </p>
              <p className="text-2xl font-bold">
                {eventsLoading ? <span className="text-muted-foreground text-base">—</span> : events.length}
              </p>
            </div>
            <div className="bento-cell p-4 space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5" /> Tickets minted
              </p>
              <p className="text-2xl font-bold">
                {eventsLoading ? <span className="text-muted-foreground text-base">—</span> : totalMinted || "—"}
              </p>
            </div>
            <div className="bento-cell p-4 space-y-1 col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Standard
              </p>
              <p className="text-2xl font-bold text-sm leading-none pt-1 font-mono text-muted-foreground">
                ERC-1155
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* ── Events ── */}
      <div className="px-4 max-w-5xl mx-auto space-y-4 pt-8">
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Events</p>
              <h2 className="text-xl font-bold mt-0.5">Your events</h2>
            </div>
            {events.length > 0 && (
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={`/launchpad/tickets/${contract}/create-event`}>
                  <Plus className="h-3.5 w-3.5" />
                  Add event
                </Link>
              </Button>
            )}
          </div>
        </FadeIn>

        {eventsLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading events…</span>
          </div>
        ) : events.length === 0 ? (
          <FadeIn>
            <div className="bento-cell border-dashed p-16 text-center space-y-5">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-brand-blue/8 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-brand-blue/30" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-semibold">No events yet</p>
                <p className="text-sm text-muted-foreground">
                  Create your first event to start selling tickets.
                </p>
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
