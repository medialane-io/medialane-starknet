# Dapp Missing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port three incomplete or missing product pages in medialane-dapp: upgrade `/creator/[address]` username route to a full 4-tab profile, add the `/claim` hub, and add a Disconnect Wallet section to `/portfolio/settings`.

**Architecture:** Each task is self-contained. Task 1 rewrites one existing file in place. Task 2 creates four new files. Task 3 adds ~15 lines to an existing file. All three use existing hooks and components — no new hooks are needed.

**Tech Stack:** Next.js 15 App Router, React 19, starknet-react, starknetkit, SWR, Tailwind, shadcn/ui, lucide-react, sonner

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Modify** | `src/app/creator/[address]/creator-username-client.tsx` | Full 4-tab creator profile for username routes |
| **Create** | `src/app/claim/page.tsx` | Server component — metadata + `<ClaimPageClient />` |
| **Create** | `src/app/claim/claim-page-client.tsx` | Hub layout: Genesis Mint, Collection, Username, Branded page |
| **Create** | `src/components/claim/wallet-gate.tsx` | Blur-overlay wallet gate (replaces Clerk ClaimGate) |
| **Create** | `src/components/claim/claim-collection-panel.tsx` | Collection import panel (no Clerk JWT) |
| **Modify** | `src/app/portfolio/settings/page.tsx` | Add Account / Disconnect section at bottom |

---

## Task 1: Upgrade `/creator/[username]` to Full 4-Tab Profile

**Files:**
- Modify: `src/app/creator/[address]/creator-username-client.tsx` (full rewrite, ~430 lines)

The file currently renders a 159-line simplified layout (two sections: collections + assets). Rewrite it to match the cinematic profile already in `src/app/creator/[address]/creator-page-client.tsx` (645 lines), adapted to start from a username instead of an address.

**Key difference from address-based page:**
- `useCreatorByUsername(username)` → `{ creator, walletAddress }` (instead of reading `address` from `useParams`)
- `creator.walletAddress` drives all downstream hooks
- The "full profile" CTA links to `/account/${creator.walletAddress}` (already in the current 159-line version)
- No `ReportDialog` or `HiddenContentBanner` — keep the username profile lighter
- 4 tabs only (no "Assets" tab — spec calls for Collections, Listings, Analytics, Activity)

**Tab definitions:**

| Tab | Hook | Component |
|-----|------|-----------|
| Collections | `useCollectionsByOwner(walletAddress)` | `CollectionCard` grid |
| Listings | `useUserOrders(walletAddress)` filtered to `status === "ACTIVE"` | `ListingCard` |
| Analytics | `useActivitiesByAddress(walletAddress)` | `CreatorAnalytics` |
| Activity | `useActivitiesByAddress(walletAddress)` | `ActivityRow` timeline |

---

- [ ] **Step 1: Rewrite `creator-username-client.tsx`**

Replace the entire file content with:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { toast } from "sonner";
import { useCreatorByUsername } from "@/hooks/use-username-claims";
import { useUserOrders } from "@/hooks/use-orders";
import { useActivitiesByAddress } from "@/hooks/use-activities";
import { useCollectionsByOwner } from "@/hooks/use-collections";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { CollectionCard, CollectionCardSkeleton } from "@/components/shared/collection-card";
import { CreatorAnalytics } from "@/components/creator/creator-analytics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo, formatDisplayPrice, ipfsToHttp, normalizeAddress } from "@/lib/utils";
import {
  Tag, Handshake, TrendingUp, ArrowRightLeft, Activity,
  LayoutList, ShoppingBag, BarChart2,
  AtSign, Globe, Twitter, MessageCircle, Send,
  ExternalLink, Share2, Sparkles,
} from "lucide-react";
import type { ApiActivity } from "@medialane/sdk";
import { cn } from "@/lib/utils";

// ─── Address color identity ───────────────────────────────────────────────────

function addressPalette(address: string) {
  const seed = parseInt(address.slice(2, 10) || "a1b2c3d4", 16);
  const h1 = seed % 360;
  const h2 = (h1 + 137) % 360;
  const h3 = (h1 + 73) % 360;
  return { h1, h2, h3 };
}

// ─── Activity feed ────────────────────────────────────────────────────────────

