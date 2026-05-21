# Discover Page Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port medialane-io's Discover page display components into `@medialane/ui` v0.3.2, then rebuild medialane-dapp's Discover page as thin data-wrapper shells around those package components — exactly as was done with the frontpage port.

**Architecture:** Package components are display-only (no hooks, no API calls, props in). Dapp thin wrappers each fetch their own data and pass it to the package component. The dapp's `discover/index.tsx` assembles wrappers — no package-level DiscoverPage shell needed.

**Tech Stack:** React 19, Next.js 15, Framer Motion, Tailwind CSS, `@medialane/sdk` types, tsup build, npm publish.

---

## File Map

### `@medialane/ui` — new files to create
| File | Responsibility |
|---|---|
| `src/components/discover-hero.tsx` | Animated headline, pill badge, stats chips, ActivityTicker |
| `src/components/featured-carousel.tsx` | Full-width animated slide carousel for featured collections |
| `src/components/discover-collections-strip.tsx` | Horizontal snap-scroll strip of CollectionChip cards |
| `src/components/discover-creators-strip.tsx` | Horizontal snap-scroll strip of CreatorChip cards |
| `src/components/discover-feed-section.tsx` | 2-col grid: listings grid (left) + ActivityFeedShell (right) |

### `@medialane/ui` — files to modify
| File | Change |
|---|---|
| `src/index.ts` | Add exports for all 5 new components + their types |
| `package.json` | Bump version `0.3.1` → `0.3.2` |

### `medialane-dapp` — files to replace
| File | Responsibility |
|---|---|
| `src/components/discover/hero.tsx` | Fetch usePlatformStats + useOrders → `<DiscoverHero>` |
| `src/components/discover/featured-carousel.tsx` | Fetch useCollections(isFeatured) → `<FeaturedCarousel>` |
| `src/components/discover/collections-strip.tsx` | Fetch useCollections → `<DiscoverCollectionsStrip>` |
| `src/components/discover/creators-strip.tsx` | Fetch useCreators → `<DiscoverCreatorsStrip>` |
| `src/components/discover/feed-section.tsx` | Fetch useOrders + useActivities → `<DiscoverFeedSection>` |
| `src/components/discover/index.tsx` | Add `<FeaturedCarousel>` to layout (currently missing) |
| `package.json` | Update `@medialane/ui` to `0.3.2` |

---

## Task 1: `DiscoverHero` package component

**Files:**
- Create: `medialane-ui/src/components/discover-hero.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { motion } from "framer-motion";
import { KineticWords, EASE_OUT } from "./motion-primitives.js";
import { ActivityTicker } from "./activity-ticker.js";
import type { ApiOrder } from "@medialane/sdk";

export interface DiscoverHeroProps {
  stats: { collections: number; tokens: number; sales: number } | null;
  orders: ApiOrder[];
  badgeText?: string;
  headlineText?: string;
}

export function DiscoverHero({
  stats,
  orders,
  badgeText = "Creative Works",
  headlineText = "Create, share & explore",
}: DiscoverHeroProps) {
  return (
    <div className="space-y-6 pt-2 pb-6 border-b border-border/50">
      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        <span className="pill-badge">{badgeText}</span>
      </motion.div>

      {/* Headline */}
      <motion.div
        className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1]"
        style={{ perspective: "800px" }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
      >
        <span className="gradient-text">
          <KineticWords text={headlineText} />
        </span>
      </motion.div>

      {/* Stats chips */}
      {stats && (
        <motion.div
          className="flex flex-wrap gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35, ease: EASE_OUT }}
        >
          {[
            { label: "Collections", value: stats.collections },
            { label: "Assets", value: stats.tokens },
            { label: "Sales", value: stats.sales },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm"
            >
              <span className="font-bold tabular-nums">{value?.toLocaleString() ?? "—"}</span>
              <span className="text-muted-foreground">{label}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Scrolling ticker */}
      <ActivityTicker orders={orders} />
    </div>
  );
}
```

- [ ] **Step 2: Verify ActivityTicker accepts `orders` prop**

