# Creator & Discover UX Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IP type navigation grid to the discover page, horizontal drag carousels to creator profile pages, and minor cosmetic alignment fixes (toaster position, footer layout) to bring medialane-dapp visual parity with medialane-io.

**Architecture:** Three self-contained additions: (1) `IpTypeNav` — a grid of IP type filter links using the dapp's existing `IP_TYPE_CONFIG`; (2) `CollectionCarouselRow` — a mouse-drag horizontal scroll strip of token cards for a collection, used on the creator profile page; (3) cosmetic tweaks to providers.tsx. No new hooks required.

**Tech Stack:** Tailwind CSS, `MotionCard` from `@medialane/ui` (re-exported via `@/components/ui/motion-primitives`), `IP_TYPE_CONFIG` from `@/lib/ip-type-config`, `useCollectionTokens` hook, `CollectionCard` from `@medialane/ui`

---

### Task 1: Create `IpTypeNav` component

**Files:**
- Create: `src/components/discover/ip-type-nav.tsx`

The dapp's `IP_TYPE_CONFIG` is local at `@/lib/ip-type-config` (not from `@medialane/ui` like io). It has more types (12 vs 6). We show all of them in a responsive grid.

- [ ] **Step 1: Create the component**

```typescript
// src/components/discover/ip-type-nav.tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { IP_TYPE_CONFIG } from "@/lib/ip-type-config";
import { cn } from "@/lib/utils";

export function IpTypeNav() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black">Browse by Type</h2>
        <Link
          href="/nft"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {IP_TYPE_CONFIG.map(({ slug, label, icon: Icon, colorClass, bgClass }) => (
          <Link
            key={slug}
            href={`/${slug}`}
            className="group flex flex-col items-center gap-2.5 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all hover:shadow-md hover:shadow-black/10"
          >
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", bgClass)}>
              <Icon className={cn("h-5 w-5", colorClass)} />
            </div>
            <span className="text-xs font-semibold text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/discover/ip-type-nav.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add IpTypeNav component"
```

---

### Task 2: Wire `IpTypeNav` into the discover page

**Files:**
- Modify: `src/components/discover/index.tsx` (or wherever `DiscoverPage` is defined — find it first)

- [ ] **Step 1: Find the DiscoverPage component**

```bash
find /Users/kalamaha/dev/medialane-dapp/src/components/discover -type f | sort
```

If `src/components/discover/index.tsx` doesn't exist, check `src/components/discover.tsx` or similar. Read the file to find the right insertion point.

- [ ] **Step 2: Add import and insert `IpTypeNav`**

In the `DiscoverPage` component, import and place `IpTypeNav` near the top of the page content, typically after any hero/intro section and before the asset grid:

```typescript
import { IpTypeNav } from "@/components/discover/ip-type-nav";
```

In the JSX, add:
```tsx
<IpTypeNav />
```

The exact insertion point depends on the existing page structure — read the file first and insert after the first major section (hero or stats row).

- [ ] **Step 3: Build check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/discover/
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add IpTypeNav to discover page"
```

---

### Task 3: Create `CollectionCarouselRow` component

**Files:**
- Create: `src/components/creator/collection-carousel-row.tsx`

This is a horizontal drag-scroll strip showing the first 10 tokens of a collection, ending with a "View all" card. Uses mouse drag events (no touch library needed).

- [ ] **Step 1: Verify `MotionCard` and `CollectionCard` are available**

```bash
grep -n "MotionCard\|CollectionCard" /Users/kalamaha/dev/medialane-dapp/src/components/ui/motion-primitives.tsx | head -5
grep -rn "CollectionCard" /Users/kalamaha/dev/medialane-dapp/src --include="*.tsx" | head -5
```

`MotionCard` is re-exported from `@medialane/ui` via `src/components/ui/motion-primitives.tsx`.
`CollectionCard` should be importable from `@medialane/ui` or a local component — check the grep output and adjust the import below accordingly.

- [ ] **Step 2: Create the component**

```typescript
// src/components/creator/collection-carousel-row.tsx
"use client";

import { useRef } from "react";
import Link from "next/link";
import { LayoutGrid, ChevronRight } from "lucide-react";
import { MotionCard } from "@/components/ui/motion-primitives";
import { TokenCard } from "@/components/shared/token-card";
import { useCollectionTokens } from "@/hooks/use-collections";
import type { ApiCollection } from "@medialane/sdk";

function ViewAllCard({ href }: { href: string }) {
  return (
    <Link href={href} className="snap-start shrink-0 w-64 block">
      <MotionCard className="card-base border-dashed">
        <div className="aspect-square flex flex-col items-center justify-center gap-3 p-4">
          <div className="h-10 w-10 rounded-full border border-dashed border-border/60 flex items-center justify-center">
            <LayoutGrid className="h-4 w-4 text-muted-foreground/60" />
          </div>
          <div className="text-center space-y-0.5">
            <p className="text-xs font-semibold">View all</p>
            <p className="text-[10px] text-muted-foreground">in collection</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
        </div>
      </MotionCard>
    </Link>
  );
}

