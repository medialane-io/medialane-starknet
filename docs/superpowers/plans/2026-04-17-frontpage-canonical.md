# Frontpage Canonical Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port all medialane-io frontpage sections into `@medialane/ui` v0.3.0 as display-only components, unify shared CSS into the package, and rebuild medialane-dapp's homepage with a canonical 7-section layout matching medialane-io.

**Architecture:** Display-only package components receive data as props. Apps keep thin data wrappers (hook → props → package component). Shared CSS moves from duplicated `globals.css` files into `@medialane/ui/styles`. medialane-io is the source of truth for all display logic.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, tsup, `@medialane/sdk` types, lucide-react, framer-motion.

**Repos involved:**
- `medialane-ui` → `/Users/kalamaha/dev/medialane-ui` — package changes (Tasks 1–10)
- `medialane-dapp` → `/Users/kalamaha/dev/medialane-dapp` — app changes (Tasks 11–15)

**Commands:**
- Build package: `cd /Users/kalamaha/dev/medialane-ui && ~/.bun/bin/bun run build`
- Type-check package: `cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit`
- Build dapp: `cd /Users/kalamaha/dev/medialane-dapp && ~/.bun/bin/bun run build`
- Type-check dapp: `cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit`
- Publish: `cd /Users/kalamaha/dev/medialane-ui && npm publish`

---

## File Map

### medialane-ui (create)
- `src/styles/medialane.css` — shared CSS design system (glass, aurora, card-base, animations, etc.)
- `src/utils/time.ts` — `timeAgo(iso: string): string`
- `src/data/activity.ts` — `ACTIVITY_TYPE_CONFIG`, `TYPE_FILTERS`
- `src/components/hero-slider.tsx` — `HeroSlider`, `HeroSliderSkeleton`
- `src/components/activity-ticker.tsx` — `ActivityTicker`
- `src/components/listing-card.tsx` — `ListingCard`, `ListingCardSkeleton`
- `src/components/activity-row.tsx` — `ActivityRow`
- `src/components/activity-feed-shell.tsx` — `ActivityFeedShell`
- `src/components/launchpad-grid.tsx` — `LaunchpadGrid`, `FeatureItem` type
- `src/components/cta-card-grid.tsx` — `CtaCardGrid`, `CtaCardItem` type

### medialane-ui (modify)
- `tsup.config.ts` — add `onSuccess` to copy CSS to `dist/`
- `package.json` — bump `0.2.0` → `0.3.0`, add `./styles` export, add new index exports
- `src/index.ts` — export all new utilities, data, and components

### medialane-dapp (modify)
- `src/app/layout.tsx` — add `import "@medialane/ui/styles";`
- `src/app/globals.css` — remove shared CSS block (lines 99–300); keep only `@tailwind` + `:root`/`.dark` tokens
- `src/components/home/index.tsx` — canonical 7-section layout
- `src/components/home/hero-slider.tsx` — thin wrapper: `useCollections` → `HeroSlider`
- `src/components/home/activity-ticker.tsx` — thin wrapper: `useOrders` → `ActivityTicker` (new file)
- `src/components/home/trending-collections.tsx` — minor cleanup only
- `src/components/home/new-on-marketplace.tsx` — use `ListingCard` from package via dapp wrapper
- `src/components/home/airdrop-section.tsx` — replace stat strip with `LaunchpadGrid`
- `src/components/home/community-activity.tsx` — use `ActivityFeedShell` + `ActivityRow` from package
- `src/components/home/learn-docs-cta.tsx` — use `CtaCardGrid` from package
- `src/components/marketplace/listing-card.tsx` — thin wrapper: wires `useCart` + dropdown into package `ListingCard`
- `src/components/shared/listing-card.tsx` — facade re-export (new file)
- `src/components/shared/activity-row.tsx` — facade re-export (new file)
- `src/components/shared/activity-feed-shell.tsx` — facade re-export (new file)
- `package.json` — update `@medialane/ui` to `^0.3.0`

---

## Task 1: CSS Unification — create `@medialane/ui/styles`

**Files:**
- Create: `medialane-ui/src/styles/medialane.css`
- Modify: `medialane-ui/tsup.config.ts`
- Modify: `medialane-ui/package.json`

- [ ] **Step 1: Create the shared CSS file**

```bash
mkdir -p /Users/kalamaha/dev/medialane-ui/src/styles
```

Create `/Users/kalamaha/dev/medialane-ui/src/styles/medialane.css`:

```css
/* Medialane Design System — shared CSS
   Imported by apps via: import "@medialane/ui/styles"
   Do NOT import @tailwind directives here — apps handle that.
   All classes here are pure CSS, no @apply. */

/* ── Scrollbars ───────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }
.scrollbar-none { scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-hide { scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }

/* ── Glass ────────────────────────────────────────────────────────────── */
.glass {
  background: rgba(10, 14, 30, 0.60);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.glass-light {
  background: rgba(255, 255, 255, 0.80);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

/* ── Typography gradients ─────────────────────────────────────────────── */
.gradient-text {
  background: linear-gradient(135deg, #a855f7 0%, #6366f1 40%, #2563eb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.gradient-text-warm {
  background: linear-gradient(135deg, #f43f5e 0%, #ea580c 60%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.gradient-text-gold {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #ea580c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ── Price ────────────────────────────────────────────────────────────── */
.price-value {
  color: hsl(var(--price));
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* ── Section label ────────────────────────────────────────────────────── */
.section-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

/* ── Pill badge ───────────────────────────────────────────────────────── */
.pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 9999px;
  border: 1px solid hsl(var(--primary) / 0.25);
  background: hsl(var(--primary) / 0.08);
  padding: 0.25rem 0.875rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(var(--primary));
}

/* ── Aurora blobs ─────────────────────────────────────────────────────── */
.aurora-purple { position: absolute; border-radius: 9999px; background: #9333ea; filter: blur(100px); opacity: 0.07; }
.aurora-blue   { position: absolute; border-radius: 9999px; background: #2563eb; filter: blur(120px); opacity: 0.06; }
.aurora-rose   { position: absolute; border-radius: 9999px; background: #f43f5e; filter: blur(100px); opacity: 0.05; }
.aurora-orange { position: absolute; border-radius: 9999px; background: #ea580c; filter: blur(110px); opacity: 0.04; }
.dark .aurora-purple { opacity: 0.15; }
.dark .aurora-blue   { opacity: 0.11; }
.dark .aurora-rose   { opacity: 0.09; }
.dark .aurora-orange { opacity: 0.07; }

/* ── Card primitives ──────────────────────────────────────────────────── */
.card-base {
  border-radius: calc(var(--radius) * 1.25);
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  overflow: hidden;
  will-change: transform;
}
.bento-cell {
  border-radius: calc(var(--radius) * 1.25);
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  overflow: hidden;
  position: relative;
}

/* ── Background grid ──────────────────────────────────────────────────── */
.bg-grid {
  background-image:
    linear-gradient(hsl(var(--border) / 0.4) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--border) / 0.4) 1px, transparent 1px);
  background-size: 48px 48px;
}

/* ── Snap scroll ──────────────────────────────────────────────────────── */
.snap-x-mandatory { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
.snap-start { scroll-snap-align: start; }

/* ── Keyframes ────────────────────────────────────────────────────────── */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
@keyframes blob-pulse {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.07; }
  50% { transform: scale(1.15) rotate(10deg); opacity: 0.14; }
}
@keyframes blob-pulse-slow {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.05; }
  50% { transform: scale(1.2) rotate(-8deg); opacity: 0.11; }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes pulse-glow {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}
@keyframes spin-slow { to { transform: rotate(360deg); } }
@keyframes digit-in {
  from { transform: translateY(-14px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes scroll-strip {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes kenburns {
  0%   { transform: scale(1.0) translate(0%, 0%); }
  100% { transform: scale(1.08) translate(-1.5%, -1%); }
}
@keyframes border-flow {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}

/* ── Animation utilities ──────────────────────────────────────────────── */
.animate-float      { animation: float 5s ease-in-out infinite; }
.animate-blob       { animation: blob-pulse 7s ease-in-out infinite; }
.animate-blob-slow  { animation: blob-pulse-slow 9s ease-in-out infinite 2s; }
.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
.animate-spin-slow  { animation: spin-slow 24s linear infinite; }
.animate-sparkle    { animation: pulse-glow 2.5s ease-in-out infinite; }
.animate-kenburns   { animation: kenburns 8s ease-in-out infinite alternate; transform-origin: center center; }

/* ── Reduced motion ───────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .animate-float, .animate-blob, .animate-blob-slow,
  .animate-pulse-glow, .animate-spin-slow, .animate-sparkle,
  .animate-kenburns { animation: none; }
}

/* ── Input spinners (price inputs use custom suffix) ──────────────────── */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
input[type="number"] { -moz-appearance: textfield; }

/* ── Animated gradient border (marketplace buy button) ────────────────── */
.btn-border-animated {
  background: linear-gradient(270deg, #2563eb, #9333ea, #f43f5e, #ea580c, #2563eb);
  background-size: 300% 300%;
  animation: border-flow 5s ease infinite;
}
```