Check `medialane-ui/src/components/activity-ticker.tsx` to confirm the `ActivityTickerProps` interface. If the ticker takes `orders: ApiOrder[]` as a prop, the above code is correct. If it takes `limit: number` (and fetches internally), switch to `<ActivityTicker limit={orders.length || 10} />` and remove the `orders` prop from `DiscoverHeroProps`.

Run:
```bash
head -30 /Users/kalamaha/dev/medialane-ui/src/components/activity-ticker.tsx
```

Adjust the component accordingly before proceeding.

- [ ] **Step 3: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/discover-hero.tsx
git commit -m "feat: add DiscoverHero to @medialane/ui"
```

---

## Task 2: `FeaturedCarousel` package component

**Files:**
- Create: `medialane-ui/src/components/featured-carousel.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from "lucide-react";
import { FadeIn, EASE_OUT } from "./motion-primitives.js";
import { ipfsToHttp } from "../utils/ipfs.js";
import { formatDisplayPrice } from "../utils/format.js";
import type { ApiCollection } from "@medialane/sdk";

export interface FeaturedCarouselProps {
  collections: ApiCollection[];
  isLoading: boolean;
  getHref: (collection: ApiCollection) => string;
  allCollectionsHref?: string;
}

function Slide({ collection, href }: { collection: ApiCollection; href: string }) {
  const name = collection.name ?? "Featured Collection";
  const image = collection.image ? ipfsToHttp(collection.image) : null;

  return (
    <div className="relative w-full h-full">
      {image ? (
        <img
          src={image}
          alt={name}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/30 via-brand-blue/20 to-brand-navy/40" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8 lg:p-10">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight mb-3 max-w-lg">
          {name}
        </h2>
        <div className="flex items-center gap-4 mb-5">
          {collection.totalSupply != null && (
            <span className="text-sm text-white/70">
              <span className="font-bold text-white">{collection.totalSupply}</span> items
            </span>
          )}
          {collection.floorPrice && (
            <span className="text-sm text-white/70">
              Floor{" "}
              <span className="font-bold text-brand-orange">
                {formatDisplayPrice(collection.floorPrice)}
              </span>
            </span>
          )}
        </div>
        <a
          href={href}
          className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm transition-colors"
        >
          View Collection <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export function FeaturedCarouselSkeleton() {
  return (
    <FadeIn>
      <section className="space-y-4">
        <div className="flex items-center gap-2 mt-0.5">
          <Sparkles className="h-4 w-4 text-brand-purple" />
          <h2 className="text-xl font-bold">Featured Collections</h2>
        </div>
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 aspect-[16/7] sm:aspect-[21/9] bg-muted animate-pulse" />
      </section>
    </FadeIn>
  );
}

export function FeaturedCarousel({
  collections,
  isLoading,
  getHref,
  allCollectionsHref = "/collections",
}: FeaturedCarouselProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = collections.length;

  const next = useCallback(() => setActive((p) => (p + 1) % total), [total]);
  const prev = useCallback(() => setActive((p) => (p - 1 + total) % total), [total]);

  useEffect(() => { setActive(0); }, [total]);

  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setInterval(next, 6000);
    return () => clearInterval(id);
  }, [next, paused, total]);

  if (isLoading) return <FeaturedCarouselSkeleton />;
  if (total === 0) return null;

  return (
    <FadeIn>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 mt-0.5">
            <Sparkles className="h-4 w-4 text-brand-purple" />
            <h2 className="text-xl font-bold">Featured Collections</h2>
          </div>
          <a
            href={allCollectionsHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div
          className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden aspect-[16/7] sm:aspect-[21/9] bg-muted"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              className="absolute inset-0"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            >
              <Slide collection={collections[active]} href={getHref(collections[active])} />
            </motion.div>
          </AnimatePresence>

          {total > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors z-10"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors z-10"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {total > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
              {collections.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === active ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </FadeIn>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/featured-carousel.tsx
git commit -m "feat: add FeaturedCarousel to @medialane/ui"
```

---

## Task 3: `DiscoverCollectionsStrip` package component

**Files:**
- Create: `medialane-ui/src/components/discover-collections-strip.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Layers, ArrowRight } from "lucide-react";
import { FadeIn } from "./motion-primitives.js";
import { ipfsToHttp } from "../utils/ipfs.js";
import { formatDisplayPrice } from "../utils/format.js";
import type { ApiCollection } from "@medialane/sdk";

export interface DiscoverCollectionsStripProps {
  collections: ApiCollection[];
  isLoading: boolean;
  getHref: (collection: ApiCollection) => string;
  allCollectionsHref?: string;
}

function CollectionChipSkeleton() {
  return (
    <div className="shrink-0 w-80 rounded-xl border border-border overflow-hidden">
      <div className="aspect-square w-full bg-muted animate-pulse" />
      <div className="p-3 space-y-1.5">
        <div className="h-3.5 w-28 bg-muted animate-pulse rounded" />
        <div className="h-3 w-16 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}

function CollectionChip({
  collection,
  href,
}: {
  collection: ApiCollection;
  href: string;
}) {
  const [imgError, setImgError] = useState(false);
  const image = collection.image && !imgError ? ipfsToHttp(collection.image) : null;
  const initial = (collection.name ?? "?").charAt(0).toUpperCase();

  return (
    <a
      href={href}
      className="block shrink-0 w-80 snap-start active:scale-[0.97] transition-transform duration-150"
    >
      <div className="rounded-xl border border-border overflow-hidden group bg-card hover:border-border/80 transition-colors">
        <div className="aspect-square bg-muted relative overflow-hidden">
          {image ? (
            <img
              src={image}
              alt={collection.name ?? ""}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/30 via-brand-blue/20 to-brand-navy/40 flex items-center justify-center">
              <span className="text-5xl font-black text-white/10 select-none">{initial}</span>
            </div>
          )}
        </div>
        <div className="p-3 space-y-0.5">
          <p className="text-sm font-semibold truncate">{collection.name ?? "Unnamed"}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{collection.totalSupply ?? 0} items</span>
            {collection.floorPrice && (
              <span className="font-semibold text-brand-orange">
                {formatDisplayPrice(collection.floorPrice)}
              </span>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

export function DiscoverCollectionsStrip({
  collections,
  isLoading,
  getHref,
  allCollectionsHref = "/collections",
}: DiscoverCollectionsStripProps) {
  return (
    <FadeIn>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-label">NFT</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Layers className="h-4 w-4 text-brand-blue" />
              <h2 className="text-lg font-bold">Collections</h2>
            </div>
          </div>
          <a
            href={allCollectionsHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-3 w-max pb-1">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <CollectionChipSkeleton key={i} />)
              : collections.map((col) => (
                  <CollectionChip key={col.contractAddress} collection={col} href={getHref(col)} />
                ))}
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/discover-collections-strip.tsx
git commit -m "feat: add DiscoverCollectionsStrip to @medialane/ui"
```

---

## Task 4: `DiscoverCreatorsStrip` package component

**Files:**
- Create: `medialane-ui/src/components/discover-creators-strip.tsx`

- [ ] **Step 1: Create the component**

The key difference from medialane-io's `CreatorsStrip`: no `useCollectionsByOwner` fallback. Creators without images get a deterministic HSL gradient from username. This eliminates the N+1 pattern.

```tsx
"use client";

import { useState } from "react";
import { Users, ArrowRight, AtSign } from "lucide-react";
import { FadeIn } from "./motion-primitives.js";
import { ipfsToHttp } from "../utils/ipfs.js";
import type { ApiCreatorProfile } from "@medialane/sdk";

export interface DiscoverCreatorsStripProps {
  creators: ApiCreatorProfile[];
  isLoading: boolean;
  getHref: (creator: ApiCreatorProfile) => string;
  allCreatorsHref?: string;
}

function hslGradient(seed: string) {
  const hue = seed.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const hue2 = (hue + 60) % 360;
  return `linear-gradient(135deg, hsl(${hue},55%,35%), hsl(${hue2},50%,22%))`;
}

function CreatorChipSkeleton() {
  return (
    <div className="shrink-0 w-64 aspect-[3/4] rounded-xl bg-muted animate-pulse" />
  );
}

function CreatorChip({
  creator,
  href,
}: {
  creator: ApiCreatorProfile;
  href: string;
}) {
  const [avatarError, setAvatarError] = useState(false);
  const [bannerError, setBannerError] = useState(false);

  const avatarUrl = creator.avatarImage && !avatarError ? ipfsToHttp(creator.avatarImage) : null;
  const bannerUrl = creator.bannerImage && !bannerError ? ipfsToHttp(creator.bannerImage) : null;
  const displayName = creator.displayName || `@${creator.username}`;
  const gradient = hslGradient(creator.username ?? "a");

  return (
    <a
      href={href}
      className="block shrink-0 w-64 snap-start active:scale-[0.97] transition-transform duration-150 select-none"
    >
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            aria-hidden
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setBannerError(true)}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: gradient }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-2.5 space-y-1.5">
          <div
            className="h-8 w-8 rounded-full ring-2 ring-white/20 overflow-hidden flex items-center justify-center"
            style={!avatarUrl ? { background: gradient } : {}}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <span className="text-xs font-black text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-bold text-white text-xs truncate">{displayName}</p>
            <p className="text-[10px] text-white/55 flex items-center gap-0.5">
              <AtSign className="h-2 w-2 shrink-0" />
              <span className="truncate">{creator.username}</span>
            </p>
          </div>
        </div>
      </div>
    </a>
  );
}

export function DiscoverCreatorsStrip({
  creators,
  isLoading,
  getHref,
  allCreatorsHref = "/creators",
}: DiscoverCreatorsStripProps) {
  if (!isLoading && creators.length === 0) return null;

  return (
    <FadeIn>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="section-label">Creator network</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Users className="h-4 w-4 text-brand-purple" />
              <h2 className="text-lg font-bold">Creators</h2>
            </div>
          </div>
          <a
            href={allCreatorsHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-3 w-max pb-1">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <CreatorChipSkeleton key={i} />)
              : creators.map((c) => (
                  <CreatorChip key={c.walletAddress} creator={c} href={getHref(c)} />
                ))}
          </div>
        </div>
      </div>
    </FadeIn>
  );
}
```

- [ ] **Step 2: Verify `ApiCreatorProfile` fields**

Run:
```bash
cd /Users/kalamaha/dev/medialane-sdk && grep -n "ApiCreatorProfile" src/types/api.ts 2>/dev/null || grep -rn "ApiCreatorProfile" src/
```

Confirm the type has `walletAddress`, `username`, `displayName`, `avatarImage`, `bannerImage` fields. If field names differ, adjust accordingly.

- [ ] **Step 3: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/discover-creators-strip.tsx
git commit -m "feat: add DiscoverCreatorsStrip to @medialane/ui (no N+1 useCollectionsByOwner)"
```

---

## Task 5: `DiscoverFeedSection` package component

**Files:**
- Create: `medialane-ui/src/components/discover-feed-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { Tag } from "lucide-react";
import { FadeIn } from "./motion-primitives.js";
import { ListingCard, ListingCardSkeleton } from "./listing-card.js";
import { ActivityFeedShell } from "./activity-feed-shell.js";
import { ActivityRow } from "./activity-row.js";
import type { ApiOrder, ApiActivity } from "@medialane/sdk";

export interface DiscoverFeedSectionProps {
  orders: ApiOrder[];
  isLoading: boolean;
  activities: ApiActivity[];
  activitiesLoading: boolean;
  lastUpdated: string;
  getAssetHref: (contract: string, tokenId: string) => string;
  getActorHref: (address: string) => string;
  explorerUrl: string;
  marketplaceHref?: string;
  activitiesHref?: string;
}

export function DiscoverFeedSection({
  orders,
  isLoading,
  activities,
  activitiesLoading,
  lastUpdated,
  getAssetHref,
  getActorHref,
  explorerUrl,
  marketplaceHref = "/marketplace",
  activitiesHref = "/activities",
}: DiscoverFeedSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* New Listings */}
      <FadeIn>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Markets</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Tag className="h-4 w-4 text-brand-rose" />
                <h2 className="text-lg font-bold">Activity</h2>
              </div>
            </div>
            <a
              href={marketplaceHref}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
            >
              View all
            </a>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <ListingCardSkeleton key={i} />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-xl border border-border py-12 text-center text-sm text-muted-foreground">
              No active listings yet.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {orders.map((o) => (
                <ListingCard
                  key={o.orderHash}
                  order={o}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      {/* Recent Activity */}
      <FadeIn delay={0.08}>
        <ActivityFeedShell
          title="Community"
          href={activitiesHref}
          hrefLabel="Activities"
          lastUpdated={lastUpdated}
          isLoading={activitiesLoading}
        >
          {activities.map((act, i) => {
            const key = act.txHash
              ? `${act.txHash}-${act.type}-${act.nftTokenId ?? ""}`
              : `activity-${i}`;
            return (
              <ActivityRow
                key={key}
                activity={act}
                showActor
                showExplorer={false}
                compact
                getAssetHref={getAssetHref}
                getActorHref={getActorHref}
                explorerUrl={explorerUrl}
              />
            );
          })}
        </ActivityFeedShell>
      </FadeIn>
    </div>
  );
}
```

- [ ] **Step 2: Check ActivityRow props**

Run:
```bash
head -40 /Users/kalamaha/dev/medialane-ui/src/components/activity-row.tsx
```

Confirm the `ActivityRowProps` interface — specifically whether it takes `getAssetHref`, `getActorHref`, `explorerUrl` as props or uses hardcoded links. If `ActivityRow` uses hardcoded links internally (does not accept href callbacks), remove those props from `DiscoverFeedSectionProps` and from the `<ActivityRow>` call.

- [ ] **Step 3: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/discover-feed-section.tsx
git commit -m "feat: add DiscoverFeedSection to @medialane/ui"
```

---

## Task 6: Update exports, bump version, build, publish

**Files:**
- Modify: `medialane-ui/src/index.ts`
- Modify: `medialane-ui/package.json`

- [ ] **Step 1: Add exports to `src/index.ts`**

Open `medialane-ui/src/index.ts` and append after the last export line:

```ts
// ── v0.3.2 additions ─────────────────────────────────────────────────────────
export { DiscoverHero } from "./components/discover-hero.js";
export type { DiscoverHeroProps } from "./components/discover-hero.js";
export { FeaturedCarousel, FeaturedCarouselSkeleton } from "./components/featured-carousel.js";
export type { FeaturedCarouselProps } from "./components/featured-carousel.js";
export { DiscoverCollectionsStrip } from "./components/discover-collections-strip.js";
export type { DiscoverCollectionsStripProps } from "./components/discover-collections-strip.js";
export { DiscoverCreatorsStrip } from "./components/discover-creators-strip.js";
export type { DiscoverCreatorsStripProps } from "./components/discover-creators-strip.js";
export { DiscoverFeedSection } from "./components/discover-feed-section.js";
export type { DiscoverFeedSectionProps } from "./components/discover-feed-section.js";
```

- [ ] **Step 2: Bump version in `package.json`**

Change `"version": "0.3.1"` → `"version": "0.3.2"` in `medialane-ui/package.json`.

- [ ] **Step 3: Build**

```bash
cd /Users/kalamaha/dev/medialane-ui
~/.bun/bin/bun run build
```

Expected: build completes with no TypeScript errors. If type errors appear, fix them before publishing.

- [ ] **Step 4: Publish**

```bash
cd /Users/kalamaha/dev/medialane-ui
npm publish
```

Expected: `+ @medialane/ui@0.3.2`

- [ ] **Step 5: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/index.ts package.json
git commit -m "release: @medialane/ui v0.3.2 — discover page components"
```

---

## Task 7: Replace dapp thin wrappers

**Files:**
- Modify: `medialane-dapp/src/components/discover/hero.tsx`
- Replace: `medialane-dapp/src/components/discover/featured-carousel.tsx`
- Modify: `medialane-dapp/src/components/discover/collections-strip.tsx`
- Modify: `medialane-dapp/src/components/discover/creators-strip.tsx`
- Modify: `medialane-dapp/src/components/discover/feed-section.tsx`
- Modify: `medialane-dapp/src/components/discover/index.tsx`

- [ ] **Step 1: Install updated package**

```bash
cd /Users/kalamaha/dev/medialane-dapp
npm install @medialane/ui@0.3.2 --legacy-peer-deps
```

Expected: `@medialane/ui@0.3.2` appears in `node_modules`.

- [ ] **Step 2: Rewrite `hero.tsx`**

Replace the full file contents:

```tsx
"use client";

import { DiscoverHero } from "@medialane/ui";
import { usePlatformStats } from "@/hooks/use-stats";
import { useOrders } from "@/hooks/use-orders";

export function Hero() {
  const { stats } = usePlatformStats();
  const { orders } = useOrders({ status: "ACTIVE", sort: "recent", limit: 14 });

  return (
    <DiscoverHero
      stats={stats ?? null}
      orders={orders}
      badgeText="Powered on Starknet"
      headlineText="Create, license & trade"
    />
  );
}
```

Note: Check if `usePlatformStats` returns `stats` with keys `collections`, `tokens`, `sales`. If different, map them in the wrapper:

```tsx
const mapped = stats
  ? { collections: stats.collections, tokens: stats.tokens, sales: stats.sales }
  : null;
```

- [ ] **Step 3: Rewrite `featured-carousel.tsx`**

Replace the full file contents:

```tsx
"use client";

import { FeaturedCarousel } from "@medialane/ui";
import { useCollections } from "@/hooks/use-collections";
import type { ApiCollection } from "@medialane/sdk";

export function FeaturedCarouselWrapper() {
  const { collections, isLoading } = useCollections(1, 12, true, "recent");

  return (
    <FeaturedCarousel
      collections={collections}
      isLoading={isLoading}
      getHref={(col: ApiCollection) => `/collections/${col.contractAddress}`}
      allCollectionsHref="/collections"
    />
  );
}
```

Export name is `FeaturedCarouselWrapper` to avoid collision with the package export named `FeaturedCarousel`.

- [ ] **Step 4: Rewrite `collections-strip.tsx`**

Replace the full file contents:

```tsx
"use client";

import { DiscoverCollectionsStrip } from "@medialane/ui";
import { useCollections } from "@/hooks/use-collections";
import type { ApiCollection } from "@medialane/sdk";

export function CollectionsStrip() {
  const { collections, isLoading } = useCollections(1, 8);

  return (
    <DiscoverCollectionsStrip
      collections={collections}
      isLoading={isLoading}
      getHref={(col: ApiCollection) => `/collections/${col.contractAddress}`}
      allCollectionsHref="/collections"
    />
  );
}
```

- [ ] **Step 5: Rewrite `creators-strip.tsx`**

Replace the full file contents:

```tsx
"use client";

import { DiscoverCreatorsStrip } from "@medialane/ui";
import { useCreators } from "@/hooks/use-creators";
import type { ApiCreatorProfile } from "@medialane/sdk";

export function CreatorsStrip() {
  const { creators, isLoading } = useCreators(undefined, 1, 10);

  return (
    <DiscoverCreatorsStrip
      creators={creators}
      isLoading={isLoading}
      getHref={(c: ApiCreatorProfile) => `/creator/${c.username}`}
      allCreatorsHref="/creator"
    />
  );
}
```

Note: confirm the dapp's creators route is `/creator` or `/creators` and adjust `allCreatorsHref` accordingly.

- [ ] **Step 6: Rewrite `feed-section.tsx`**

Replace the full file contents:

```tsx
"use client";

import { useState, useEffect } from "react";
import { DiscoverFeedSection } from "@medialane/ui";
import { useOrders } from "@/hooks/use-orders";
import { useActivities } from "@/hooks/use-activities";
import { EXPLORER_URL } from "@/lib/constants";

export function FeedSection() {
  const { orders, isLoading } = useOrders({ status: "ACTIVE", sort: "recent", limit: 6 });
  const { activities, isLoading: activitiesLoading } = useActivities({ limit: 10 });
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (!activitiesLoading) setLastUpdated(new Date().toISOString());
  }, [activities, activitiesLoading]);

  return (
    <DiscoverFeedSection
      orders={orders}
      isLoading={isLoading}
      activities={activities}
      activitiesLoading={activitiesLoading}
      lastUpdated={lastUpdated}
      getAssetHref={(contract, tokenId) => `/asset/${contract}/${tokenId}`}
      getActorHref={(address) => `/creator/${address}`}
      explorerUrl={EXPLORER_URL}
      marketplaceHref="/marketplace"
      activitiesHref="/activities"
    />
  );
}
```

Note: Import `EXPLORER_URL` from wherever constants live in the dapp (`@/lib/constants`). If that constant doesn't exist, use `process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://voyager.online"` instead.

- [ ] **Step 7: Update `index.tsx` to add `FeaturedCarouselWrapper`**

Replace the full file contents:

```tsx
"use client";

import { Hero } from "./hero";
import { FeaturedCarouselWrapper } from "./featured-carousel";
import { CollectionsStrip } from "./collections-strip";
import { CreatorsStrip } from "./creators-strip";
import { FeedSection } from "./feed-section";

export function DiscoverPage() {
  return (
    <div className="container mx-auto px-4 pt-10 pb-16 space-y-10">
      <Hero />
      <FeaturedCarouselWrapper />
      <CollectionsStrip />
      <FeedSection />
      <CreatorsStrip />
    </div>
  );
}
```

- [ ] **Step 8: Commit all dapp changes**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/discover/
git commit -m "feat: rebuild discover page as thin wrappers around @medialane/ui v0.3.2"
```

---

## Task 8: Type-check and build

- [ ] **Step 1: Type-check dapp**

```bash
cd /Users/kalamaha/dev/medialane-dapp
npx tsc --noEmit
```

Expected: zero errors. If type errors appear:
- Missing `ApiActivity` type: import from `@medialane/sdk`
- Missing `EXPLORER_URL` constant: use env var fallback
- `ActivityRow` prop mismatches: check `ActivityRowProps` in the package and adjust `DiscoverFeedSection` accordingly

Fix all errors before proceeding.

- [ ] **Step 2: Build**

```bash
cd /Users/kalamaha/dev/medialane-dapp
npm run build
```

Expected: build completes without errors. If build fails on missing types or imports, fix and rebuild.

- [ ] **Step 3: Push to deploy**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git push
```

Vercel will autodeploy. Check `dapp.medialane.io/discover` to confirm:
- Hero section with animated headline + stats chips + activity ticker
- Featured carousel showing featured collections (slides auto-advance every 6s)
- Collections strip with horizontal scroll
- Feed section: 3-col listings grid on left, community activity on right
- Creators strip at bottom

---

## Self-Review

**Spec coverage:**
- `DiscoverHero` → Task 1 ✓
- `FeaturedCarousel` → Task 2 ✓
- `DiscoverCollectionsStrip` → Task 3 ✓
- `DiscoverCreatorsStrip` → Task 4 (no N+1) ✓
- `DiscoverFeedSection` → Task 5 ✓
- Package exports + version bump + publish → Task 6 ✓
- All 5 dapp thin wrappers + `index.tsx` update → Task 7 ✓
- Type-check + build + push → Task 8 ✓

**Key verification steps embedded in tasks:**
- Task 1 Step 2: verify `ActivityTicker` props (does it accept `orders` or `limit`)
- Task 4 Step 2: verify `ApiCreatorProfile` field names
- Task 5 Step 2: verify `ActivityRow` prop interface
- Task 7 Step 2: `usePlatformStats` stats shape
- Task 7 Step 5: dapp creators route `/creator` vs `/creators`
- Task 7 Step 6: `EXPLORER_URL` constant location
