# Infinite Scroll Load-More Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do NOT use subagent-driven-development or dispatch any subagents for this plan — work sequentially in the main session.

**Goal:** Replace the manual "Load more" button with a scroll-triggered auto-load sentinel across every paginated asset/collection/creator/activity list in both `medialane-starknet` and `medialane-io`.

**Architecture:** One new headless `LoadMoreSentinel` component published from `@medialane/ui` (an `IntersectionObserver` wrapped in a tiny invisible `<div>`), consumed by 7 files in `medialane-starknet` and 6 files in `medialane-io`. No pagination/accumulation state changes — only the trigger mechanism changes from click to scroll-into-view.

**Tech Stack:** React 19, Next.js 15 (App Router), TypeScript, `@medialane/ui` (tsup-built package), Bun (package manager + script runner in all three repos — `npm` is not installed on this machine; use `bun run <script>` / `bunx` everywhere `npx`/`npm run` would normally appear).

## Global Constraints

- Spec: `medialane-starknet/docs/superpowers/specs/2026-07-05-infinite-scroll-load-more-design.md`.
- `LoadMoreSentinel` lives in `@medialane/ui` only — never duplicate the observer logic locally in either app.
- No manual "Load more" button fallback — the sentinel fully replaces it (per the approved spec).
- No change to any pagination/accumulation state, backend page sizes, or API contracts — only the trigger swaps from `onClick` to scroll-into-view.
- `medialane-io`'s `creators-client.tsx` has no pagination and is out of scope.
- Neither app has a unit test runner configured (`medialane-starknet` and `medialane-io` CLAUDE.md both say "verify with typecheck + browser", no jest/vitest). `medialane-ui` also has no test runner (`tsup`/`tsc` only). Verification in this plan is therefore `bun run typecheck` (or `bunx tsc --noEmit` where no script exists) + a manual browser smoke test at the end — not automated tests. This matches each repo's existing convention; do not introduce a new test framework as part of this change.
- `bun` is the package manager for all three repos (`bun.lock` is the tracked lockfile in each; `medialane-ui` also has a stale `package-lock.json` — ignore it, do not run `npm install`, `npm` is not installed on this machine).
- Publishing `@medialane/ui` to npm is a prod-npm-publish action — **pause and get explicit user confirmation immediately before running `bun publish`** (Task 2, Step 4). Do not run it automatically.

---

### Task 1: Add `LoadMoreSentinel` to `@medialane/ui`

**Files:**
- Create: `/Users/medialane/dev/medialane-ui/src/components/load-more-sentinel.tsx`
- Modify: `/Users/medialane/dev/medialane-ui/src/index.ts`

**Interfaces:**
- Produces: `LoadMoreSentinel(props: LoadMoreSentinelProps)` — a React component. `LoadMoreSentinelProps = { hasMore: boolean; isLoading: boolean; onLoadMore: () => void; rootMargin?: string }`. Renders `null` when `hasMore` is `false`; otherwise renders an invisible `<div>` that calls `onLoadMore()` once via `IntersectionObserver` when it scrolls within `rootMargin` (default `"400px"`) of the viewport, skipping the call entirely while `isLoading` is `true`.

- [ ] **Step 1: Write the component**

Create `/Users/medialane/dev/medialane-ui/src/components/load-more-sentinel.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

export interface LoadMoreSentinelProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

/**
 * Invisible trigger that calls `onLoadMore` when scrolled near the viewport.
 * Renders nothing once `hasMore` is false. Skips firing while `isLoading` is
 * true so callers can pass their existing "currently fetching" flag straight
 * through with no extra guard logic.
 */
export function LoadMoreSentinel({
  hasMore,
  isLoading,
  onLoadMore,
  rootMargin = "400px",
}: LoadMoreSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || isLoading) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, rootMargin, onLoadMore]);

  if (!hasMore) return null;
  return <div ref={ref} aria-hidden className="h-px w-full" />;
}
```

