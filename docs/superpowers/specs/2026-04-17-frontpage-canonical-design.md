# Frontpage Canonical Layout — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Port all medialane-io frontpage sections into `@medialane/ui` as display-only prop-driven components, then rebuild medialane-dapp's homepage to use them — establishing a single canonical frontpage layout shared by both apps.

**Source of truth:** medialane-io. All display logic, markup, and aesthetics come from io's versions. The dapp is brought up to parity.

**Architecture:** Display-only package components. Each component receives data as props. Apps keep thin data wrappers (hook → props → package component). No hooks, no SWR, no backend calls inside `@medialane/ui`.

**Tech stack:** Next.js 15, React 19, Tailwind CSS, framer-motion, `@medialane/sdk` types, lucide-react.

---

## Canonical Frontpage Layout

Both apps will render this section order identically:

```
1. HeroSlider          — full-bleed collection feature slider (Ken Burns + auto-advance)
2. ActivityTicker      — live horizontal order pill strip
3. TrendingCollections — collections carousel (ScrollSection + CollectionCard)
4. NewOnMarketplace    — listings carousel (ScrollSection + ListingCard)
5. LaunchpadGrid       — Creator Launchpad service card grid (8 feature tiles)
6. CommunityActivity   — live activity feed (ActivityFeedShell + ActivityRow rows)
7. LearnDocsCta        — Learn + Docs CTA card pair
```

The only differences between apps are the href targets and `features`/`cards` data constants passed as props.

---

## Package Changes — `@medialane/ui` v0.3.0

### New utility

**`src/utils/time.ts`**
- `timeAgo(iso: string): string` — relative time string ("2m ago", "1h ago", etc.)
- Sourced from medialane-io `src/lib/utils.ts` `timeAgo` function

### New data constant

**`src/data/activity.ts`**
- `ACTIVITY_TYPE_CONFIG` — record mapping activity type string → `{ label, variant, icon, colorClass, bgClass }`
- `TYPE_FILTERS` — array of `{ label, value }` for filter UI
- Sourced from medialane-io `src/lib/activity.ts` (identical content)

### New components

#### `src/components/hero-slider.tsx`
Exports: `HeroSlider`, `HeroSliderSkeleton`

```ts
interface HeroSliderProps {
  collections: ApiCollection[];
  isLoading: boolean;
  getHref: (collection: ApiCollection) => string;
}
```

- Full-bleed `section` with Ken Burns CSS animation on background image
- Cross-fade between slides (`opacity` transition, `absolute inset-0`)
- Auto-advances every 7s, pauses on hover
- Prev/next arrow buttons (visible when `count > 1`)
- Dot indicator bar (pill expands on active)
- `HeroPlaceholder` shown when `collections.length === 0` (brand gradient + aurora blobs)
- `HeroSliderSkeleton` — `animate-pulse` full-bleed section at same height
- Source: medialane-io `hero-slider.tsx` (identical to dapp version; clean and extract)
- No app-specific imports — uses only `next/image`, `next/link`, lucide, `ApiCollection` type

#### `src/components/activity-ticker.tsx`
Exports: `ActivityTicker`

```ts
interface ActivityTickerProps {
  orders: ApiOrder[];           // active listings shown as pills
  minItems?: number;            // hide ticker if fewer items (default: 3)
  className?: string;
}
```

- Horizontal infinite scroll strip (`animation: scroll-strip 50s linear infinite`)
- Duplicates orders array for seamless loop (`[...orders, ...orders]`)
- Pauses on hover (`animationPlayState`)
- Each pill: token thumbnail (8×8 rounded-lg) + name (truncate 100px) + price in `text-brand-orange`
- Pills link to `/asset/:contract/:tokenId`
- Returns `null` if `orders.length < minItems`
- Source: medialane-io `activity-ticker.tsx` — remove `useOrders` hook, accept `orders` as prop
- Depends on: `CurrencyIcon` (already in package), `formatDisplayPrice` (already in package), `ipfsToHttp` (already in package)

#### `src/components/listing-card.tsx`
Exports: `ListingCard`, `ListingCardSkeleton`

```ts
interface ListingCardProps {
  order: ApiOrder;
  inCart?: boolean;
  onBuy?: (order: ApiOrder) => void;
  onCart?: (order: ApiOrder) => void;
  overflowMenu?: React.ReactNode;   // app constructs DropdownMenu, passes in
  compact?: boolean;
}
```

