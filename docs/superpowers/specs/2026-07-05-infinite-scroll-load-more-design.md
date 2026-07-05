# Infinite scroll for asset-listing pages

Date: 2026-07-05
Repos affected: `medialane-ui` (new component), `medialane-starknet`, `medialane-io`

## Problem

Every page that paginates a list of assets/collections/creators/activities uses
a manual "Load more" button: the user clicks, the button shows a spinner, more
items append. This works but is one extra tap per page of results. Auto-loading
on scroll is more user-friendly and is the requested change, applied
consistently across both apps.

## Current state

Both apps independently implement the same pagination shape in 6–7 files each:
accumulate items into local state across backend pages, slice to a
client-visible window, and expose `hasMore` / `isLoadingMore` booleans driving
a `<Button onClick={handleLoadMore}>Load more</Button>`. The accumulation
logic differs slightly per page (offers vs listings filtering, collections vs
tokens, etc.) but the trigger — a button click that bumps a page/visible-count
counter — is identical everywhere.

Files with this pattern:

**medialane-starknet** (7):
- `src/components/marketplace/listings-grid.tsx`
- `src/app/[ipType]/ip-type-page-client.tsx`
- `src/app/collections/collections-page-client.tsx`
- `src/app/collections/[contract]/collection-page-client.tsx`
- `src/components/portfolio/assets-grid.tsx`
- `src/app/activities/activities-feed.tsx`
- `src/app/creators/creators-client.tsx`

**medialane-io** (6 — no paginated creators page):
- `src/components/marketplace/listings-grid.tsx`
- `src/app/[ipType]/ip-type-page-client.tsx`
- `src/app/collections/collections-page-client.tsx`
- `src/app/collections/[chain]/[contract]/collection-page-client.tsx`
- `src/components/portfolio/assets-grid.tsx`
- `src/app/activities/activities-feed.tsx`

`@medialane/ui` (currently 0.36.1) has no existing scroll/observer utility.

## Design

### `LoadMoreSentinel` — new shared component in `@medialane/ui`

A small presentational, headless-ish component — no data fetching, no styling
opinions beyond being invisible. One new file,
`src/components/load-more-sentinel.tsx`, exported from the package root.

```tsx
interface LoadMoreSentinelProps {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  rootMargin?: string; // default "400px"
}

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

Notes on behavior:
- `rootMargin: "400px"` fires the load ~400px before the sentinel is
  physically on screen, so the next page is usually ready before the user
  scrolls to the true bottom — avoids a visible pause/gap.
- The observer callback can fire repeatedly while the sentinel stays
  intersecting (e.g. slow network, short page of results). The component
  guards this itself: it skips calling `onLoadMore` while `isLoading` is true,
  same as the `disabled={isLoadingMore}` guard the buttons have today — so
  callers pass their existing `isLoadingMore` value straight through with no
  new logic needed.
- Renders nothing (`null`) once `hasMore` is false — no dangling observer, no
  layout impact.
- No IntersectionObserver polyfill — supported in all browsers Medialane
  targets.

### Per-page changes (both apps)

In each of the files listed above:
1. Remove the `<Button onClick={handleLoadMore}>...Load more...</Button>`
   block (and the "all N shown" trailing message stays, if present).
2. Render `<LoadMoreSentinel hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={handleLoadMore} />` in its place.
3. Keep all existing accumulation state, `handleLoadMore`, `hasMore`,
   `isLoadingMore` derivations, and the existing loading skeletons/spinner
   rows exactly as they are today — only the trigger mechanism changes from
   click to scroll-into-view.
4. Empty-state and zero-results branches are untouched.

No page's pagination *logic* changes — this is purely swapping the trigger.

### Out of scope

- No virtualization of long lists (not requested, separate concern).
- No change to backend page sizes or API contracts.
- `medialane-io`'s `creators-client.tsx` is unpaginated today and is not
  touched by this change.
- No manual "Load more" fallback button is kept. If the `IntersectionObserver`
  ever fails to fire (unexpected), there is currently no manual retry
  affordance — acceptable given browser support is universal today; revisit
  only if this becomes a real reported issue.

## Rollout

1. Add `LoadMoreSentinel` to `@medialane/ui`, publish a new version.
2. Bump `@medialane/ui` in `medialane-starknet`, update the 7 files.
3. Bump `@medialane/ui` in `medialane-io`, update the 6 files.
4. Manual smoke test per page in both apps: scroll to bottom, confirm the next
   page loads without a click, confirm it stops cleanly at the last page.