- [ ] **Step 2: Export it from the package root**

Read `/Users/medialane/dev/medialane-ui/src/index.ts` end (around line 162, after the rewards score-kit exports) and append:

```ts

// ── v0.37.0 additions — infinite-scroll trigger ──────────────────────────────
export { LoadMoreSentinel } from "./components/load-more-sentinel.js";
export type { LoadMoreSentinelProps } from "./components/load-more-sentinel.js";
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-ui && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `cd /Users/medialane/dev/medialane-ui && bun run build`
Expected: `tsup` completes without errors; `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` are regenerated and include `LoadMoreSentinel`.

- [ ] **Step 5: Commit**

```bash
cd /Users/medialane/dev/medialane-ui
git add src/components/load-more-sentinel.tsx src/index.ts
git commit -m "$(cat <<'EOF'
Add LoadMoreSentinel — scroll-triggered auto-load component

Headless IntersectionObserver wrapper for replacing manual Load-more
buttons with auto-loading on scroll across the asset-listing pages.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Version bump + publish `@medialane/ui`

**Files:**
- Modify: `/Users/medialane/dev/medialane-ui/package.json`

**Interfaces:**
- Consumes: Task 1's built `dist/` output.
- Produces: `@medialane/ui@0.37.0` on npm, consumed by Tasks 3 and 12.

- [ ] **Step 1: Bump the version**

In `/Users/medialane/dev/medialane-ui/package.json`, change:

```json
  "version": "0.36.1",
```

to:

```json
  "version": "0.37.0",
```

- [ ] **Step 2: Rebuild**

Run: `cd /Users/medialane/dev/medialane-ui && bun run build`
Expected: succeeds (same output as Task 1 Step 4, now under the new version).

- [ ] **Step 3: Commit the version bump**

```bash
cd /Users/medialane/dev/medialane-ui
git add package.json
git commit -m "$(cat <<'EOF'
Bump @medialane/ui to 0.37.0

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Publish — STOP and get explicit user confirmation first**

This step publishes a new version of `@medialane/ui` to the public npm registry. Do not run it without the user explicitly confirming in this session, immediately before running it (per `feedback_no_unauthorized_prod_writes` and `feedback_bun_publish_needs_local_npmrc` — a project-local `.npmrc` may be needed for `bun publish` to pick up auth; create one temporarily and delete it right after if so).

Run: `cd /Users/medialane/dev/medialane-ui && bun publish`
Expected: `+ @medialane/ui@0.37.0` published successfully.

---

### Task 3: Bump `@medialane/ui` in `medialane-starknet`

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/package.json`

**Interfaces:**
- Consumes: `@medialane/ui@0.37.0`'s exported `LoadMoreSentinel` (Task 2).

- [ ] **Step 1: Bump the dependency**

In `/Users/medialane/dev/medialane-starknet/package.json`, change:

```json
    "@medialane/ui": "0.36.1",
```

to:

```json
    "@medialane/ui": "0.37.0",
```

- [ ] **Step 2: Install**

Run: `cd /Users/medialane/dev/medialane-starknet && bun install`
Expected: `bun.lock` updates to resolve `@medialane/ui@0.37.0`; no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/medialane/dev/medialane-starknet
git add package.json bun.lock
git commit -m "$(cat <<'EOF'
Bump @medialane/ui to 0.37.0 for LoadMoreSentinel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `medialane-starknet` — `listings-grid.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/src/components/marketplace/listings-grid.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui` (Task 3).

- [ ] **Step 1: Remove the now-unused `Loader2` import**

In `/Users/medialane/dev/medialane-starknet/src/components/marketplace/listings-grid.tsx`, change:

```tsx
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ApiOrder, SortOrder } from "@medialane/sdk";
```

to:

```tsx
import { Button } from "@/components/ui/button";
import { LoadMoreSentinel } from "@medialane/ui";
import type { ApiOrder, SortOrder } from "@medialane/sdk";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
        {(hasMore || isLoadingMore) && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="lg"
              disabled={isLoadingMore}
              onClick={handleLoadMore}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading…
                </>
              ) : (
                orderType === "offers" ? "Load more offers" : "Load more listings"
              )}
            </Button>
          </div>
        )}
```

to:

```tsx
        <LoadMoreSentinel hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={handleLoadMore} />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-starknet && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-starknet
git add src/components/marketplace/listings-grid.tsx
git commit -m "$(cat <<'EOF'
Auto-load marketplace listings on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `medialane-starknet` — `ip-type-page-client.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/src/app/[ipType]/ip-type-page-client.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { Loader2, SlidersHorizontal, HandCoins, GitBranch, Search, X as XIcon } from "lucide-react";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { PageContainer } from "@medialane/ui";
```

to:

```tsx
import { SlidersHorizontal, HandCoins, GitBranch, Search, X as XIcon } from "lucide-react";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { LoadMoreSentinel, PageContainer } from "@medialane/ui";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
          {(hasMore || isLoadingMore) && !listedOnly && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="lg"
                disabled={isLoadingMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  `Load more${meta?.total ? ` (${meta.total - allTokens.length} remaining)` : ""}`
                )}
              </Button>
            </div>
          )}
```

to:

```tsx
          {!listedOnly && (
            <LoadMoreSentinel
              hasMore={hasMore}
              isLoading={isLoadingMore}
              onLoadMore={() => setPage((p) => p + 1)}
            />
          )}
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-starknet && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-starknet
git add "src/app/[ipType]/ip-type-page-client.tsx"
git commit -m "$(cat <<'EOF'
Auto-load IP-type browse grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `medialane-starknet` — `collections-page-client.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/src/app/collections/collections-page-client.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { CollectionCard, CollectionCardSkeleton } from "@medialane/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HelpIcon } from "@/components/ui/help-icon";
import { Layers, Loader2, BadgeCheck, Eye, SlidersHorizontal, Award, Package } from "lucide-react";
```

to:

```tsx
import { CollectionCard, CollectionCardSkeleton, LoadMoreSentinel } from "@medialane/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HelpIcon } from "@/components/ui/help-icon";
import { Layers, BadgeCheck, Eye, SlidersHorizontal, Award, Package } from "lucide-react";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={isLoading}
              >
                {isLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</>
                  : `Load more (${(meta?.total ?? 0) - allCollections.length} remaining)`}
              </Button>
            </div>
          )}
```

to:

```tsx
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={() => setPage((p) => p + 1)}
          />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-starknet && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-starknet
git add src/app/collections/collections-page-client.tsx
git commit -m "$(cat <<'EOF'
Auto-load collections grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `medialane-starknet` — `collection-page-client.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/src/app/collections/[contract]/collection-page-client.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Add the import and drop the now-unused `Button`/`Loader2`**