- [ ] **Step 2: Update tsup.config.ts to copy CSS on build**

Replace `/Users/kalamaha/dev/medialane-ui/tsup.config.ts` with:

```ts
import { defineConfig } from "tsup";
import { copyFileSync } from "fs";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/components/*.tsx", "src/utils/*.ts", "src/data/*.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    bundle: false,
    external: [
      "react", "react-dom", "next", "next-themes",
      "lucide-react", "tailwind-merge", "clsx",
      "framer-motion", "sonner", "@medialane/sdk",
    ],
    outDir: "dist",
    onSuccess: async () => {
      copyFileSync("src/styles/medialane.css", "dist/medialane.css");
      console.log("✓ Copied dist/medialane.css");
    },
  },
  {
    entry: { "preset/tailwind": "src/preset/tailwind.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    splitting: false,
    external: ["tailwindcss"],
    outDir: "dist",
  },
]);
```

- [ ] **Step 3: Update package.json — bump version + add ./styles export**

In `/Users/kalamaha/dev/medialane-ui/package.json`, make two changes:

Change `"version": "0.2.0"` → `"version": "0.3.0"`

Add `"./styles"` to the `exports` field:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "./preset": {
    "types": "./dist/preset/tailwind.d.ts",
    "import": "./dist/preset/tailwind.js",
    "require": "./dist/preset/tailwind.cjs"
  },
  "./styles": "./dist/medialane.css"
},
```

- [ ] **Step 4: Verify CSS builds correctly**

```bash
cd /Users/kalamaha/dev/medialane-ui && ~/.bun/bin/bun run build
```

Expected: build succeeds, `dist/medialane.css` exists with the shared CSS content.

```bash
ls /Users/kalamaha/dev/medialane-ui/dist/medialane.css
```

Expected: file exists, non-zero size.

- [ ] **Step 5: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/styles/medialane.css tsup.config.ts package.json
git commit -m "feat: add @medialane/ui/styles — unified shared CSS design system"
```

---

## Task 2: Add `timeAgo` utility + `ACTIVITY_TYPE_CONFIG` data

**Files:**
- Create: `medialane-ui/src/utils/time.ts`
- Create: `medialane-ui/src/data/activity.ts`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create `src/utils/time.ts`**

```ts
/**
 * Returns a human-readable relative time string.
 * e.g. "just now", "2m ago", "3h ago", "5d ago"
 */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
```

- [ ] **Step 2: Create `src/data/activity.ts`**

```ts
import { ArrowRightLeft, Tag, ShoppingCart, HandCoins, X, Sparkles } from "lucide-react";
import type { ElementType } from "react";

export interface ActivityTypeConfig {
  label: string;
  variant: "default" | "secondary" | "outline";
  icon: ElementType;
  colorClass: string;
  bgClass: string;
}

export const ACTIVITY_TYPE_CONFIG: Record<string, ActivityTypeConfig> = {
  mint:      { label: "Mint",      variant: "default",   icon: Sparkles,       colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10" },
  transfer:  { label: "Transfer",  variant: "secondary", icon: ArrowRightLeft, colorClass: "text-slate-400",   bgClass: "bg-slate-500/10" },
  listing:   { label: "Listed",    variant: "default",   icon: Tag,            colorClass: "text-sky-400",     bgClass: "bg-sky-500/10" },
  sale:      { label: "Sale",      variant: "default",   icon: ShoppingCart,   colorClass: "text-violet-400",  bgClass: "bg-violet-500/10" },
  offer:     { label: "Offer",     variant: "outline",   icon: HandCoins,      colorClass: "text-amber-400",   bgClass: "bg-amber-500/10" },
  cancelled: { label: "Cancelled", variant: "outline",   icon: X,              colorClass: "text-rose-400",    bgClass: "bg-rose-500/10" },
};

export const TYPE_FILTERS = [
  { label: "All",       value: "" },
  { label: "Mints",     value: "mint" },
  { label: "Sales",     value: "sale" },
  { label: "Listings",  value: "listing" },
  { label: "Offers",    value: "offer" },
  { label: "Transfers", value: "transfer" },
  { label: "Cancelled", value: "cancelled" },
];
```

- [ ] **Step 3: Add exports to `src/index.ts`**

Append under a new `// ── v0.3 additions ──` section:

```ts
// ── v0.3 additions ────────────────────────────────────────────────────────────
export { timeAgo } from "./utils/time.js";
export { ACTIVITY_TYPE_CONFIG, TYPE_FILTERS } from "./data/activity.js";
export type { ActivityTypeConfig } from "./data/activity.js";
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/utils/time.ts src/data/activity.ts src/index.ts
git commit -m "feat: add timeAgo utility and ACTIVITY_TYPE_CONFIG data"
```

---

## Task 3: `HeroSlider` component