export function CollectionCarouselRow({
  collection,
}: {
  collection: ApiCollection;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStartLeft = useRef(0);

  const { tokens, isLoading } = useCollectionTokens(collection.contractAddress, 1, 10);

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true;
    startX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0);
    scrollStartLeft.current = scrollRef.current?.scrollLeft ?? 0;
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    scrollRef.current.scrollLeft = scrollStartLeft.current - (x - startX.current);
  }

  function onMouseUp() {
    isDragging.current = false;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold truncate max-w-[70%]">
          {collection.name ?? "Unnamed Collection"}
        </h3>
        <Link
          href={`/collections/${collection.contractAddress}`}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          See all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      <div
        ref={scrollRef}
        className="flex items-end gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory cursor-grab active:cursor-grabbing pb-1"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="snap-start shrink-0 w-64 aspect-square rounded-xl bg-muted animate-pulse" />
            ))
          : tokens.map((t) => (
              <div key={`${t.contractAddress}-${t.tokenId}`} className="snap-start shrink-0 w-64">
                <TokenCard token={t} />
              </div>
            ))
        }
        <ViewAllCard href={`/collections/${collection.contractAddress}`} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/creator/collection-carousel-row.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add CollectionCarouselRow component"
```

---

### Task 4: Wire `CollectionCarouselRow` into creator profile page

**Files:**
- Modify: `src/app/creator/[address]/creator-page-client.tsx`

- [ ] **Step 1: Read the existing creator page client**

```bash
cat -n /Users/kalamaha/dev/medialane-dapp/src/app/creator/[address]/creator-page-client.tsx
```

Identify where collections are currently displayed (likely a grid of `CollectionCard`s or a simple list). Note the hook used to fetch collections (likely `useCollectionsByOwner`).

- [ ] **Step 2: Import and insert carousel**

Add import:
```typescript
import { CollectionCarouselRow } from "@/components/creator/collection-carousel-row";
```

Replace or supplement the collections display section. If collections are currently shown as a static grid, add the carousel below each collection card, or replace the grid entirely with carousel rows:

```tsx
{/* One carousel per collection — shows first 10 tokens with drag scroll */}
{collections.map((collection) => (
  <CollectionCarouselRow key={collection.contractAddress} collection={collection} />
))}
```

The exact integration depends on the existing page structure — read the file in Step 1 first.

- [ ] **Step 3: Build check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/app/creator/[address]/creator-page-client.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add collection carousels to creator profile page"
```

---

### Task 5: Cosmetic fixes — toaster position and footer layout

**Files:**
- Modify: `src/app/providers.tsx`

These are one-line changes to align the dapp's shell with medialane-io aesthetics.

- [ ] **Step 1: Change toaster position from `bottom-right` to `bottom-center`**

In `src/app/providers.tsx`, find:
```tsx
position="bottom-right"
```

Replace with:
```tsx
position="bottom-center"
```

- [ ] **Step 2: Reorder footer — logo left, links center, copyright right**

In `src/app/providers.tsx`, find the `<footer>` element. The current order is logo → links → copyright. Change to match io: copyright left, links center, logo right:

Current structure:
```tsx
<div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
  <div className="flex items-center gap-2">
    <MedialaneLogo />
  </div>
  <nav className="flex items-center gap-4 flex-wrap justify-center">
    {/* links */}
  </nav>
  <p className="text-xs">© {new Date().getFullYear()} Medialane DAO</p>
</div>
```

Replace with:
```tsx
<div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
  <p className="text-xs">© {new Date().getFullYear()} Medialane DAO</p>
  <nav className="flex items-center gap-4 flex-wrap justify-center">
    <Link href="/marketplace" className="hover:text-foreground transition-colors">Trade</Link>
    <Link href="/launchpad" className="hover:text-foreground transition-colors">Launch</Link>
    <a href="https://docs.medialane.io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
    <a href="https://docs.medialane.io/guidelines/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms</a>
    <a href="https://docs.medialane.io/guidelines/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy</a>
    <a href="https://x.com/medialane_io" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">X</a>
  </nav>
  <div className="flex items-center gap-2">
    <MedialaneLogo />
  </div>
</div>
```

- [ ] **Step 3: Build check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit and push**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/app/providers.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "fix: align toaster position and footer layout with medialane-io"
git -C /Users/kalamaha/dev/medialane-dapp push
```

---

## Self-Review Checklist

- [x] `IpTypeNav` uses dapp's local `IP_TYPE_CONFIG` (not `@medialane/ui`) — dapp has 12 types vs io's 6
- [x] `CollectionCarouselRow` uses `useCollectionTokens` which already exists in dapp
- [x] `MotionCard` import path uses dapp's re-export at `@/components/ui/motion-primitives`
- [x] TokenCard in carousel has no owner/action props (public view only — owners manage from Portfolio)
- [x] Task 4 Step 1 requires reading the existing creator page before editing — file structure unknown at plan-write time
- [x] Toaster change is one line; footer reorder preserves all existing links
- [x] No Clerk imports anywhere in this plan