- Same callback-driven pattern as `TokenCard` — no `useCart`, no `ReportDialog`, no `useRouter` inside
- Full variant: square image + name + price + action bar (`Buy` animated border button, cart icon, overflow slot)
- Compact variant: square image + name + price only, no actions
- `Buy` button uses `btn-border-animated` CSS class (animated gradient border, defined in each app's globals.css)
- Cart button: `onCart` callback, `inCart` controls checked state and orange highlight
- `overflowMenu` slot: rendered as the third button in the action bar — app passes `<DropdownMenu>` with full menu items (View asset, Make offer, Remix, View collection, Report, etc.)
- Image fallback: gradient placeholder with `#tokenId` monospace
- Source: medialane-io `listing-card.tsx` — remove `useCart`, `useRouter`, `ReportDialog`; replace with callbacks + slot
- Depends on: `MotionCard` (already in package), `CurrencyIcon`, `formatDisplayPrice`, `ipfsToHttp` (all in package)

#### `src/components/activity-row.tsx`
Exports: `ActivityRow`

```ts
interface ActivityRowProps {
  activity: ApiActivity;
  token?: { name?: string; image?: string };  // optional enrichment — fallback to #tokenId
  showActor?: boolean;     // default: true
  showExplorer?: boolean;  // default: true — links to explorerUrl prop
  compact?: boolean;       // default: false — tighter padding
  explorerUrl?: string;    // base explorer URL (e.g. "https://voyager.online")
  getAssetHref?: (contract: string, tokenId: string) => string;
  getActorHref?: (address: string) => string;
}
```

- Color-coded type icon (from `ACTIVITY_TYPE_CONFIG`) + token thumbnail + name + actor address + price + time
- `token` prop provides name/image — if absent, shows `#tokenId` fallback (no internal `useToken` hook)
- `explorerUrl` + `activity.txHash` build the Voyager link (shown on row hover when `showExplorer`)
- `getAssetHref` / `getActorHref` — navigation callbacks; defaults: `/asset/:contract/:tokenId`, `/creator/:address`
- Compact mode: tighter padding (`py-2.5` vs `py-3.5`), no badge
- Source: medialane-io `activity-row.tsx` — remove `useToken`, `EXPLORER_URL`, `AddressDisplay` import (already in package); accept `token` + `explorerUrl` + href callbacks as props
- Depends on: `AddressDisplay` (already in package), `CurrencyIcon`, `ACTIVITY_TYPE_CONFIG`, `timeAgo`, `formatDisplayPrice`

#### `src/components/activity-feed-shell.tsx`
Exports: `ActivityFeedShell`

```ts
interface ActivityFeedShellProps {
  title: string;
  href: string;
  hrefLabel?: string;       // default: "Activities"
  lastUpdated: string;      // ISO timestamp — rendered as "Updated X ago"
  isLoading: boolean;
  children: React.ReactNode;
}
```

- Section header: live-pulse icon (indigo gradient) + title + "Updated X ago" subline + ghost link button
- Live pulse: `animate-ping` emerald dot on top-right of icon
- Loading state: 6-row skeleton (icon placeholder + name + amount + time)
- Empty state: centered `Activity` icon + "No activity yet" message
- `children` rendered inside `bento-cell` with `divide-y divide-border/40`
- Source: medialane-io / dapp `community-activity.tsx` — extract shell, leave data in app

#### `src/components/launchpad-grid.tsx`
Exports: `LaunchpadGrid`, `FeatureItem` type

```ts
interface FeatureItem {
  icon: React.ElementType;   // lucide icon component
  label: string;
  subtitle: string;
  accent: string;            // Tailwind gradient e.g. "from-violet-500 to-purple-600"
  href: string;
}

interface LaunchpadGridProps {
  title?: string;            // default: "Creator Launchpad"
  titleHref?: string;        // default: "/launchpad"
  titleHrefLabel?: string;   // default: "All services"
  features: FeatureItem[];
}
```

- Section header: small icon + title + ghost "All services →" link
- Horizontal scroll strip (`overflow-x-auto scrollbar-hide`, `snap-x snap-mandatory`)
- Each card: `aspect-[3/4]` gradient panel with radial highlight + large decorative background icon + small icon top-left + label + subtitle bottom
- Cards link to `feature.href`
- Source: medialane-io `airdrop-section.tsx` (the service card grid version — io's canonical)

#### `src/components/cta-card-grid.tsx`
Exports: `CtaCardGrid`, `CtaCardItem` type

```ts
interface CtaCardItem {
  icon: React.ElementType;
  title: string;
  description: string;
  links: { label: string; href: string }[];
  href: string;
  gradient: string;          // Tailwind gradient class on hover bg overlay
  iconGradient: string;      // Tailwind gradient + shadow class on icon pill
}

interface CtaCardGridProps {
  cards: CtaCardItem[];
}
```

- 2-column grid (`grid-cols-1 sm:grid-cols-2`)
- Each card: `bento-cell` with gradient hover overlay + icon pill + title + description + link list + "Explore →" button
- Link list: `ArrowRight` icon reveals on hover (`group-hover/link:opacity-100`)
- Source: dapp `learn-docs-cta.tsx` — parameterise `CtaCard` into data-driven array

### Updated files

**`src/index.ts`** — add all new exports under a `// ── v0.3 additions ──` section

**`package.json`** — bump version `0.2.0` → `0.3.0`

---

## medialane-dapp Changes

### `src/components/home/index.tsx`
Canonical layout matching medialane-io exactly:

```tsx
export function HomePage() {
  return (
    <div className="pb-20">
      <HeroSlider />
      <div className="container mx-auto px-4 sm:px-6 pt-6">
        <ActivityTicker />
      </div>
      <div className="container mx-auto px-4 sm:px-6 space-y-20 mt-16">
        <TrendingCollections />
        <NewOnMarketplace />
        <AirdropSection />
        <CommunityActivity />
        <LearnDocsCta />
      </div>
    </div>
  );
}
```

### Thin data wrappers (stay in dapp)

**`src/components/home/hero-slider.tsx`**
```tsx
export function HeroSlider() {
  const { collections, isLoading } = useCollections(1, 3, true, "recent");
  return (
    <HeroSliderDisplay
      collections={collections}
      isLoading={isLoading}
      getHref={col => `/collections/${col.contractAddress}`}
    />
  );
}
```

**`src/components/home/activity-ticker.tsx`** *(new file)*
```tsx
export function ActivityTicker() {
  const { orders } = useOrders({ status: "ACTIVE", sort: "recent", limit: 14 });
  return <ActivityTickerDisplay orders={orders} />;
}
```

**`src/components/home/trending-collections.tsx`** — already thin; minor cleanup only

**`src/components/home/new-on-marketplace.tsx`**
```tsx
export function NewOnMarketplace() {
  const { orders, isLoading } = useOrders({ status: "ACTIVE", limit: 10, page: 1 });
  const [buyOrder, setBuyOrder] = useState<ApiOrder | null>(null);
  const listings = orders.filter(o => o.offer.itemType === "ERC721").slice(0, 10);
  return (
    <>
      <ScrollSection icon={...} title="New listings" href="/marketplace" linkLabel="Marketplace">
        {isLoading
          ? skeletons
          : listings.map(order => (
              <div key={order.orderHash} className="w-72 snap-start shrink-0">
                <ListingCard
                  order={order}
                  inCart={cartItems.some(i => i.orderHash === order.orderHash)}
                  onBuy={() => setBuyOrder(order)}
                  onCart={order => addItem(...)}
                  overflowMenu={<ListingOverflowMenu order={order} />}
                />
              </div>
            ))}
      </ScrollSection>
      {buyOrder && <PurchaseDialog ... />}
    </>
  );
}
```

**`src/components/home/airdrop-section.tsx`** — replace current stat strip with `LaunchpadGrid` using io's FEATURES constant

**`src/components/home/community-activity.tsx`**
```tsx
export function CommunityActivity() {
  const { activities, isLoading } = useActivities({ limit: 10 });
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString());
  // tick effect...
  return (
    <ActivityFeedShell title="Community" href="/activities" lastUpdated={lastUpdated} isLoading={isLoading}>
      {activities.map((act, i) => (
        <ActivityRow
          key={...}
          activity={act}
          showActor
          showExplorer={false}
          compact
          explorerUrl={EXPLORER_URL}
          getAssetHref={(c, t) => `/asset/${c}/${t}`}
          getActorHref={a => `/creator/${a}`}
        />
      ))}
    </ActivityFeedShell>
  );
}
```

**`src/components/home/learn-docs-cta.tsx`**
```tsx
const CARDS: CtaCardItem[] = [
  { icon: BookOpen, title: "Learn", description: "...", links: LEARN_LINKS,
    href: "https://www.medialane.io/learn",
    gradient: "bg-gradient-to-br from-brand-purple to-brand-blue",
    iconGradient: "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/20" },
  { icon: FileCode2, title: "Docs", description: "...", links: DOCS_LINKS,
    href: "https://www.medialane.io/docs",
    gradient: "bg-gradient-to-br from-brand-blue to-brand-navy",
    iconGradient: "bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/20" },
];

export function LearnDocsCta() {
  return <CtaCardGrid cards={CARDS} />;
}
```

### `src/components/marketplace/listing-card.tsx`
Updated to use `ListingCard` from `@medialane/ui`, with a local `ListingOverflowMenu` component that assembles the dapp-specific dropdown (View asset, Buy, Cart, Make offer, Remix, View collection, Report, Transfer).

### `src/components/shared/` facade files
Add `activity-row.tsx`, `activity-ticker.tsx`, `activity-feed-shell.tsx` re-exports from `@medialane/ui` (same facade pattern as existing shared components).

---

## What Does NOT Change

- `src/components/shared/activity-row.tsx` in dapp — currently a local component; becomes a facade re-export
- `src/components/shared/activity-ticker.tsx` — does not exist in dapp yet; created as facade re-export
- `TrendingCollections` data wrapper — already correctly thin; only minor cleanup
- medialane-io homepage — **not touched in this phase**; io is the source; dapp is being brought to parity

---

## CSS Unification — `@medialane/ui/styles`

Both apps' `globals.css` files are **100% identical** from line 99 onward. All shared CSS moves into the package as a standalone stylesheet. Apps replace ~200 lines of duplicated CSS with a single import.

### What moves to the package

**New file: `src/styles/medialane.css`** — all shared, pure-CSS classes:
- Scrollbar styling (`::-webkit-scrollbar`, `.scrollbar-hide`, `.scrollbar-none`)
- Glass effects (`.glass`, `.glass-light`)
- Typography gradients (`.gradient-text`, `.gradient-text-warm`, `.gradient-text-gold`)
- Price value (`.price-value`)
- Section label (`.section-label`)
- Pill badge (`.pill-badge`)
- Aurora blobs (`.aurora-purple/blue/rose/orange` + dark variants)
- Card primitives (`.card-base`, `.bento-cell`, `.bg-grid`)
- Snap scroll utilities (`.snap-x-mandatory`, `.snap-start`)
- All keyframes: `float`, `blob-pulse`, `blob-pulse-slow`, `shimmer`, `pulse-glow`, `spin-slow`, `digit-in`, `scroll-strip`, `kenburns`, `border-flow`
- All animate utilities: `.animate-float`, `.animate-blob`, `.animate-blob-slow`, `.animate-pulse-glow`, `.animate-spin-slow`, `.animate-sparkle`, `.animate-kenburns`
- Reduced motion override block
- Input number spinner suppression
- `btn-border-animated`

### tsup config change

Add CSS entry to `tsup.config.ts`:
```ts
entry: ["src/index.ts", "src/styles/medialane.css"],
```
Output: `dist/medialane.css`

### package.json exports addition

```json
"exports": {
  ".": { "import": "./dist/index.js", "require": "./dist/index.cjs", "types": "./dist/index.d.ts" },
  "./styles": "./dist/medialane.css"
}
```

### What stays in each app's globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@import "@medialane/ui/styles";   /* ← replaces ~200 lines */

@layer base {
  :root { /* app-specific HSL theme tokens */ }
  .dark { /* app-specific dark tokens */ }
  * { @apply border-border; }
  html, body { overflow-x: clip; max-width: 100%; }
  body { @apply bg-background text-foreground; font-feature-settings: "rlig" 1, "calt" 1; }
  h1, h2, h3, h4 { @apply tracking-tight; }
}
```

---

## Pre-implementation Fixes (incorporated into plan)

### Fix A: ActivityRow N+1 fetch elimination
`ActivityRow` in io currently calls `useToken(contract, tokenId)` internally — 10 API calls for 10 activity rows on the community section. The package version accepts `token?: { name?: string; image?: string }` as an optional prop. Homepage wrapper passes `undefined`; fallback shows `#tokenId`. Zero extra API calls. Significant performance improvement.

### Fix B: ActivityTicker data decoupling
`ActivityTicker` in io calls `useOrders()` internally. Package version accepts `orders: ApiOrder[]` as a prop. App wrapper calls `useOrders` and passes down. Keeps hook logic in the app.

### Fix C: ListingCard hook decoupling
`ListingCard` in io embeds `useCart()`, `useRouter()`, and `ReportDialog`. Package version uses callback pattern matching `TokenCard`: `inCart`, `onCart`, `onBuy`, `overflowMenu` slot. App constructs the dropdown and passes it in. No cart state, no router, no dialogs inside the package.

---

## Version & Publishing

- `@medialane/ui` bumped: `0.2.0` → `0.3.0`
- Build + publish after all package components pass `npx tsc --noEmit`
- dapp updates `@medialane/ui` to `^0.3.0` in `package.json`
- medialane-dapp build must pass clean before pushing

---

## Dependency Summary

| Dependency | Already in package | Action |
|---|---|---|
| `ApiCollection`, `ApiOrder`, `ApiActivity` types | Yes (peer: `@medialane/sdk`) | None |
| `CurrencyIcon`, `CurrencyAmount` | Yes | None |
| `AddressDisplay` | Yes | None |
| `MotionCard` | Yes | None |
| `ScrollSection` | Yes | None |
| `CollectionCard` | Yes | None |
| `formatDisplayPrice`, `ipfsToHttp`, `cn` | Yes | None |
| `timeAgo` | No | Add to `src/utils/time.ts` |
| `ACTIVITY_TYPE_CONFIG`, `TYPE_FILTERS` | No | Add to `src/data/activity.ts` |