**Files:**
- Create: `medialane-ui/src/components/hero-slider.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create `src/components/hero-slider.tsx`**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "../utils/cn.js";
import type { ApiCollection } from "@medialane/sdk";

export interface HeroSliderProps {
  collections: ApiCollection[];
  isLoading: boolean;
  getHref: (collection: ApiCollection) => string;
}

function formatDisplayPrice(price: { formatted?: string } | null | undefined): string {
  if (!price?.formatted) return "";
  const n = parseFloat(price.formatted);
  if (isNaN(n)) return price.formatted;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return uri.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
  return uri;
}

function HeroPlaceholder() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/30 via-brand-blue/20 to-brand-navy/50 flex flex-col items-center justify-center gap-4 text-center px-6 overflow-hidden">
      <div className="absolute aurora-purple w-[600px] h-[600px] opacity-20 -top-24 -left-24" />
      <div className="absolute aurora-blue w-[400px] h-[400px] opacity-15 -bottom-16 -right-16" />
      <h2 className="text-4xl sm:text-6xl font-black gradient-text relative z-10">Medialane</h2>
      <p className="text-muted-foreground text-lg relative z-10 max-w-md">
        New monetization revenues for creative works
      </p>
      <div className="flex gap-3 relative z-10">
        <Link href="/marketplace" className="inline-flex items-center justify-center rounded-[11px] bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 active:scale-[0.98] transition-all">
          Markets
        </Link>
        <Link href="/create/asset" className="inline-flex items-center justify-center rounded-[11px] border border-white/20 bg-background/20 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-all">
          Create
        </Link>
      </div>
    </div>
  );
}

function HeroSlide({ collection, active, getHref }: { collection: ApiCollection; active: boolean; getHref: (col: ApiCollection) => string }) {
  const imageUrl = collection.image ? ipfsToHttp(collection.image) : null;
  const name = collection.name ?? "Collection";
  const floor = collection.floorPrice;
  const supply = collection.totalSupply;

  return (
    <div className={cn("absolute inset-0 transition-opacity duration-700", active ? "opacity-100" : "opacity-0 pointer-events-none")}>
      {imageUrl ? (
        <div className="absolute inset-0 overflow-hidden">
          <div className="animate-kenburns absolute inset-0">
            <Image src={imageUrl} alt={name} fill className="object-cover" priority={active} unoptimized />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/40 via-brand-blue/20 to-brand-navy/60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/30 to-black/0" />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10 flex flex-col gap-3">
        <h2 className="text-4xl lg:text-5xl font-semibold text-white leading-tight">{name}</h2>
        <div className="flex items-center gap-4 text-sm text-white/70">
          {supply != null && <span>{supply.toLocaleString()} items</span>}
          {floor && <span className="text-white font-semibold">Floor {formatDisplayPrice(floor)}</span>}
        </div>
        <Link
          href={getHref(collection)}
          className="self-start mt-2 inline-flex items-center gap-1.5 bg-white text-black hover:bg-white/90 font-semibold px-4 py-2 rounded-[11px] text-sm transition-all active:scale-[0.98]"
        >
          View Collection <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export function HeroSliderSkeleton() {
  return <section className="relative w-full h-[78vw] min-h-[420px] max-h-[768px] sm:h-[72vh] sm:max-h-[816px] bg-muted animate-pulse" />;
}

export function HeroSlider({ collections, isLoading, getHref }: HeroSliderProps) {
  const [current, setCurrent] = useState(0);
  const count = collections.length;

  const next = useCallback(() => { if (count > 1) setCurrent((c) => (c + 1) % count); }, [count]);
  const prev = useCallback(() => { if (count > 1) setCurrent((c) => (c - 1 + count) % count); }, [count]);

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(next, 7000);
    return () => clearInterval(id);
  }, [count, next]);

  if (isLoading) return <HeroSliderSkeleton />;

  return (
    <section className="relative w-full h-[78vw] min-h-[420px] max-h-[768px] sm:h-[72vh] sm:max-h-[816px] overflow-hidden bg-muted">
      {count === 0 ? (
        <HeroPlaceholder />
      ) : (
        <>
          {collections.map((col, i) => (
            <HeroSlide key={col.contractAddress} collection={col} active={i === current} getHref={getHref} />
          ))}
          {count > 1 && (
            <>
              <button onClick={prev} aria-label="Previous slide" className="absolute left-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors">
                <ChevronLeft className="h-5 w-5 text-white" />
              </button>
              <button onClick={next} aria-label="Next slide" className="absolute right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors">
                <ChevronRight className="h-5 w-5 text-white" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {collections.map((_, i) => (
                  <button key={i} onClick={() => setCurrent(i)} aria-label={`Go to slide ${i + 1}`} className={cn("h-1.5 rounded-full transition-all", i === current ? "w-6 bg-white" : "w-1.5 bg-white/40")} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add exports to `src/index.ts`**

Append to the v0.3 section in `src/index.ts`:

```ts
export { HeroSlider, HeroSliderSkeleton } from "./components/hero-slider.js";
export type { HeroSliderProps } from "./components/hero-slider.js";
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/hero-slider.tsx src/index.ts
git commit -m "feat: add HeroSlider + HeroSliderSkeleton to @medialane/ui"
```

---

## Task 4: `ActivityTicker` component

**Files:**
- Create: `medialane-ui/src/components/activity-ticker.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create `src/components/activity-ticker.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CurrencyIcon } from "./currency-icon.js";
import { formatDisplayPrice } from "../utils/format.js";
import { ipfsToHttp } from "../utils/ipfs.js";
import { cn } from "../utils/cn.js";
import type { ApiOrder } from "@medialane/sdk";

export interface ActivityTickerProps {
  orders: ApiOrder[];
  /** Hide ticker if fewer items than this threshold. Default: 3 */
  minItems?: number;
  className?: string;
}

function ActivityPill({ listing, getHref }: { listing: ApiOrder; getHref: (order: ApiOrder) => string }) {
  const [imgError, setImgError] = useState(false);
  const image = listing.token?.image && !imgError ? ipfsToHttp(listing.token.image) : null;

  return (
    <Link
      href={getHref(listing)}
      className="flex-shrink-0 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 hover:bg-muted/60 active:scale-[0.98] transition-all duration-150 group"
    >
      <div className="h-8 w-8 rounded-lg overflow-hidden bg-muted shrink-0">
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-purple/20 to-brand-blue/20" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium whitespace-nowrap max-w-[100px] truncate">
          {listing.token?.name ?? `#${listing.nftTokenId}`}
        </p>
        {listing.price && (
          <p className="text-[10px] font-bold text-brand-orange whitespace-nowrap flex items-center gap-0.5">
            <CurrencyIcon symbol={listing.price.currency} size={10} />
            {formatDisplayPrice(listing.price)} {listing.price.currency}
          </p>
        )}
      </div>
    </Link>
  );
}