Change:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressDisplay } from "@/components/shared/address-display";
import { Loader2, Flag, Inbox, Sparkles, Lock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/report-dialog";
```

to:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressDisplay } from "@/components/shared/address-display";
import { Flag, Inbox, Sparkles, Lock, Settings } from "lucide-react";
import { LoadMoreSentinel } from "@medialane/ui";
import { ReportDialog } from "@/components/report-dialog";
```

- [ ] **Step 2: Replace the `CollectionItems` Load-more button with the sentinel**

Change:

```tsx
        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
```

to:

```tsx
        <LoadMoreSentinel
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={() => setPage((p) => p + 1)}
        />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-starknet && bunx tsc --noEmit`
Expected: no errors. (`Button` is still exercised elsewhere in this file only via other components' own imports — this file's top-level `Button` import was used solely by the block just removed, so removing it must not leave any other `<Button` reference in this file dangling; there are none per the pre-change audit.)

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-starknet
git add "src/app/collections/[contract]/collection-page-client.tsx"
git commit -m "$(cat <<'EOF'
Auto-load collection items grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `medialane-starknet` — `assets-grid.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/src/components/portfolio/assets-grid.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { EmptyOrError } from "@/components/ui/empty-or-error";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2 } from "lucide-react";
import { useMarketplace } from "@/hooks/use-marketplace";
```

to:

```tsx
import { EmptyOrError } from "@/components/ui/empty-or-error";
import { LoadMoreSentinel } from "@medialane/ui";
import { ImageIcon } from "lucide-react";
import { useMarketplace } from "@/hooks/use-marketplace";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
        {hasMore && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
```

to:

```tsx
        <LoadMoreSentinel
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={() => setPage((p) => p + 1)}
        />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-starknet && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-starknet
git add src/components/portfolio/assets-grid.tsx
git commit -m "$(cat <<'EOF'
Auto-load portfolio assets grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `medialane-starknet` — `activities-feed.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/src/app/activities/activities-feed.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Megaphone, ArrowRight, Pin } from "lucide-react";
import { ACTIVITY_TYPE_CONFIG, TYPE_FILTERS } from "@/lib/activity";
```

to:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { LoadMoreSentinel } from "@medialane/ui";
import { Zap, Megaphone, ArrowRight, Pin } from "lucide-react";
import { ACTIVITY_TYPE_CONFIG, TYPE_FILTERS } from "@/lib/activity";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
          {(hasMore || isLoadingMore) && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="lg"
                disabled={isLoadingMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  `Load more${
                    meta?.total
                      ? ` (${meta.total - allActivities.length} remaining)`
                      : ""
                  }`
                )}
              </Button>
            </div>
          )}
```

to:

```tsx
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onLoadMore={() => setPage((p) => p + 1)}
          />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-starknet && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-starknet
git add src/app/activities/activities-feed.tsx
git commit -m "$(cat <<'EOF'
Auto-load activities feed on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `medialane-starknet` — `creators-client.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/src/app/creators/creators-client.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { ipfsToHttp } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { AtSign, Search, Users, Palette, Globe, Twitter, X, Loader2 } from "lucide-react";
```

to:

```tsx
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { LoadMoreSentinel } from "@medialane/ui";
import { ipfsToHttp } from "@/lib/utils";
import { BRAND } from "@/lib/brand";
import { AtSign, Search, Users, Palette, Globe, Twitter, X } from "lucide-react";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
            {allCreators.length < total && (
              <div className="flex justify-center pt-6">
                <Button
                  variant="outline"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isLoading}
                >
                  {isLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</>
                    : `Load more (${total - allCreators.length} remaining)`}
                </Button>
              </div>
            )}
```

to:

```tsx
            <LoadMoreSentinel
              hasMore={allCreators.length < total}
              isLoading={isLoading}
              onLoadMore={() => setPage((p) => p + 1)}
            />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-starknet && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-starknet
git add src/app/creators/creators-client.tsx
git commit -m "$(cat <<'EOF'
Auto-load creators grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Bump `@medialane/ui` in `medialane-io`

**Files:**
- Modify: `/Users/medialane/dev/medialane-io/package.json`

**Interfaces:**
- Consumes: `@medialane/ui@0.37.0`'s exported `LoadMoreSentinel` (Task 2).

- [ ] **Step 1: Bump the dependency**

In `/Users/medialane/dev/medialane-io/package.json`, change:

```json
    "@medialane/ui": "0.36.1",
```

to:

```json
    "@medialane/ui": "0.37.0",
```

- [ ] **Step 2: Install**

Run: `cd /Users/medialane/dev/medialane-io && bun install`
Expected: `bun.lock` updates to resolve `@medialane/ui@0.37.0`; no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/medialane/dev/medialane-io
git add package.json bun.lock
git commit -m "$(cat <<'EOF'
Bump @medialane/ui to 0.37.0 for LoadMoreSentinel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `medialane-io` — `listings-grid.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-io/src/components/marketplace/listings-grid.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { PurchaseDialog } from "./purchase-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ApiOrder, SortOrder } from "@medialane/sdk";
```

