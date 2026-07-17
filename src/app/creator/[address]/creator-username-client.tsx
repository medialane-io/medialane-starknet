"use client";

import { useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { toast } from "sonner";
import { useCreatorByUsername } from "@/hooks/use-username-claims";
import { useUserOrders } from "@/hooks/use-orders";
import { useActivitiesByAddress } from "@/hooks/use-activities";
import { useCollectionsByOwner } from "@/hooks/use-collections";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { CollectionCard, CollectionCardSkeleton } from "@medialane/ui";
import { CreatorAnalytics } from "@/components/creator/creator-analytics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ipfsToHttp, normalizeAddress } from "@/lib/utils";
import {
  Activity, LayoutList, ShoppingBag, BarChart2,
  Globe, Twitter, ExternalLink, Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addressPalette } from "@/lib/creator-utils";
import { ActivityRow } from "@/components/creator/activity-row";

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "collections", label: "Collections", Icon: LayoutList },
  { id: "listings",    label: "Listings",    Icon: ShoppingBag },
  { id: "analytics",   label: "Analytics",   Icon: BarChart2 },
  { id: "activity",    label: "Activity",    Icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, heading, body }: { icon: React.ElementType; heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="h-14 w-14 rounded-2xl border border-border/60 bg-muted/40 flex items-center justify-center">
        <Icon className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">{heading}</p>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface Props { username: string }

export default function CreatorUsernamePageClient({ username }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("collections");
  const { creator, isLoading, error } = useCreatorByUsername(username);
  const walletAddress = creator?.walletAddress ? normalizeAddress(creator.walletAddress) : null;

  // Lazy data fetching — only fire when the tab is active
  const { orders,      isLoading: ordersLoading      } = useUserOrders(activeTab === "listings"    ? walletAddress : null);
  const { collections, isLoading: collectionsLoading } = useCollectionsByOwner(activeTab === "collections" ? walletAddress : null);
  const { activities,  isLoading: activitiesLoading  } = useActivitiesByAddress(walletAddress);

  const activeListings = orders.filter((o) => o.status === "ACTIVE" && o.offer.itemType === "ERC721");

  const { h1, h2, h3 } = addressPalette(walletAddress ?? "0x0");
  const bannerUrl = creator?.bannerImage ? ipfsToHttp(creator.bannerImage) : null;
  const avatarUrl = creator?.avatarImage ? ipfsToHttp(creator.avatarImage) : null;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="pb-20 min-h-screen">
        <Skeleton className="w-full h-56 sm:h-80 rounded-none" />
        <div className="px-6">
          <div className="-mt-16 sm:-mt-20 relative z-10 pb-6 space-y-4">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <Skeleton className="h-[112px] w-[112px] rounded-full shrink-0" />
              <div className="flex-1 min-w-0 pb-1 space-y-2">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <CollectionCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (error || !creator) {
    return (
      <div className="mx-auto px-4 py-24 max-w-lg text-center space-y-4">
        <p className="text-5xl">🔍</p>
        <h1 className="text-2xl font-bold">Creator not found</h1>
        <p className="text-muted-foreground">
          <span className="tabular-nums">@{username}</span> hasn&apos;t been claimed yet or doesn&apos;t exist.
        </p>
        <Button variant="outline" asChild>
          <Link href="/marketplace">Browse Marketplace</Link>
        </Button>
      </div>
    );
  }

  const displayName = creator.displayName || `@${creator.username}`;

  return (
    <div className="pb-20 min-h-screen">
      {/* ── Hero banner ───────────────────────────────────────────────────────── */}
      <div className="relative h-56 sm:h-80 overflow-hidden">
        {bannerUrl && (
          <div className="absolute inset-0">
            <NextImage
              src={bannerUrl} alt="" fill
              className="object-cover scale-150"
              style={{ opacity: 0.6, filter: "blur(48px) saturate(1.8) brightness(0.55)" }}
              unoptimized aria-hidden
            />
            <div className="absolute inset-0 bg-background/25" />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 90% 90% at 15% 60%, hsl(${h1}, 68%, 42% / ${bannerUrl ? 0.28 : 0.52}) 0%, transparent 65%),
              radial-gradient(ellipse 65% 65% at 85% 25%, hsl(${h2}, 68%, 38% / ${bannerUrl ? 0.18 : 0.42}) 0%, transparent 60%),
              radial-gradient(ellipse 45% 45% at 55% 85%, hsl(${h3}, 68%, 38% / ${bannerUrl ? 0.12 : 0.30}) 0%, transparent 55%)
            `,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-32" style={{ background: `linear-gradient(to bottom, transparent 0%, hsl(var(--background)) 100%)` }} />
        <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-background/15 to-transparent" />
        {/* Share button */}
        <div className="absolute top-4 right-4 z-10">
          <Button
            variant="outline" size="sm"
            className="bg-background/60 backdrop-blur-sm border-white/20 text-white hover:bg-background/80 hover:text-white"
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}
          >
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            Share
          </Button>
        </div>
      </div>

      {/* ── Page body ─────────────────────────────────────────────────────────── */}
      <div className="px-6">
        {/* Identity section */}
        <div className="-mt-16 sm:-mt-20 relative z-10 space-y-4 pb-6">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
            {/* Avatar */}
            <div
              className="rounded-full shrink-0 ring-[3px] ring-background overflow-hidden flex items-center justify-center text-white font-bold"
              style={{
                width: 112, height: 112,
                background: avatarUrl
                  ? "transparent"
                  : `linear-gradient(145deg, hsl(${h1}, 72%, 60%), hsl(${h2}, 72%, 50%))`,
                fontSize: 37,
              }}
            >
              {avatarUrl ? (
                <NextImage src={avatarUrl} alt={displayName} width={112} height={112} className="w-full h-full object-cover" unoptimized />
              ) : (
                (walletAddress ?? "0x").slice(2, 4).toUpperCase()
              )}
            </div>

            {/* Name + handle */}
            <div className="flex-1 min-w-0 pb-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="pill-badge">Creator</span>
                <span className="text-xs tabular-nums text-muted-foreground">@{creator.username}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate">{displayName}</h1>
              {creator.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl line-clamp-2">{creator.bio}</p>
              )}
            </div>

            {/* CTA */}
            <div className="pb-1">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/account/${creator.walletAddress}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Full profile
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-2">
            {activities.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm">
                <span className="font-bold tabular-nums">{activities.length}</span>
                <span className="text-muted-foreground">Events</span>
              </div>
            )}
            {activeListings.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm">
                <span className="font-bold tabular-nums">{activeListings.length}</span>
                <span className="text-muted-foreground">Listed</span>
              </div>
            )}
            {collections.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm">
                <span className="font-bold tabular-nums">{collections.length}</span>
                <span className="text-muted-foreground">Collections</span>
              </div>
            )}
          </div>

          {/* Social links */}
          {(creator.websiteUrl || creator.twitterUrl) && (
            <div className="flex items-center gap-2">
              {creator.websiteUrl && (
                <a href={creator.websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors" title="Website">
                  <Globe className="h-3.5 w-3.5" />
                </a>
              )}
              {creator.twitterUrl && (
                <a href={creator.twitterUrl} target="_blank" rel="noopener noreferrer"
                  className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors" title="Twitter / X">
                  <Twitter className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Tab navigation ─────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 -mx-6 px-6 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none -mb-px">
            {TABS.map(({ id, label, Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 whitespace-nowrap shrink-0",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 inset-x-0 h-0.5 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, hsl(${h1}, 68%, 62%), hsl(${h2}, 68%, 58%))`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ────────────────────────────────────────────────────── */}
        <div className="mt-6">

          {/* Collections */}
          {activeTab === "collections" && (
            collectionsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <CollectionCardSkeleton key={i} />)}
              </div>
            ) : collections.length === 0 ? (
              <EmptyState icon={LayoutList} heading="No collections yet" body="This creator hasn't deployed any collections on Medialane yet." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((c) => <CollectionCard key={c.contractAddress} collection={c} />)}
              </div>
            )
          )}

          {/* Listings */}
          {activeTab === "listings" && (
            ordersLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : activeListings.length === 0 ? (
              <EmptyState icon={ShoppingBag} heading="No active listings" body="This creator has no IP assets listed for sale right now." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeListings.map((o) => <ListingCard key={o.orderHash} order={o} />)}
              </div>
            )
          )}

          {/* Analytics */}
          {activeTab === "analytics" && (
            <div className="max-w-2xl">
              <CreatorAnalytics activities={activities} isLoading={activitiesLoading} />
            </div>
          )}

          {/* Activity */}
          {activeTab === "activity" && (
            <div className="max-w-2xl">
              {activitiesLoading ? (
                <div className="space-y-5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <Skeleton className="h-3.5 w-36" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <EmptyState icon={Activity} heading="No activity yet" body="On-chain events for this creator will appear here as they happen." />
              ) : (
                <div>
                  {activities.map((a, i) => (
                    <ActivityRow key={i} event={a} isLast={i === activities.length - 1} />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