export function ActivityTicker({ orders, minItems = 3, className }: ActivityTickerProps) {
  if (orders.length < minItems) return null;

  const getHref = (order: ApiOrder) => `/asset/${order.nftContract}/${order.nftTokenId}`;

  return (
    <div className={cn(className)}>
      <div className="relative overflow-hidden py-2.5">
        <div
          className="flex gap-2 w-max px-2"
          style={{ animation: "scroll-strip 50s linear infinite" }}
          onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = "paused")}
          onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = "running")}
        >
          {[...orders, ...orders].map((listing, i) => (
            <ActivityPill key={`${listing.orderHash}-${i}`} listing={listing} getHref={getHref} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add exports to `src/index.ts`**

```ts
export { ActivityTicker } from "./components/activity-ticker.js";
export type { ActivityTickerProps } from "./components/activity-ticker.js";
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
git add src/components/activity-ticker.tsx src/index.ts
git commit -m "feat: add ActivityTicker to @medialane/ui"
```

---

## Task 5: `ListingCard` component

**Files:**
- Create: `medialane-ui/src/components/listing-card.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create `src/components/listing-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Check, MoreHorizontal, Zap } from "lucide-react";
import { MotionCard } from "./motion-primitives.js";
import { CurrencyIcon } from "./currency-icon.js";
import { cn } from "../utils/cn.js";
import { ipfsToHttp } from "../utils/ipfs.js";
import { formatDisplayPrice } from "../utils/format.js";
import { timeAgo } from "../utils/time.js";
import type { ApiOrder } from "@medialane/sdk";

export interface ListingCardProps {
  order: ApiOrder;
  inCart?: boolean;
  onBuy?: (order: ApiOrder) => void;
  onCart?: (order: ApiOrder) => void;
  /** App passes a fully constructed <DropdownMenu> here */
  overflowMenu?: React.ReactNode;
  compact?: boolean;
}

export function ListingCard({ order, inCart = false, onBuy, onCart, overflowMenu, compact = false }: ListingCardProps) {
  const [imgError, setImgError] = useState(false);
  const isListing = order.offer.itemType === "ERC721" || order.offer.itemType === "ERC1155";
  const name = order.token?.name ?? `Token #${order.nftTokenId}`;
  const image = order.token?.image ? ipfsToHttp(order.token.image) : null;
  const assetHref = `/asset/${order.nftContract}/${order.nftTokenId}`;

  const showActionBar = isListing && (onBuy || onCart || overflowMenu);

  // ─── Compact variant ──────────────────────────────────────────────────────
  if (compact) {
    return (
      <MotionCard className="card-base">
        <Link href={assetHref} className="block">
          <div className="relative aspect-square bg-muted overflow-hidden">
            {image && !imgError ? (
              <Image src={image} alt={name} fill unoptimized sizes="(max-width: 640px) 33vw, 20vw" className="object-cover group-hover:scale-105 transition-transform duration-500" onError={() => setImgError(true)} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-purple/15 to-brand-blue/15">
                <span className="text-xl font-mono text-muted-foreground">#{order.nftTokenId}</span>
              </div>
            )}
          </div>
          <div className="p-2.5 space-y-0.5">
            <p className="text-xs font-semibold truncate">{name}</p>
            {order.price && (
              <p className="text-[11px] font-bold price-value">
                {formatDisplayPrice(order.price)} <span className="text-muted-foreground font-normal">{order.price.currency}</span>
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">{timeAgo(order.createdAt)}</p>
          </div>
        </Link>
      </MotionCard>
    );
  }

  // ─── Full variant ─────────────────────────────────────────────────────────
  return (
    <MotionCard className="card-base">
      <Link href={assetHref} className="block">
        <div className="relative aspect-square bg-muted overflow-hidden">
          {image && !imgError ? (
            <Image src={image} alt={name} fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-500" onError={() => setImgError(true)} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-purple/15 to-brand-blue/15">
              <span className="text-2xl font-mono text-muted-foreground">#{order.nftTokenId}</span>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div>
            <p className="font-semibold text-base truncate leading-snug">{name}</p>
            {order.token?.description ? (
              <p className="text-[11px] text-muted-foreground line-clamp-1 leading-snug mt-0.5">{order.token.description}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">#{order.nftTokenId}</p>
            )}
          </div>

          {order.price && (
            <div className="flex items-center gap-1.5">
              <CurrencyIcon symbol={order.price.currency} size={14} />
              <p className="text-lg font-bold price-value leading-none">
                {formatDisplayPrice(order.price)} <span className="text-muted-foreground font-normal text-sm">{order.price.currency}</span>
              </p>
            </div>
          )}

          {showActionBar && (
            <div className="flex items-center gap-1.5">
              {onBuy && (
                <div className="btn-border-animated p-[1.5px] rounded-[10px] flex-1 h-9">
                  <button
                    className="w-full h-full rounded-[9px] bg-background flex items-center justify-center gap-1.5 text-xs font-semibold text-foreground hover:bg-muted/60 transition-all active:scale-[0.98]"
                    onClick={(e) => { e.preventDefault(); onBuy(order); }}
                  >
                    <Zap className="h-3.5 w-3.5 shrink-0" /> Buy
                  </button>
                </div>
              )}
              {onCart && (
                <button
                  className={cn(
                    "h-9 w-9 shrink-0 rounded-[9px] border flex items-center justify-center transition-colors",
                    inCart
                      ? "border-brand-orange/50 bg-brand-orange/10 text-brand-orange"
                      : "border-border bg-background hover:bg-muted text-foreground"
                  )}
                  onClick={(e) => { e.preventDefault(); if (!inCart) onCart(order); }}
                  disabled={inCart}
                  aria-label={inCart ? "Added to cart" : "Add to cart"}
                >
                  {inCart ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
                </button>
              )}
              {overflowMenu}
            </div>
          )}
        </div>
      </Link>
    </MotionCard>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="card-base">
      <div className="aspect-square w-full bg-muted animate-pulse" />
      <div className="p-3 space-y-2.5">
        <div className="space-y-1">
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-6 w-1/2 bg-muted animate-pulse rounded" />
        <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add exports to `src/index.ts`**

```ts
export { ListingCard, ListingCardSkeleton } from "./components/listing-card.js";
export type { ListingCardProps } from "./components/listing-card.js";
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
git add src/components/listing-card.tsx src/index.ts
git commit -m "feat: add callback-driven ListingCard + ListingCardSkeleton to @medialane/ui"
```

---

## Task 6: `ActivityRow` component

**Files:**
- Create: `medialane-ui/src/components/activity-row.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create `src/components/activity-row.tsx`**

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AddressDisplay } from "./address-display.js";
import { CurrencyIcon } from "./currency-icon.js";
import { ACTIVITY_TYPE_CONFIG } from "../data/activity.js";
import { ipfsToHttp } from "../utils/ipfs.js";
import { timeAgo } from "../utils/time.js";
import { formatDisplayPrice } from "../utils/format.js";
import { cn } from "../utils/cn.js";
import type { ApiActivity } from "@medialane/sdk";

export interface ActivityRowProps {
  activity: ApiActivity;
  /** Optional token enrichment — if absent shows #tokenId fallback. No internal useToken call. */
  token?: { name?: string; image?: string };
  showActor?: boolean;
  showExplorer?: boolean;
  compact?: boolean;
  explorerUrl?: string;
  getAssetHref?: (contract: string, tokenId: string) => string;
  getActorHref?: (address: string) => string;
}

export function ActivityRow({
  activity,
  token,
  showActor = true,
  showExplorer = true,
  compact = false,
  explorerUrl = "https://voyager.online",
  getAssetHref = (c, t) => `/asset/${c}/${t}`,
  getActorHref = (a) => `/creator/${a}`,
}: ActivityRowProps) {
  const config = ACTIVITY_TYPE_CONFIG[activity.type] ?? {
    label: activity.type,
    variant: "outline" as const,
    icon: ExternalLink,
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
  };
  const Icon = config.icon;

  const contract = activity.nftContract ?? activity.contractAddress ?? null;
  const tokenId = activity.nftTokenId ?? activity.tokenId ?? null;
  const actor =
    activity.offerer ??
    activity.fulfiller ??
    ((activity.type as string) === "mint" ? activity.to : activity.from) ??
    null;
  const txLink = activity.txHash ? `${explorerUrl}/tx/${activity.txHash}` : null;

  const tokenName = token?.name ?? (tokenId ? `#${tokenId}` : "—");
  const tokenImage = token?.image ? ipfsToHttp(token.image) : null;

  return (
    <div className={cn("flex items-center gap-3 hover:bg-muted/30 transition-colors group", compact ? "pl-4 pr-5 py-2.5" : "pl-4 pr-5 py-3.5")}>
      {/* Type icon */}
      <div className={cn("rounded-lg flex items-center justify-center shrink-0", config.bgClass, compact ? "h-7 w-7" : "h-8 w-8")}>
        <Icon className={cn("shrink-0", config.colorClass, compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      </div>

      {/* Token thumbnail */}
      <div className={cn("rounded-md overflow-hidden shrink-0 bg-muted", compact ? "h-7 w-7" : "h-9 w-9")}>
        {tokenImage ? (
          <Image src={tokenImage} alt={tokenName} width={compact ? 28 : 36} height={compact ? 28 : 36} className="object-cover w-full h-full" unoptimized />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted-foreground/10 to-muted-foreground/5" />
        )}
      </div>

      {/* Asset name + actor */}
      <div className="flex-1 min-w-0">
        {contract && tokenId ? (
          <Link href={getAssetHref(contract, tokenId)} className="text-sm font-semibold hover:text-primary transition-colors truncate block leading-tight">
            {tokenName}
          </Link>
        ) : (
          <span className="text-sm font-semibold text-muted-foreground">—</span>
        )}
        {showActor && actor && (
          <Link href={getActorHref(actor)} className="text-xs text-muted-foreground hover:text-primary transition-colors font-mono leading-tight">
            <AddressDisplay address={actor} chars={4} showCopy={false} />
          </Link>
        )}
      </div>

      {/* Right: badge + price + time + explorer */}
      <div className="flex items-center gap-2.5 shrink-0">
        {!compact && (
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded hidden sm:inline-flex", config.bgClass, config.colorClass)}>
            {config.label}
          </span>
        )}

        {activity.price?.formatted && (
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums leading-tight">{formatDisplayPrice(activity.price)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight flex items-center justify-end gap-0.5">
              <CurrencyIcon symbol={activity.price.currency} size={10} />
              {activity.price.currency}
            </p>
          </div>
        )}

        <span className="text-[10px] text-muted-foreground tabular-nums hidden sm:block w-12 text-right" title={new Date(activity.timestamp).toLocaleString()}>
          {timeAgo(activity.timestamp)}
        </span>

        {showExplorer && txLink && (
          <a href={txLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 shrink-0" aria-label="View on explorer">
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add exports to `src/index.ts`**

```ts
export { ActivityRow } from "./components/activity-row.js";
export type { ActivityRowProps } from "./components/activity-row.js";
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
git add src/components/activity-row.tsx src/index.ts
git commit -m "feat: add ActivityRow to @medialane/ui (no useToken N+1, optional token prop)"
```

---

## Task 7: `ActivityFeedShell` component

**Files:**
- Create: `medialane-ui/src/components/activity-feed-shell.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create `src/components/activity-feed-shell.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ArrowRight, Activity, RefreshCw } from "lucide-react";
import { timeAgo } from "../utils/time.js";

export interface ActivityFeedShellProps {
  title: string;
  href: string;
  hrefLabel?: string;
  lastUpdated: string;
  isLoading: boolean;
  children: React.ReactNode;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="h-7 w-7 rounded-lg bg-muted animate-pulse shrink-0" />
      <div className="h-7 w-7 rounded-md bg-muted animate-pulse shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
        <div className="h-2.5 w-20 bg-muted animate-pulse rounded" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-3.5 w-14 bg-muted animate-pulse rounded" />
        <div className="h-2.5 w-8 bg-muted animate-pulse rounded" />
      </div>
      <div className="h-3 w-10 bg-muted animate-pulse rounded hidden sm:block" />
    </div>
  );
}

export function ActivityFeedShell({ title, href, hrefLabel = "Activities", lastUpdated, isLoading, children }: ActivityFeedShellProps) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Activity className="h-4 w-4 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black leading-none">{title}</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5" />
              Updated {timeAgo(lastUpdated)}
            </p>
          </div>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
          {hrefLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="bento-cell overflow-hidden divide-y divide-border/40">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : !children || (Array.isArray(children) && children.length === 0) ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Activity className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add exports to `src/index.ts`**

```ts
export { ActivityFeedShell } from "./components/activity-feed-shell.js";
export type { ActivityFeedShellProps } from "./components/activity-feed-shell.js";
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
git add src/components/activity-feed-shell.tsx src/index.ts
git commit -m "feat: add ActivityFeedShell to @medialane/ui"
```

---

## Task 8: `LaunchpadGrid` component

**Files:**
- Create: `medialane-ui/src/components/launchpad-grid.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create `src/components/launchpad-grid.tsx`**

```tsx
"use client";

import Link from "next/link";
import { ArrowRight, Rocket, type LucideIcon } from "lucide-react";

export interface FeatureItem {
  icon: LucideIcon;
  label: string;
  subtitle: string;
  /** Tailwind gradient string e.g. "from-violet-500 to-purple-600" */
  accent: string;
  href: string;
}

export interface LaunchpadGridProps {
  title?: string;
  titleHref?: string;
  titleHrefLabel?: string;
  features: FeatureItem[];
}

function ServiceCard({ feature }: { feature: FeatureItem }) {
  const { icon: Icon, label, subtitle, accent, href } = feature;
  return (
    <Link href={href} className="group block">
      <div className="card-base overflow-hidden">
        <div className={`relative aspect-[3/4] w-full bg-gradient-to-br ${accent}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_25%,rgba(255,255,255,0.14),transparent_60%)]" />
          <div className="absolute -bottom-6 -right-6 opacity-[0.12] pointer-events-none">
            <Icon className="h-36 w-36 text-white" />
          </div>
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            <div className="h-11 w-11 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 group-hover:bg-white/[0.18] transition-colors duration-300">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-black text-white leading-tight tracking-tight">{label}</p>
              <p className="text-xs text-white/65 mt-1.5 leading-relaxed">{subtitle}</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function LaunchpadGrid({
  title = "Creator Launchpad",
  titleHref = "/launchpad",
  titleHrefLabel = "All services",
  features,
}: LaunchpadGridProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-md shadow-primary/20">
            <Rocket className="h-3.5 w-3.5 text-white" />
          </div>
          <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
        </div>
        <Link href={titleHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors">
          {titleHrefLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="w-full overflow-x-auto scrollbar-hide">
        <div className="flex gap-3 snap-x snap-mandatory pb-2" style={{ width: "max-content" }}>
          {features.map((f) => (
            <div key={f.label} className="w-56 sm:w-64 snap-start shrink-0">
              <ServiceCard feature={f} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add exports to `src/index.ts`**

```ts
export { LaunchpadGrid } from "./components/launchpad-grid.js";
export type { LaunchpadGridProps, FeatureItem } from "./components/launchpad-grid.js";
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
git add src/components/launchpad-grid.tsx src/index.ts
git commit -m "feat: add LaunchpadGrid to @medialane/ui"
```

---

## Task 9: `CtaCardGrid` component

**Files:**
- Create: `medialane-ui/src/components/cta-card-grid.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create `src/components/cta-card-grid.tsx`**

```tsx
import type { ElementType } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "../utils/cn.js";

export interface CtaCardItem {
  icon: ElementType;
  title: string;
  description: string;
  links: { label: string; href: string }[];
  href: string;
  /** Tailwind gradient class applied as a 3% opacity hover overlay */
  gradient: string;
  /** Tailwind gradient + shadow class for the icon pill */
  iconGradient: string;
}

export interface CtaCardGridProps {
  cards: CtaCardItem[];
}

function CtaCard({ icon: Icon, title, description, links, href, gradient, iconGradient }: CtaCardItem) {
  return (
    <div className="bento-cell p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden group hover:border-border/80 transition-colors">
      <div className={`absolute inset-0 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity ${gradient} pointer-events-none`} />

      <div className="relative z-10 space-y-3">
        <div className={cn("h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg", iconGradient)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-black">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">{description}</p>
        </div>
      </div>

      <ul className="relative z-10 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors group/link">
              <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0 -ml-0.5" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="relative z-10 mt-auto">
        <Link href={href} className="inline-flex items-center gap-1.5 text-sm border border-border rounded-md px-3 py-1.5 hover:border-primary/40 transition-colors group-hover:border-primary/40">
          Explore {title} <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
        </Link>
      </div>
    </div>
  );
}

export function CtaCardGrid({ cards }: CtaCardGridProps) {
  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((card) => (
          <CtaCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add exports to `src/index.ts`**

```ts
export { CtaCardGrid } from "./components/cta-card-grid.js";
export type { CtaCardGridProps, CtaCardItem } from "./components/cta-card-grid.js";
```

- [ ] **Step 3: Type-check + commit**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
git add src/components/cta-card-grid.tsx src/index.ts
git commit -m "feat: add CtaCardGrid to @medialane/ui"
```

---

## Task 10: Build + publish `@medialane/ui` v0.3.0

**Files:**
- Modify: `medialane-ui/package.json` (devDep version alignment)

- [ ] **Step 1: Full build**

```bash
cd /Users/kalamaha/dev/medialane-ui && ~/.bun/bin/bun run build
```

Expected: build succeeds, all component files + `dist/medialane.css` present.

```bash
ls /Users/kalamaha/dev/medialane-ui/dist/ | grep -E "(hero-slider|activity-ticker|listing-card|activity-row|activity-feed-shell|launchpad-grid|cta-card-grid|medialane\.css)"
```

Expected: all 7 component files + `medialane.css` listed.

- [ ] **Step 2: Final type-check**

```bash
cd /Users/kalamaha/dev/medialane-ui && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Publish**

```bash
cd /Users/kalamaha/dev/medialane-ui && npm publish
```

Expected: `+ @medialane/ui@0.3.0` published successfully.

- [ ] **Step 4: Commit + push**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add -A
git commit -m "chore: release @medialane/ui v0.3.0 — frontpage canonical components + unified CSS"
git push origin main
```

---

## Task 11: Update dapp — install v0.3.0 + CSS migration

**Files:**
- Modify: `medialane-dapp/package.json`
- Modify: `medialane-dapp/src/app/layout.tsx`
- Modify: `medialane-dapp/src/app/globals.css`

- [ ] **Step 1: Update @medialane/ui**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npm install @medialane/ui@^0.3.0 --legacy-peer-deps
```

Expected: `@medialane/ui@0.3.0` installed.

- [ ] **Step 2: Add CSS import to layout.tsx**

In `src/app/layout.tsx`, add the import on the line before `import "./globals.css"`:

```tsx
import "@medialane/ui/styles";
import "./globals.css";
```

The full top of the file becomes:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "@medialane/ui/styles";
import "./globals.css";
```

- [ ] **Step 3: Strip shared CSS from globals.css**

Replace `src/app/globals.css` content from line 99 onwards with nothing. Keep only the tailwind directives and theme tokens. The file should end at the closing brace of `@layer base`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 99%;
    --foreground: 224 47% 11%;
    --card: 0 0% 100%;
    --card-foreground: 224 47% 11%;
    --popover: 0 0% 100%;
    --popover-foreground: 224 47% 11%;
    --primary: 248 81% 56%;
    --primary-foreground: 0 0% 98%;
    --secondary: 220 14% 96%;
    --secondary-foreground: 224 47% 11%;
    --muted: 220 14% 96%;
    --muted-foreground: 220 9% 46%;
    --accent: 221 83% 53%;
    --accent-foreground: 0 0% 98%;
    --destructive: 350 89% 60%;
    --destructive-foreground: 0 0% 98%;
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 271 81% 56%;
    --radius: 1rem;
    --price: 21 90% 44%;

    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 224 47% 11%;
    --sidebar-primary: 271 81% 56%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 220 14% 96%;
    --sidebar-accent-foreground: 224 47% 11%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 221 83% 53%;

    --brand-blue: 221 83% 53%;
    --brand-navy: 224 87% 20%;
    --brand-rose: 350 89% 60%;
    --brand-purple: 271 81% 56%;
    --brand-orange: 21 90% 44%;
  }

  .dark {
    --background: 224 50% 4%;
    --foreground: 210 20% 95%;
    --card: 224 40% 8%;
    --card-foreground: 210 20% 95%;
    --popover: 224 40% 8%;
    --popover-foreground: 210 20% 95%;
    --primary: 248 81% 65%;
    --primary-foreground: 0 0% 98%;
    --secondary: 224 30% 13%;
    --secondary-foreground: 210 15% 85%;
    --muted: 224 30% 13%;
    --muted-foreground: 220 10% 55%;
    --accent: 221 83% 65%;
    --accent-foreground: 0 0% 98%;
    --destructive: 350 80% 55%;
    --destructive-foreground: 0 0% 98%;
    --border: 262 30% 18%;
    --input: 224 20% 16%;
    --ring: 271 81% 65%;
    --price: 21 90% 58%;

    --sidebar-background: 224 50% 4%;
    --sidebar-foreground: 210 15% 80%;
    --sidebar-primary: 271 81% 65%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 224 30% 11%;
    --sidebar-accent-foreground: 210 15% 85%;
    --sidebar-border: 224 20% 12%;
    --sidebar-ring: 271 60% 65%;

    --brand-blue: 221 83% 53%;
    --brand-navy: 224 87% 20%;
    --brand-rose: 350 89% 60%;
    --brand-purple: 271 81% 56%;
    --brand-orange: 21 90% 44%;
  }
}

@layer base {
  * { @apply border-border; }
  html, body { overflow-x: clip; max-width: 100%; }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
  h1, h2, h3, h4 { @apply tracking-tight; }
}
```

- [ ] **Step 4: Build verify**

```bash
cd /Users/kalamaha/dev/medialane-dapp && ~/.bun/bin/bun run build
```

Expected: build passes. Visually verify the homepage still renders correctly (card-base, bento-cell, gradient-text classes from the package CSS).

- [ ] **Step 5: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add package.json package-lock.json src/app/layout.tsx src/app/globals.css
git commit -m "feat: upgrade @medialane/ui to v0.3.0, migrate shared CSS to package"
```

---

## Task 12: Rebuild home — HeroSlider + ActivityTicker wrappers

**Files:**
- Modify: `medialane-dapp/src/components/home/hero-slider.tsx`
- Create: `medialane-dapp/src/components/home/activity-ticker.tsx`

- [ ] **Step 1: Replace `src/components/home/hero-slider.tsx`**

```tsx
"use client";

import { HeroSlider as HeroSliderDisplay } from "@medialane/ui";
import { useCollections } from "@/hooks/use-collections";
import type { ApiCollection } from "@medialane/sdk";

export function HeroSlider() {
  const { collections, isLoading } = useCollections(1, 3, true, "recent");
  return (
    <HeroSliderDisplay
      collections={collections}
      isLoading={isLoading}
      getHref={(col: ApiCollection) => `/collections/${col.contractAddress}`}
    />
  );
}
```

- [ ] **Step 2: Create `src/components/home/activity-ticker.tsx`**

```tsx
"use client";

import { ActivityTicker as ActivityTickerDisplay } from "@medialane/ui";
import { useOrders } from "@/hooks/use-orders";

export function ActivityTicker() {
  const { orders } = useOrders({ status: "ACTIVE", sort: "recent", limit: 14 });
  return <ActivityTickerDisplay orders={orders} />;
}
```

- [ ] **Step 3: Build verify**

```bash
cd /Users/kalamaha/dev/medialane-dapp && ~/.bun/bin/bun run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/home/hero-slider.tsx src/components/home/activity-ticker.tsx
git commit -m "refactor: hero-slider + activity-ticker as thin wrappers over @medialane/ui"
```

---

## Task 13: Rebuild ListingCard wrapper + NewOnMarketplace

**Files:**
- Modify: `medialane-dapp/src/components/marketplace/listing-card.tsx`
- Modify: `medialane-dapp/src/components/home/new-on-marketplace.tsx`
- Create: `medialane-dapp/src/components/shared/listing-card.tsx`

- [ ] **Step 1: Replace `src/components/marketplace/listing-card.tsx`**

This becomes a thin app wrapper that wires `useCart` + dropdown + `ReportDialog` into the package's `ListingCard`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ListingCard as PackageListingCard,
  ListingCardSkeleton,
  ipfsToHttp,
  formatDisplayPrice,
} from "@medialane/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, ExternalLink, Layers, Flag } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { ReportDialog } from "@/components/report-dialog";
import type { ApiOrder } from "@medialane/sdk";

export { ListingCardSkeleton };

interface ListingCardProps {
  order: ApiOrder;
  onBuy?: (order: ApiOrder) => void;
  compact?: boolean;
}

export function ListingCard({ order, onBuy, compact = false }: ListingCardProps) {
  const { addItem, items } = useCart();
  const [reportOpen, setReportOpen] = useState(false);
  const inCart = items.some((i) => i.orderHash === order.orderHash);

  const name = order.token?.name ?? `Token #${order.nftTokenId}`;
  const image = order.token?.image ? ipfsToHttp(order.token.image) : null;

  const handleCart = (o: ApiOrder) => {
    if (inCart) return;
    addItem({
      orderHash: o.orderHash,
      nftContract: o.nftContract ?? "",
      nftTokenId: o.nftTokenId ?? "",
      name,
      image: image ?? "",
      price: formatDisplayPrice(o.price),
      currency: o.price?.currency ?? "",
      currencyDecimals: o.price?.decimals,
      offerer: o.offerer ?? "",
      considerationToken: o.consideration?.token ?? "",
      considerationAmount: o.consideration?.startAmount ?? "",
    });
  };

  const overflowMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-9 p-0 shrink-0 rounded-[9px]"
          onClick={(e) => e.preventDefault()}
          aria-label="More actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link href={`/asset/${order.nftContract}/${order.nftTokenId}`} className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            View Asset
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/collections/${order.nftContract}`} className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
            View Collection
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 text-destructive focus:text-destructive"
          onClick={(e) => { e.preventDefault(); setReportOpen(true); }}
        >
          <Flag className="h-3.5 w-3.5" />
          Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PackageListingCard
        order={order}
        inCart={inCart}
        onBuy={onBuy}
        onCart={handleCart}
        compact={compact}
        overflowMenu={overflowMenu}
      />
      {reportOpen && (
        <ReportDialog
          target={{
            type: "TOKEN",
            contract: order.nftContract ?? "",
            tokenId: order.nftTokenId ?? "",
            name: order.token?.name ?? undefined,
          }}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Create `src/components/shared/listing-card.tsx` facade**

```ts
export { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
export type { } from "@medialane/ui";
```

- [ ] **Step 3: Update `src/components/home/new-on-marketplace.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import { useOrders } from "@/hooks/use-orders";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { ScrollSection } from "@/components/shared/scroll-section";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import type { ApiOrder } from "@medialane/sdk";

export function NewOnMarketplace() {
  const { orders, isLoading } = useOrders({ status: "ACTIVE", limit: 10, page: 1 });
  const [buyOrder, setBuyOrder] = useState<ApiOrder | null>(null);
  const listings = orders.filter((o) => o.offer.itemType === "ERC721").slice(0, 10);

  return (
    <>
      <ScrollSection
        icon={<Tag className="h-3.5 w-3.5 text-white" />}
        iconBg="bg-gradient-to-br from-rose-500 to-pink-600 shadow-md shadow-rose-500/20"
        title="New listings"
        href="/marketplace"
        linkLabel="Marketplace"
      >
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-72 snap-start shrink-0">
                <ListingCardSkeleton />
              </div>
            ))
          : listings.length === 0
          ? (
              <p className="text-sm text-muted-foreground py-4">
                No listings yet.{" "}
                <Link href="/create/asset" className="text-primary hover:underline">
                  Be the first to list an asset.
                </Link>
              </p>
            )
          : listings.map((order) => (
              <div key={order.orderHash} className="w-72 snap-start shrink-0">
                <ListingCard order={order} onBuy={() => setBuyOrder(order)} />
              </div>
            ))}
      </ScrollSection>

      {buyOrder && (
        <PurchaseDialog
          open={!!buyOrder}
          onOpenChange={(v) => { if (!v) setBuyOrder(null); }}
          order={buyOrder}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Build verify**

```bash
cd /Users/kalamaha/dev/medialane-dapp && ~/.bun/bin/bun run build
```

Expected: build passes. All existing marketplace pages still work (they import from `@/components/marketplace/listing-card` which now uses the package component internally).

- [ ] **Step 5: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/marketplace/listing-card.tsx src/components/shared/listing-card.tsx src/components/home/new-on-marketplace.tsx
git commit -m "refactor: ListingCard as thin wrapper over @medialane/ui, NewOnMarketplace updated"
```

---

## Task 14: Rebuild AirdropSection + CommunityActivity + LearnDocsCta

**Files:**
- Modify: `medialane-dapp/src/components/home/airdrop-section.tsx`
- Modify: `medialane-dapp/src/components/home/community-activity.tsx`
- Modify: `medialane-dapp/src/components/home/learn-docs-cta.tsx`

- [ ] **Step 1: Replace `src/components/home/airdrop-section.tsx`**

Port io's service card grid. Uses `LaunchpadGrid` from the package with io's canonical `FEATURES` list:

```tsx
"use client";

import {
  Paintbrush, ShoppingBag, Bot, Award, Package, Layers,
  BookOpen, FileCode2,
} from "lucide-react";
import { LaunchpadGrid } from "@medialane/ui";
import type { FeatureItem } from "@medialane/ui";

const FEATURES: FeatureItem[] = [
  { icon: Paintbrush, label: "Mint IP Assets",      subtitle: "Zero fees, permanent record on Starknet", accent: "from-violet-500 to-purple-600",  href: "/create/asset" },
  { icon: ShoppingBag, label: "Marketplace",        subtitle: "Gasless trading, settled atomically",     accent: "from-blue-500 to-cyan-500",      href: "/marketplace" },
  { icon: Layers,      label: "Collections",        subtitle: "Deploy your branded IP catalog",          accent: "from-sky-500 to-blue-600",       href: "/create/collection" },
  { icon: Award,       label: "POP Protocol",       subtitle: "Soulbound event credentials",             accent: "from-emerald-400 to-teal-500",   href: "/launchpad" },
  { icon: Package,     label: "Collection Drop",    subtitle: "Limited-edition NFT releases",            accent: "from-orange-400 to-rose-500",    href: "/launchpad" },
  { icon: Bot,         label: "AI Agent Ready",     subtitle: "Autonomous IP participation",             accent: "from-pink-500 to-fuchsia-600",   href: "/launchpad" },
  { icon: BookOpen,    label: "Learn",              subtitle: "Creator education & guides",              accent: "from-violet-500 to-indigo-600",  href: "/about" },
  { icon: FileCode2,   label: "Developer Docs",     subtitle: "API, contracts & protocol reference",     accent: "from-slate-600 to-blue-700",     href: "/support" },
];

export function AirdropSection() {
  return <LaunchpadGrid features={FEATURES} />;
}
```

- [ ] **Step 2: Replace `src/components/home/community-activity.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { ActivityFeedShell, ActivityRow } from "@medialane/ui";
import { useActivities } from "@/hooks/use-activities";
import { EXPLORER_URL } from "@/lib/constants";

export function CommunityActivity() {
  const { activities, isLoading } = useActivities({ limit: 10 });
  const [lastUpdated, setLastUpdated] = useState(() => new Date().toISOString());
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isLoading) setLastUpdated(new Date().toISOString());
  }, [activities, isLoading]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <ActivityFeedShell
      title="Community"
      href="/activities"
      lastUpdated={lastUpdated}
      isLoading={isLoading}
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
            explorerUrl={EXPLORER_URL}
            getAssetHref={(c, t) => `/asset/${c}/${t}`}
            getActorHref={(a) => `/creator/${a}`}
          />
        );
      })}
    </ActivityFeedShell>
  );
}
```

- [ ] **Step 3: Replace `src/components/home/learn-docs-cta.tsx`**

```tsx
import { BookOpen, FileCode2 } from "lucide-react";
import { CtaCardGrid } from "@medialane/ui";
import type { CtaCardItem } from "@medialane/ui";

const CARDS: CtaCardItem[] = [
  {
    icon: BookOpen,
    title: "Learn",
    description: "Understand NFTs, programmable IP licensing, and how to grow as a creator on Medialane.",
    links: [
      { label: "NFT Fundamentals",        href: "https://www.medialane.io/learn/nft" },
      { label: "Creator Launchpad",       href: "https://www.medialane.io/learn/creator-launchpad" },
      { label: "Programmable Licensing",  href: "https://www.medialane.io/learn/programmable-licensing" },
    ],
    href: "https://www.medialane.io/learn",
    gradient: "bg-gradient-to-br from-brand-purple to-brand-blue",
    iconGradient: "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/20",
  },
  {
    icon: FileCode2,
    title: "Docs",
    description: "Integrate with the Medialane API, deploy smart contracts, and build on our protocol.",
    links: [
      { label: "API Reference",      href: "https://www.medialane.io/docs/api" },
      { label: "Protocol & Contracts", href: "https://www.medialane.io/docs/protocol" },
      { label: "Developer Guide",    href: "https://www.medialane.io/docs/developers" },
    ],
    href: "https://www.medialane.io/docs",
    gradient: "bg-gradient-to-br from-brand-blue to-brand-navy",
    iconGradient: "bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/20",
  },
];

export function LearnDocsCta() {
  return <CtaCardGrid cards={CARDS} />;
}
```

- [ ] **Step 4: Build verify**

```bash
cd /Users/kalamaha/dev/medialane-dapp && ~/.bun/bin/bun run build
```

Expected: build passes.

- [ ] **Step 5: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/home/airdrop-section.tsx src/components/home/community-activity.tsx src/components/home/learn-docs-cta.tsx
git commit -m "refactor: AirdropSection, CommunityActivity, LearnDocsCta use @medialane/ui components"
```

---

## Task 15: Canonical layout + shared facades + final build

**Files:**
- Modify: `medialane-dapp/src/components/home/index.tsx`
- Modify: `medialane-dapp/src/components/home/trending-collections.tsx`
- Create: `medialane-dapp/src/components/shared/activity-row.tsx`
- Create: `medialane-dapp/src/components/shared/activity-feed-shell.tsx`

- [ ] **Step 1: Rewrite `src/components/home/index.tsx` — canonical layout**

```tsx
"use client";

import { HeroSlider } from "./hero-slider";
import { ActivityTicker } from "./activity-ticker";
import { TrendingCollections } from "./trending-collections";
import { NewOnMarketplace } from "./new-on-marketplace";
import { AirdropSection } from "./airdrop-section";
import { CommunityActivity } from "./community-activity";
import { LearnDocsCta } from "./learn-docs-cta";

export function HomePage() {
  return (
    <div className="pb-20">
      {/* Hero — full-bleed */}
      <HeroSlider />

      {/* Live market ticker */}
      <div className="container mx-auto px-4 sm:px-6 pt-6">
        <ActivityTicker />
      </div>

      {/* Padded content sections */}
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

- [ ] **Step 2: Clean up `src/components/home/trending-collections.tsx`**

```tsx
"use client";

import { TrendingUp } from "lucide-react";
import { useCollections } from "@/hooks/use-collections";
import { CollectionCard, CollectionCardSkeleton, ScrollSection } from "@medialane/ui";

export function TrendingCollections() {
  const { collections, isLoading } = useCollections(1, 10, undefined, "recent");

  return (
    <ScrollSection
      icon={<TrendingUp className="h-3.5 w-3.5 text-white" />}
      iconBg="bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md shadow-violet-500/20"
      title="Onchain Collections"
      href="/collections"
      linkLabel="See all"
    >
      {isLoading
        ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-56 sm:w-64 snap-start shrink-0">
              <CollectionCardSkeleton />
            </div>
          ))
        : collections.length === 0
        ? <p className="text-sm text-muted-foreground py-4">No collections yet. Be the first to create one!</p>
        : collections.map((col) => (
            <div key={col.contractAddress} className="w-64 snap-start shrink-0">
              <CollectionCard collection={col} />
            </div>
          ))}
    </ScrollSection>
  );
}
```

- [ ] **Step 3: Create shared facade — `src/components/shared/activity-row.tsx`**

```ts
export { ActivityRow } from "@medialane/ui";
export type { ActivityRowProps } from "@medialane/ui";
```

- [ ] **Step 4: Create shared facade — `src/components/shared/activity-feed-shell.tsx`**

```ts
export { ActivityFeedShell } from "@medialane/ui";
export type { ActivityFeedShellProps } from "@medialane/ui";
```

- [ ] **Step 5: Final build**

```bash
cd /Users/kalamaha/dev/medialane-dapp && ~/.bun/bin/bun run build
```

Expected: clean build, zero errors, all 7 sections compile.

- [ ] **Step 6: Type-check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit
```

Expected: zero new errors (only the pre-existing `token.owner` nullability errors that were present before this work).

- [ ] **Step 7: Commit + push**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/home/index.tsx src/components/home/trending-collections.tsx src/components/shared/activity-row.tsx src/components/shared/activity-feed-shell.tsx
git commit -m "feat: canonical 7-section frontpage — all sections powered by @medialane/ui v0.3.0"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✓ CSS unification → Task 1
- ✓ `timeAgo` + `ACTIVITY_TYPE_CONFIG` → Task 2
- ✓ `HeroSlider` → Task 3
- ✓ `ActivityTicker` (prop-driven, no useOrders) → Task 4
- ✓ `ListingCard` (callback pattern, no useCart) → Task 5
- ✓ `ActivityRow` (optional token prop, no N+1) → Task 6
- ✓ `ActivityFeedShell` → Task 7
- ✓ `LaunchpadGrid` → Task 8
- ✓ `CtaCardGrid` → Task 9
- ✓ Build + publish v0.3.0 → Task 10
- ✓ CSS import in layout.tsx → Task 11
- ✓ Thin wrappers HeroSlider + ActivityTicker → Task 12
- ✓ ListingCard wrapper + NewOnMarketplace → Task 13
- ✓ AirdropSection + CommunityActivity + LearnDocsCta → Task 14
- ✓ Canonical layout + facades + final build → Task 15

**Type consistency:** All `formatDisplayPrice` calls pass `order.price` (type `{ formatted?: string, currency: string, decimals?: number } | null`) — matches the util signature. `ApiActivity.price` same shape. `getHref`, `getActorHref`, `getAssetHref` all consistent between task definitions and usages.

**No placeholders:** All steps contain complete code. No TBD sections.