to:

```tsx
import { PurchaseDialog } from "./purchase-dialog";
import { Button } from "@/components/ui/button";
import { LoadMoreSentinel } from "@medialane/ui";
import type { ApiOrder, SortOrder } from "@medialane/sdk";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
        {(hasMore || isLoadingMore) && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="lg"
              disabled={isLoadingMore}
              onClick={() => setPage((p) => p + 1)}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading…
                </>
              ) : (
                `Load more${!orderType && meta ? ` (${(meta.total ?? 0) - allOrders.length} remaining)` : ""}`
              )}
            </Button>
          </div>
        )}
```

to:

```tsx
        <LoadMoreSentinel
          hasMore={hasMore}
          isLoading={isLoadingMore}
          onLoadMore={() => setPage((p) => p + 1)}
        />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-io && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-io
git add src/components/marketplace/listings-grid.tsx
git commit -m "$(cat <<'EOF'
Auto-load marketplace listings on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `medialane-io` — `ip-type-page-client.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-io/src/app/[ipType]/ip-type-page-client.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { Loader2, SlidersHorizontal, Search, X as XIcon } from "lucide-react";
import { PageContainer } from "@medialane/ui";
```

to:

```tsx
import { SlidersHorizontal, Search, X as XIcon } from "lucide-react";
import { LoadMoreSentinel, PageContainer } from "@medialane/ui";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
          {(hasMore || isLoadingMore) && !listedOnly && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="lg"
                disabled={isLoadingMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  `Load more${meta?.total ? ` (${meta.total - allTokens.length} remaining)` : ""}`
                )}
              </Button>
            </div>
          )}
```

to:

```tsx
          {!listedOnly && (
            <LoadMoreSentinel
              hasMore={hasMore}
              isLoading={isLoadingMore}
              onLoadMore={() => setPage((p) => p + 1)}
            />
          )}
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-io && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-io
git add "src/app/[ipType]/ip-type-page-client.tsx"
git commit -m "$(cat <<'EOF'
Auto-load IP-type browse grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: `medialane-io` — `collections-page-client.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-io/src/app/collections/collections-page-client.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { CollectionCard, CollectionCardSkeleton } from "@medialane/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Layers, Loader2, BadgeCheck, Eye, SlidersHorizontal, Award, Sparkles } from "lucide-react";
```

to:

```tsx
import { CollectionCard, CollectionCardSkeleton, LoadMoreSentinel } from "@medialane/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Layers, BadgeCheck, Eye, SlidersHorizontal, Award, Sparkles } from "lucide-react";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={isLoading}
              >
                {isLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading…</>
                  : `Load more (${(meta?.total ?? 0) - allCollections.length} remaining)`}
              </Button>
            </div>
          )}
```

to:

```tsx
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoading={isLoading}
            onLoadMore={() => setPage((p) => p + 1)}
          />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-io && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-io
git add src/app/collections/collections-page-client.tsx
git commit -m "$(cat <<'EOF'
Auto-load collections grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: `medialane-io` — `collection-page-client.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-io/src/app/collections/[chain]/[contract]/collection-page-client.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`. `Loader2` stays imported — it is also used by this file's `GatedContentPanel` "loading" state, unrelated to the block being edited.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { AssetCard, AssetCardSkeleton } from "@medialane/ui";
```

to:

```tsx
import { AssetCard, AssetCardSkeleton, LoadMoreSentinel } from "@medialane/ui";
```

- [ ] **Step 2: Replace the `CollectionItems` Load-more button with the sentinel**

Change:

```tsx
        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
```

to:

```tsx
        <LoadMoreSentinel
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={() => setPage((p) => p + 1)}
        />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-io && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-io
git add "src/app/collections/[chain]/[contract]/collection-page-client.tsx"
git commit -m "$(cat <<'EOF'
Auto-load collection items grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: `medialane-io` — `assets-grid.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-io/src/components/portfolio/assets-grid.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";
import { EmptyOrError } from "@/components/ui/empty-or-error";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2 } from "lucide-react";
import type { ApiToken } from "@medialane/sdk";
```

to:

```tsx
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";
import { EmptyOrError } from "@/components/ui/empty-or-error";
import { LoadMoreSentinel } from "@medialane/ui";
import { ImageIcon } from "lucide-react";
import type { ApiToken } from "@medialane/sdk";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
        {hasMore && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
```

to:

```tsx
        <LoadMoreSentinel
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={() => setPage((p) => p + 1)}
        />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-io && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-io
git add src/components/portfolio/assets-grid.tsx
git commit -m "$(cat <<'EOF'
Auto-load portfolio assets grid on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: `medialane-io` — `activities-feed.tsx`

**Files:**
- Modify: `/Users/medialane/dev/medialane-io/src/app/activities/activities-feed.tsx`

**Interfaces:**
- Consumes: `LoadMoreSentinel` from `@medialane/ui`.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Megaphone, ArrowRight, Pin } from "lucide-react";
import { ACTIVITY_TYPE_CONFIG, TYPE_FILTERS } from "@/lib/activity";
```

to:

```tsx
import { Skeleton } from "@/components/ui/skeleton";
import { LoadMoreSentinel } from "@medialane/ui";
import { Zap, Megaphone, ArrowRight, Pin } from "lucide-react";
import { ACTIVITY_TYPE_CONFIG, TYPE_FILTERS } from "@/lib/activity";
```

- [ ] **Step 2: Replace the Load-more button with the sentinel**

Change:

```tsx
          {(hasMore || isLoadingMore) && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="lg"
                disabled={isLoadingMore}
                onClick={() => setPage((p) => p + 1)}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  `Load more${
                    meta?.total
                      ? ` (${meta.total - allActivities.length} remaining)`
                      : ""
                  }`
                )}
              </Button>
            </div>
          )}
```

to:

```tsx
          <LoadMoreSentinel
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onLoadMore={() => setPage((p) => p + 1)}
          />
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/medialane/dev/medialane-io && bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-io
git add src/app/activities/activities-feed.tsx
git commit -m "$(cat <<'EOF'
Auto-load activities feed on scroll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Manual smoke test (both apps)

**Files:** none — verification only.

- [ ] **Step 1: Start medialane-starknet locally**

Run: `cd /Users/medialane/dev/medialane-starknet && bun run dev`
Expected: dev server starts on `http://localhost:3000` (or the app's configured port) with no build errors.

- [ ] **Step 2: Smoke each converted page in the browser**

For each of these URLs, scroll to the bottom of the grid/list and confirm the next page of results appears automatically (no click), then confirm loading stops cleanly with no visible sentinel/empty gap once the last page is reached:
- `/marketplace` (listings-grid)
- `/nft` or any `/[ipType]` route (ip-type-page-client)
- `/collections` (collections-page-client)
- any `/collections/[contract]` with more than one page of items (collection-page-client)
- `/portfolio` (assets-grid, on a wallet with 20+ assets)
- `/activities` (activities-feed)
- `/creators` (creators-client)

- [ ] **Step 3: Stop the starknet dev server, start medialane-io**

Run: `cd /Users/medialane/dev/medialane-io && bun run dev`
Expected: dev server starts with no build errors.

- [ ] **Step 4: Smoke the same 6 page types in medialane-io**

Same as Step 2, minus `/creators` (not paginated in io):
- `/marketplace`, `/[ipType]`, `/collections`, `/collections/[chain]/[contract]`, `/portfolio`, `/activities`.

- [ ] **Step 5: Report results to the user**

Summarize which pages were smoke-tested successfully in both apps and flag anything that didn't auto-load as expected before considering this plan complete.