const ACTIVITY_META: Record<string, { label: string; textColor: string; bg: string }> = {
  mint:      { label: "Minted",    textColor: "text-yellow-400",  bg: "bg-yellow-500/8 border-yellow-500/15" },
  listing:   { label: "Listed",    textColor: "text-violet-400",  bg: "bg-violet-500/8 border-violet-500/15" },
  sale:      { label: "Sold",      textColor: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15" },
  offer:     { label: "Offer",     textColor: "text-amber-400",   bg: "bg-amber-500/8 border-amber-500/15" },
  transfer:  { label: "Transfer",  textColor: "text-blue-400",    bg: "bg-blue-500/8 border-blue-500/15" },
  cancelled: { label: "Cancelled", textColor: "text-muted-foreground", bg: "bg-muted/30 border-border" },
};

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  mint:      Sparkles,
  listing:   Tag,
  sale:      Handshake,
  offer:     TrendingUp,
  transfer:  ArrowRightLeft,
  cancelled: ArrowRightLeft,
};

function ActivityRow({ event, isLast }: { event: ApiActivity; isLast: boolean }) {
  const meta = ACTIVITY_META[event.type] ?? ACTIVITY_META.transfer;
  const Icon = ACTIVITY_ICONS[event.type] ?? ArrowRightLeft;
  const tokenId = event.nftTokenId ?? event.tokenId;
  const contract = event.nftContract ?? event.contractAddress;

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center shrink-0 w-9">
        <div className={cn("h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105", meta.bg)}>
          <Icon className={cn("h-3.5 w-3.5", meta.textColor)} />
        </div>
        {!isLast && <div className="flex-1 w-px bg-border/50 mt-1.5 min-h-4" />}
      </div>
      <div className="flex-1 pb-5 min-w-0 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn("text-[11px] font-bold uppercase tracking-wider", meta.textColor)}>
                {meta.label}
              </span>
              {contract && tokenId ? (
                <Link href={`/asset/${contract}/${tokenId}`} className="text-xs text-muted-foreground font-mono hover:text-foreground transition-colors">
                  Token #{tokenId}
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground font-mono">Token #{tokenId ?? "—"}</span>
              )}
            </div>
            {contract && (
              <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5 truncate">
                {contract.slice(0, 10)}…{contract.slice(-6)}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            {event.price?.formatted && (
              <p className="text-sm font-semibold price-value leading-none">
                {formatDisplayPrice(event.price.formatted)}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(event.timestamp)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const { imgRef, dynamicTheme } = useDominantColor(bannerUrl);

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
      <div className="container mx-auto px-4 py-24 max-w-lg text-center space-y-4">
        <p className="text-5xl">🔍</p>
        <h1 className="text-2xl font-bold">Creator not found</h1>
        <p className="text-muted-foreground">
          <span className="font-mono">@{username}</span> hasn&apos;t been claimed yet or doesn&apos;t exist.
        </p>
        <Button variant="outline" asChild>
          <Link href="/marketplace">Browse Marketplace</Link>
        </Button>
      </div>
    );
  }

  const displayName = creator.displayName || `@${creator.username}`;

  return (
    <div className="pb-20 min-h-screen" style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}>
      {/* Hidden extraction image for dominant color */}
      {bannerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={imgRef} src={bannerUrl} crossOrigin="anonymous" aria-hidden alt="" style={{ display: "none" }} />
      )}

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
                <span className="text-xs font-mono text-muted-foreground">@{creator.username}</span>
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
          {(creator.websiteUrl || creator.twitterUrl || creator.discordUrl || creator.telegramUrl) && (
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
              {creator.discordUrl && (
                <a href={creator.discordUrl} target="_blank" rel="noopener noreferrer"
                  className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors" title="Discord">
                  <MessageCircle className="h-3.5 w-3.5" />
                </a>
              )}
              {creator.telegramUrl && (
                <a href={creator.telegramUrl} target="_blank" rel="noopener noreferrer"
                  className="h-8 w-8 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors" title="Telegram">
                  <Send className="h-3.5 w-3.5" />
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
                        background: dynamicTheme
                          ? `linear-gradient(90deg, hsl(var(--dynamic-primary)), hsl(var(--dynamic-accent)))`
                          : `linear-gradient(90deg, hsl(${h1}, 68%, 62%), hsl(${h2}, 68%, 58%))`,
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors in `creator-username-client.tsx`. If `creator.discordUrl` or `creator.telegramUrl` are not in the `ApiCreatorProfile` type, remove those social link blocks.

- [ ] **Step 3: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/app/creator/[address]/creator-username-client.tsx
git commit -m "feat: upgrade creator username profile to full 4-tab cinematic layout"
```

---

## Task 2: Add `/claim` Hub

**Files:**
- Create: `src/app/claim/page.tsx`
- Create: `src/app/claim/claim-page-client.tsx`
- Create: `src/components/claim/wallet-gate.tsx`
- Create: `src/components/claim/claim-collection-panel.tsx`

---

- [ ] **Step 4: Create `src/components/claim/wallet-gate.tsx`**

```tsx
"use client";

import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useConnect } from "@starknet-react/core";
import { StarknetkitConnector, useStarknetkitConnectModal } from "starknetkit";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface WalletGateProps {
  children: React.ReactNode;
}

export function WalletGate({ children }: WalletGateProps) {
  const { isConnected } = useUnifiedWallet();
  const { connectAsync, connectors } = useConnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
    modalTheme: "dark",
  });

  const handleConnect = async () => {
    try {
      const { connector } = await starknetkitConnectModal();
      if (!connector) return;
      await connectAsync({ connector });
    } catch { /* user closed modal */ }
  };

  if (isConnected) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred children preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-background/60 backdrop-blur-[2px]">
        <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-center px-4">Connect wallet to access this claim</p>
        <Button onClick={handleConnect} className="bg-violet-600 hover:bg-violet-700 text-white">
          Connect wallet
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/claim/claim-collection-panel.tsx`**

Port of io's `ClaimCollectionPanel` with Clerk JWT removed. The `walletAddress` comes from `useUnifiedWallet()`. The API call passes `""` as the token (backend verifies on-chain ownership directly, consistent with how `portfolio/settings` calls `updateCreatorProfile`).

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { getMedialaneClient } from "@/lib/medialane-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "input" | "verifying" | "success" | "manual" | "pending";

function StepIndicator({ step }: { step: Step }) {
  const atStep2 = step === "manual" || step === "pending";
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
          !atStep2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>1</div>
        <span className={cn("text-sm", !atStep2 ? "text-foreground font-medium" : "text-muted-foreground")}>
          Verify ownership
        </span>
      </div>
      <div className="w-8 h-px bg-border shrink-0" />
      <div className="flex items-center gap-2">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
          atStep2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>2</div>
        <span className={cn("text-sm", atStep2 ? "text-foreground font-medium" : "text-muted-foreground")}>
          Confirm claim
        </span>
      </div>
    </div>
  );
}

export function ClaimCollectionPanel() {
  const { address: walletAddress } = useUnifiedWallet();
  const [contractAddress, setContractAddress] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [verifyError, setVerifyError] = useState("");
  const [claimedCollection, setClaimedCollection] = useState<{
    contractAddress: string;
    name?: string | null;
  } | null>(null);

  async function handleAutoClaim() {
    if (!contractAddress.trim() || !walletAddress) {
      toast.error("Connect your wallet first");
      return;
    }
    setStep("verifying");
    try {
      // Backend verifies on-chain ownership — no JWT required
      const result = await getMedialaneClient().api.claimCollection(
        contractAddress.trim(),
        walletAddress,
        ""
      );
      if (result.verified) {
        setClaimedCollection(result.collection ?? { contractAddress: contractAddress.trim() });
        setStep("success");
      } else {
        setVerifyError(result.reason ?? "Could not verify onchain ownership");
        setStep("manual");
      }
    } catch {
      setVerifyError("Verification failed");
      setStep("manual");
    }
  }

  async function handleManualRequest() {
    if (!email.trim()) { toast.error("Email is required"); return; }
    try {
      await getMedialaneClient().api.requestCollectionClaim({
        contractAddress: contractAddress.trim(),
        walletAddress: walletAddress ?? undefined,
        email: email.trim(),
        notes: notes.trim() || undefined,
      });
      setStep("pending");
    } catch {
      toast.error("Failed to submit request");
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <StepIndicator step={step} />

      {step === "success" && (
        <div className="rounded-xl border border-green-500/40 bg-green-500/5 p-5 space-y-4">
          <div>
            <p className="font-semibold text-foreground">Collection claimed successfully</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your collection is verified and added to your portfolio.
            </p>
          </div>
          {claimedCollection && (
            <div className="rounded-lg bg-muted/50 px-3 py-2">
              <p className="text-sm font-medium">{claimedCollection.name ?? "Collection"}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                {claimedCollection.contractAddress}
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <Button asChild size="sm">
              <Link href="/portfolio/collections">View in Portfolio</Link>
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={() => { setContractAddress(""); setClaimedCollection(null); setStep("input"); }}
            >
              Claim Another
            </Button>
          </div>
        </div>
      )}

      {step === "pending" && (
        <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-2">
          <p className="font-semibold text-foreground">Claim under review</p>
          <p className="text-sm text-muted-foreground">
            Our team will verify ownership within 24–48 hours. You&apos;ll be notified at {email} once processed.
          </p>
        </div>
      )}

      {(step === "input" || step === "verifying") && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="contract">Contract address</Label>
            <Input
              id="contract"
              placeholder="0x…"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              disabled={step === "verifying"}
            />
            <p className="text-xs text-muted-foreground">
              Paste the Starknet ERC-721 contract address you own.
            </p>
          </div>
          <Button
            onClick={handleAutoClaim}
            disabled={step === "verifying" || !contractAddress.trim()}
            className="w-full"
          >
            {step === "verifying"
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying…</>
              : "Verify & Claim"
            }
          </Button>
        </div>
      )}

      {step === "manual" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1">
            <p className="text-sm font-medium text-foreground">Manual verification required</p>
            <p className="text-xs text-muted-foreground">
              {verifyError}. Submit a request for our team to review.
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Your email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Tell us about your connection to this collection</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="e.g. I deployed this contract on Starknet mainnet…" />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleManualRequest} className="flex-1">Submit Request</Button>
              <Button variant="outline" onClick={() => setStep("input")}>Back</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/app/claim/claim-page-client.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Package, Globe, Share2, ShieldCheck, Palette, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletGate } from "@/components/claim/wallet-gate";
import { ClaimCollectionPanel } from "@/components/claim/claim-collection-panel";
import { UsernameClaimPanel } from "@/components/shared/username-claim-panel";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function ClaimPageClient() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-12 max-w-5xl space-y-16 pb-20">
      {/* Page header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
            <Package className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-3xl font-black">Claims & Drops</h1>
        </div>
        <p className="text-muted-foreground">
          Exclusive drops, collections and creator pages available on Medialane.
        </p>
      </div>

      {/* Section 1 — Genesis Mint */}
      <section className="space-y-8">
        <SectionDivider label="Genesis drop" />
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Package className="h-5 w-5 text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">Genesis NFT</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The Medialane Genesis NFT is the first collection minted on our launchpad.
                Holders get early access, governance rights, and exclusive creator perks.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
            <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white">
              <Link href="/launchpad/drop">
                View Genesis Drop <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Section 2 — NFT Collection */}
      <section className="space-y-8">
        <SectionDivider label="Claim your collection" />
        <div>
          <h2 className="text-xl font-bold mb-1">NFT Collection</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Import an existing Starknet ERC-721 collection into your Medialane profile.
          </p>
          <WalletGate>
            <ClaimCollectionPanel />
          </WalletGate>
        </div>
      </section>

      {/* Section 3 — Creator Username */}
      <section className="space-y-8">
        <SectionDivider label="Claim your creator page" />
        <div>
          <h2 className="text-xl font-bold mb-1">Creator Username</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Reserve your creator URL at{" "}
            <span className="font-mono text-foreground">medialane.io/creator/yourname</span>.
          </p>
          <WalletGate>
            <UsernameClaimPanel />
          </WalletGate>
        </div>
      </section>

      {/* Section 4 — Branded Collection Page */}
      <section className="space-y-8">
        <SectionDivider label="Your collection page" />
        <div>
          <h2 className="text-xl font-bold mb-1">Branded Drop Page</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Every collection you deploy on Medialane gets a fully branded, shareable page — no setup required.
          </p>
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-5">
            {/* URL bar mockup */}
            <div className="flex items-center gap-2 bg-muted/50 border border-border/60 rounded-lg px-3 py-2 font-mono text-sm max-w-md">
              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-xs">medialane.io/collections/</span>
              <span className="text-foreground text-xs font-semibold truncate">0x04f5…1a3b</span>
            </div>
            {/* Feature grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Palette className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Fully branded</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Custom name, cover image, banner, and social links — all editable in collection settings.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Share2 className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">One shareable link</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Share your collection, assets, and listings in a single URL — perfect for social and email.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Always accessible</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Permanently anchored on Starknet. No central authority can remove it.</p>
                </div>
              </div>
            </div>
            {/* CTAs */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
              <Button size="sm" asChild>
                <Link href="/create/collection">
                  Create a collection <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/collections">Browse collections</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/app/claim/page.tsx`**

```tsx
import type { Metadata } from "next";
import { ClaimPageClient } from "./claim-page-client";

export const metadata: Metadata = {
  title: "Claims & Drops — Medialane",
  description: "Claim your Genesis NFT, import your Starknet collection, or reserve your creator username on Medialane.",
};

export default function ClaimPage() {
  return <ClaimPageClient />;
}
```

- [ ] **Step 8: Verify TypeScript**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors in any of the four files. Common issue: `getMedialaneClient().api.claimCollection` or `requestCollectionClaim` may not be typed in the SDK — if so, cast the call with `as any` and add `// @ts-expect-error SDK type gap` above.

- [ ] **Step 9: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/app/claim/page.tsx src/app/claim/claim-page-client.tsx \
        src/components/claim/wallet-gate.tsx src/components/claim/claim-collection-panel.tsx
git commit -m "feat: add /claim hub with wallet gate, collection import, and username claim"
```

---

## Task 3: Portfolio Settings — Add Disconnect Wallet

**Files:**
- Modify: `src/app/portfolio/settings/page.tsx`

The file already imports `useUnifiedWallet`. We need to add `useRouter` and `LogOut`, then append an Account section after the existing Save button.

---

- [ ] **Step 10: Add LogOut + useRouter imports to `src/app/portfolio/settings/page.tsx`**

Find the existing import block. The file currently has:
```tsx
import { AtSign, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
```

Replace with:
```tsx
import { AtSign, CheckCircle2, Clock, XCircle, Loader2, LogOut } from "lucide-react";
```

Also find:
```tsx
import { useState, useEffect } from "react";
```
Replace with:
```tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
```

- [ ] **Step 11: Destructure `disconnect` and initialise `router` in `ProfileSettingsPage`**

Find the top of the function body in `ProfileSettingsPage`:
```tsx
  const { address: walletAddress } = useUnifiedWallet();
```

Replace with:
```tsx
  const { address: walletAddress, disconnect } = useUnifiedWallet();
  const router = useRouter();
```

- [ ] **Step 12: Append Account section after the Save button**

Find the existing Save button near the bottom of the JSX:
```tsx
      <Button onClick={handleSave} disabled={saving || !walletAddress || profileLoading}>
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
      </Button>
```

Replace with:
```tsx
      <Button onClick={handleSave} disabled={saving || !walletAddress || profileLoading}>
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Changes"}
      </Button>

      {/* Account */}
      <div className="space-y-4 pt-4 border-t border-border">
        <div>
          <h3 className="text-sm font-semibold">Account</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your wallet connection</p>
        </div>
        <Button
          variant="outline"
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={() => { disconnect(); router.push("/"); }}
        >
          <LogOut className="h-4 w-4" />
          Disconnect wallet
        </Button>
      </div>
```

- [ ] **Step 13: Verify TypeScript**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 14: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/app/portfolio/settings/page.tsx
git commit -m "feat: add disconnect wallet section to portfolio settings"
```

---

## Task 4: Build Check + Push

- [ ] **Step 15: Run production build**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npm run build 2>&1 | tail -30
```

Expected: `Route (app)` table printed, exit 0. If any build error references the new files, fix before continuing.

- [ ] **Step 16: Push to main**

```bash
cd /Users/kalamaha/dev/medialane-dapp && git push origin main
```

Expected: `Branch 'main' set up to track remote branch 'main' from 'origin'.`
