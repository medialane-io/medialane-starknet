# Discover Page Port Design

## Goal

Port medialane-io's Discover page display components into `@medialane/ui` v0.3.2, then rebuild medialane-dapp's Discover page as thin data-wrapper shells around those package components — exactly as was done with the frontpage canonical port.

## Context

The Discover page in both apps currently contains identical display + data-fetching logic in the same components. `FeaturedCarousel` exists in both apps but is unused dead code. This port extracts display logic into the package and activates `FeaturedCarousel` as part of the discover layout.

---

## Architecture

Same pattern as frontpage port:

- **`@medialane/ui`** — display-only components. No hooks, no API calls. Receive all data as props with callback props for navigation hrefs.
- **`medialane-dapp/src/components/discover/`** — thin wrappers. Each file fetches its own data and passes it to the package component.
- **`medialane-dapp/src/components/discover/index.tsx`** — assembles all wrappers into the page layout (no package `DiscoverPage` shell needed).

---

## Package Components (`@medialane/ui`)

### `DiscoverHero`

**File:** `src/components/discover-hero.tsx`

**Props:**
```ts
interface DiscoverHeroProps {
  stats: { collections: number; tokens: number; sales: number } | null;
  orders: ApiOrder[]; // passed to ActivityTicker
}
```

**Renders:** Animated headline (`KineticWords` + `gradient-text`), `pill-badge`, stats chips (collections / assets / sales), `ActivityTicker` (already in package). Uses Framer Motion for entrance animations. Matches medialane-io's `Hero` exactly.

---

### `FeaturedCarousel`

**File:** `src/components/featured-carousel.tsx`

**Props:**
```ts
interface FeaturedCarouselProps {
  collections: ApiCollection[];
  isLoading: boolean;
  getHref: (collection: ApiCollection) => string;
}
```

**Renders:** Full-width aspect-ratio-constrained (`aspect-[16/7] sm:aspect-[21/9]`) animated slide carousel for featured collections. `AnimatePresence` slide transitions, prev/next buttons, dot indicators, hover-pause. Returns `null` when `collections.length === 0` and not loading. Matches medialane-io's `FeaturedCarousel` with `getHref` replacing hardcoded `/collections/` links. Exports `FeaturedCarouselSkeleton` for the loading state.

---

### `DiscoverCollectionsStrip`

**File:** `src/components/discover-collections-strip.tsx`

**Props:**
```ts
interface DiscoverCollectionsStripProps {
  collections: ApiCollection[];
  isLoading: boolean;
  getHref: (collection: ApiCollection) => string;
}
```

**Renders:** Section header ("NFT" label + "Collections" title + "View all" link), horizontal snap-scroll strip of `CollectionChip` cards (w-80, aspect-square image, name + supply + floor price). `CollectionChipSkeleton` for loading. Note: `CollectionChip` here is a simpler, wider card than `CollectionCard` — kept as an internal sub-component, not exported separately. Gradient fallback when no image.

---

### `DiscoverCreatorsStrip`

**File:** `src/components/discover-creators-strip.tsx`

**Props:**
```ts
interface DiscoverCreatorsStripProps {
  creators: ApiCreatorProfile[];
  isLoading: boolean;
  getHref: (creator: ApiCreatorProfile) => string;
}
```

**Renders:** Section header ("Creator network" label + "Creators" title + "View all" link), horizontal snap-scroll strip of `CreatorChip` cards (w-64, aspect-[3/4]). Avatar + banner from `avatarImage`/`bannerImage` fields via `ipfsToHttp`. **No `useCollectionsByOwner` fallback** — creators without images get a deterministic HSL gradient derived from username. Returns `null` when not loading and `creators.length === 0`.

---

### `DiscoverFeedSection`

**File:** `src/components/discover-feed-section.tsx`

**Props:**
```ts
interface DiscoverFeedSectionProps {
  orders: ApiOrder[];
  isLoading: boolean;
  activities: ApiActivity[];
  activitiesLoading: boolean;
  lastUpdated: string;
  getAssetHref: (contract: string, tokenId: string) => string;
  getActorHref: (address: string) => string;
  explorerUrl: string;
}
```

**Renders:** 2-column grid (`grid-cols-1 lg:grid-cols-2 gap-8`). Left: "Markets / Activity" section header + 3-col grid of `ListingCard` (already in package) with skeleton and empty state. Right: `ActivityFeedShell` + `ActivityRow` list (both already in package). Both columns wrapped in `FadeIn`.

---

## Dapp Thin Wrappers

### `src/components/discover/hero.tsx`
Fetches `usePlatformStats()` + `useOrders({ status: "ACTIVE", sort: "recent", limit: 14 })` → `<DiscoverHero>`.

### `src/components/discover/featured-carousel.tsx`
Fetches `useCollections(1, 12, true, "recent")` (isFeatured) → `<FeaturedCarousel>`.

### `src/components/discover/collections-strip.tsx`
Fetches `useCollections(1, 8)` → `<DiscoverCollectionsStrip>`.

### `src/components/discover/creators-strip.tsx`
Fetches `useCreators(undefined, 1, 10)` → `<DiscoverCreatorsStrip>`.

### `src/components/discover/feed-section.tsx`
Fetches `useOrders({ status: "ACTIVE", sort: "recent", limit: 6 })` + `useActivities({ limit: 10 })` + manages `lastUpdated` state → `<DiscoverFeedSection>`.

### `src/components/discover/index.tsx`
Assembles all wrappers:
```tsx
export function DiscoverPage() {
  return (
    <div className="container mx-auto px-4 pt-10 pb-16 space-y-10">
      <Hero />
      <FeaturedCarousel />
      <CollectionsStrip />
      <FeedSection />
      <CreatorsStrip />
    </div>
  );
}
```

---

## Package Exports (`src/index.ts`)

Add to existing exports:
```ts
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

---

## Package Version

`0.3.1` → `0.3.2`

---

## Key Constraints

- No hooks, no `useSWR`, no API calls inside any package component.
- `FeaturedCarousel` returns `null` (not a skeleton) when `isLoading: false` and `collections` is empty — avoids empty section in the layout.
- `DiscoverCreatorsStrip` returns `null` when not loading and `creators` is empty.
- All `ipfs://` URIs resolved via `ipfsToHttp` utility already in the package.
- Framer Motion is already a peer dependency of `@medialane/ui` (used in `motion-primitives.tsx`).
- `BRAND` color constants used in medialane-io are Tailwind class strings — inline them directly in the package components (e.g. `text-brand-blue`) rather than importing a `BRAND` object.
- After publishing `0.3.2`, update `package.json` in medialane-dapp and run `npm install @medialane/ui@0.3.2 --legacy-peer-deps`.
