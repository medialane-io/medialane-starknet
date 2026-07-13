"use client";

import { useState } from "react";
import { CreatorScoreInline } from "@/components/rewards/creator-score-inline";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { useTokensByOwner } from "@/hooks/use-tokens";
import { useUserOrders } from "@/hooks/use-orders";
import { useActivitiesByAddress } from "@/hooks/use-activities";
import { useCollectionsByOwner } from "@/hooks/use-collections";
import { TokenCard, TokenCardSkeleton } from "@/components/shared/token-card";
import { AddressDisplay } from "@/components/shared/address-display";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { CollectionCard, CollectionCardSkeleton } from "@medialane/ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Image as ImageIcon,
  LayoutGrid,
  ShoppingBag,
  LayoutList,
  Flag,
} from "lucide-react";
import { ReportDialog } from "@/components/report-dialog";
import { ShareButton } from "@/components/shared/share-button";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import { cn } from "@/lib/utils";
import { ActivityRow } from "@/components/creator/activity-row";

// ─── Tab config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: "assets",      label: "Assets",      Icon: LayoutGrid },
  { id: "listings",    label: "Listings",    Icon: ShoppingBag },
  { id: "collections", label: "Collections", Icon: LayoutList },
  { id: "activity",    label: "Activity",    Icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  heading,
  body,
}: {
  icon: React.ElementType;
  heading: string;
  body: string;
}) {
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreatorPageClient() {
  const { address } = useParams<{ address: string }>();
  const [activeTab, setActiveTab] = useState<TabId>("assets");
  const [reportOpen, setReportOpen] = useState(false);

  const addr = address ?? null;

  const { data: hiddenStatus } = useSWR<{ isHidden: boolean }>(
    address ? `/api/creators/${address}/hidden` : null,
    (url: string) => fetch(url).then(r => r.json())
  );

  // Lazy data fetching — only load when tab is active
  const { tokens,      isLoading: tokensLoading      } = useTokensByOwner(activeTab === "assets"      ? addr : null);
  const { orders,      isLoading: ordersLoading      } = useUserOrders(activeTab === "listings"    ? addr : null);
  const { collections, isLoading: collectionsLoading } = useCollectionsByOwner(activeTab === "collections" ? addr : null);
  const { activities,  isLoading: activitiesLoading  } = useActivitiesByAddress(activeTab === "activity" ? addr : null);

  const activeListings = orders.filter(
    (o) => o.status === "ACTIVE" && o.offer.itemType === "ERC721"
  );

  // Tab count badges — only shown once that tab has been visited and loaded
  const tabBadge: Partial<Record<TabId, number>> = {
    ...(activeTab === "assets"      && !tokensLoading      && { assets:      tokens.length }),
    ...(activeTab === "listings"    && !ordersLoading      && { listings:    activeListings.length }),
    ...(activeTab === "collections" && !collectionsLoading && { collections: collections.length }),
    ...(activeTab === "activity"    && !activitiesLoading  && { activity:    activities.length }),
  };

  return (
    <div className="min-h-screen pb-20">
      {hiddenStatus?.isHidden === true && <HiddenContentBanner />}

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="px-6 pt-20 pb-2 flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AddressDisplay
              address={address ?? ""}
              chars={10}
              className="text-base tabular-nums font-semibold"
            />
            <CreatorScoreInline address={address} size="sm" />
          </div>
          {(() => {
            const parts: string[] = [];
            if (tabBadge.assets      !== undefined) parts.push(`${tabBadge.assets} ${tabBadge.assets === 1 ? "asset" : "assets"}`);
            if (tabBadge.listings    !== undefined && tabBadge.listings    > 0) parts.push(`${tabBadge.listings} ${tabBadge.listings === 1 ? "listing" : "listings"}`);
            if (tabBadge.collections !== undefined && tabBadge.collections > 0) parts.push(`${tabBadge.collections} ${tabBadge.collections === 1 ? "collection" : "collections"}`);
            if (parts.length === 0) return null;
            return <p className="text-xs text-muted-foreground">{parts.join(" · ")}</p>;
          })()}
        </div>
        <div className="flex items-center gap-1 shrink-0 pt-1">
          <ShareButton title="Creator Profile" size="icon" variant="ghost" />
          <Button variant="ghost" size="icon" onClick={() => setReportOpen(true)}>
            <Flag className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="px-6">

        <ReportDialog
          target={{
            type: "CREATOR",
            address: address ?? "",
            name: addr ? `${addr.slice(0, 10)}…${addr.slice(-8)}` : undefined,
          }}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />

        {/* ── Tab navigation ────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 -mx-6 px-6 bg-background/75 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none -mb-px">
            {TABS.map(({ id, label, Icon }) => {
              const count = tabBadge[id];
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 whitespace-nowrap shrink-0",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {count !== undefined && count > 0 && (
                    <span
                      className={cn(
                        "text-[10px] font-bold rounded-full px-1.5 py-px min-w-[18px] text-center tabular-nums",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <div className="mt-6">

          {/* Assets */}
          {activeTab === "assets" && (
            tokensLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <TokenCardSkeleton key={i} />)}
              </div>
            ) : tokens.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                heading="No assets yet"
                body="This creator hasn't minted any IP assets on Medialane yet."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {tokens.map((t) => (
                  <TokenCard key={`${t.contractAddress}-${t.tokenId}`} token={t} />
                ))}
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
              <EmptyState
                icon={ShoppingBag}
                heading="No active listings"
                body="This creator has no IP assets listed for sale right now."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeListings.map((o) => (
                  <ListingCard key={o.orderHash} order={o} />
                ))}
              </div>
            )
          )}

          {/* Collections */}
          {activeTab === "collections" && (
            collectionsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <CollectionCardSkeleton key={i} />)}
              </div>
            ) : collections.length === 0 ? (
              <EmptyState
                icon={LayoutList}
                heading="No collections yet"
                body="This creator hasn't deployed any collections on Medialane yet."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((c) => (
                  <CollectionCard key={c.contractAddress} collection={c} />
                ))}
              </div>
            )
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
                      <div className="space-y-1.5 pt-1">
                        <Skeleton className="h-3.5 w-16" />
                        <Skeleton className="h-3 w-10 ml-auto" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  heading="No activity yet"
                  body="onchain events for this creator will appear here as they happen."
                />
              ) : (
                <div>
                  {activities.map((a, i) => (
                    <ActivityRow
                      key={i}
                      event={a}
                      isLast={i === activities.length - 1}
                    />
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
