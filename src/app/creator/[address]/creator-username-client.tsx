"use client";

import { useState } from "react";
import Link from "next/link";
import { useCreatorByUsername } from "@/hooks/use-username-claims";
import { useUserOrders } from "@/hooks/use-orders";
import { useActivitiesByAddress } from "@/hooks/use-activities";
import { useCollectionsByOwner } from "@/hooks/use-collections";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { CollectionCard, CollectionCardSkeleton, CreatorHeader, TabEmptyState } from "@medialane/ui";
import { CreatorAnalytics } from "@/components/creator/creator-analytics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ipfsToHttp } from "@/lib/utils";
import { normalizeAddress } from "@medialane/sdk";
import {
  Activity, LayoutList, ShoppingBag, BarChart2,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityRow } from "@/components/creator/activity-row";

const TABS = [
  { id: "collections", label: "Collections", Icon: LayoutList },
  { id: "listings",    label: "Listings",    Icon: ShoppingBag },
  { id: "analytics",   label: "Analytics",   Icon: BarChart2 },
  { id: "activity",    label: "Activity",    Icon: Activity },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props { username: string }

export default function CreatorUsernamePageClient({ username }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("collections");
  const { creator, isLoading, error } = useCreatorByUsername(username);
  const walletAddress = creator?.walletAddress ? normalizeAddress("STARKNET", creator.walletAddress) : null;

  const { orders,      isLoading: ordersLoading      } = useUserOrders(activeTab === "listings"    ? walletAddress : null);
  const { collections, isLoading: collectionsLoading } = useCollectionsByOwner(walletAddress);
  const { activities,  isLoading: activitiesLoading  } = useActivitiesByAddress(walletAddress);

  const activeListings = orders.filter((o) => o.status === "ACTIVE" && o.offer.itemType === "ERC721");

  const avatarUrl = creator?.avatarImage ? ipfsToHttp(creator.avatarImage) : null;

  if (isLoading) {
    return (
      <div className="pb-20 min-h-screen">
        <div className="px-6 pt-20 pb-6">
          <CreatorHeader creator={null} image={null} stats={[]} loading />
        </div>
        <div className="px-6 pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <CollectionCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

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


  return (
    <div className="pb-20 min-h-screen">

      <div className="px-6">
        <div className="pt-20 pb-6">
          <CreatorHeader
            creator={creator}
            image={avatarUrl}
            stats={[
              { label: "Collections", value: collectionsLoading ? null : collections.length },
              { label: "Listed", value: ordersLoading ? null : activeListings.length },
              { label: "Events", value: activitiesLoading ? null : activities.length },
            ]}
          >
            <Button size="sm" variant="outline" asChild className="w-fit">
              <Link href={`/account/${creator.walletAddress}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Full profile
              </Link>
            </Button>
          </CreatorHeader>
        </div>

        <div className="sticky top-0 z-10 -mx-6 px-6 bg-background/95 backdrop-blur-sm border-b border-border mt-4">
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
                  {isActive && <span className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">

          {activeTab === "collections" && (
            collectionsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <CollectionCardSkeleton key={i} />)}
              </div>
            ) : collections.length === 0 ? (
              <TabEmptyState icon={LayoutList} heading="No collections yet" body="This creator hasn't deployed any collections on Medialane yet." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((c) => <CollectionCard key={c.contractAddress} collection={c} />)}
              </div>
            )
          )}

          {activeTab === "listings" && (
            ordersLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : activeListings.length === 0 ? (
              <TabEmptyState icon={ShoppingBag} heading="No active listings" body="This creator has no IP assets listed for sale right now." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeListings.map((o) => <ListingCard key={o.orderHash} order={o} />)}
              </div>
            )
          )}

          {activeTab === "analytics" && (
            <div className="max-w-2xl">
              <CreatorAnalytics activities={activities} isLoading={activitiesLoading} />
            </div>
          )}

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
                <TabEmptyState icon={Activity} heading="No activity yet" body="On-chain events for this creator will appear here as they happen." />
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
