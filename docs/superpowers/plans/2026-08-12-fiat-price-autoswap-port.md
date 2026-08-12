# Fiat Price Display + Auto-Swap Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the fiat-first price display (dual-price cards, coin chips, decluttered layout) and frictionless auto-swap purchases already shipped in medialane-io to medialane-starknet, plus fix a shared-component gap discovered along the way (`TokenCard`'s price chip, used by both apps, never got the fiat redesign).

**Architecture:** Phase 1 wires the existing `@medialane/ui` price components (already carrying `usdValue` support from io's work) into the dapp, and extends `TokenCard` — the one shared component that still lacks it — with the same treatment, fixing it in both apps at once. Phase 2 ports io's AVNU-swap-on-purchase flow, adapted to the dapp's `checkoutCart`/multi-wallet-kind architecture (no gas sponsorship here, unlike io).

**Tech Stack:** Next.js (medialane-starknet), Bun (test runner + package manager), `@medialane/ui` (shared component package), `@medialane/sdk`, `@avnu/avnu-sdk@4.2.0`, starknet.js.

## Global Constraints

- Every AVNU swap call runs server-side (never the browser) and bills `medialane-backend`'s `/v1/swap/{quote,build}/meter` first — these routes are already live (io PR #105), no backend changes in this plan.
- Fixed 1% slippage, exact-output swap request — not user-adjustable in this phase.
- Auto-swap source tokens: the fixed 5-token shortlist already defined in `src/utils/swap-tokens.ts`'s `SWAP_TOKENS` (ETH, STRK, USDC, USDT, WBTC) — same list io uses via `SUPPORTED_TOKENS`.
- No gas sponsorship for the dapp's auto-swap — every wallet kind (Ready/Braavos/injected/Cartridge/Privy) pays its own gas via normal fee estimation, exactly as every other dapp write already does.
- Cartridge users get a normal signature prompt for swap calls (falls outside the static session policy), same precedent as listing/offer today — no picker gating by wallet kind.
- `docs/` is **not** gitignored in medialane-starknet (unlike io) — plan/spec docs commit normally.

---

## File Structure

**medialane-ui** (shared package, published to npm, consumed by both apps):
- Modify: `src/components/token-card.tsx` — add `usdValue` prop, redesign the price chip.

**medialane-io** (wire the `TokenCard` fix at its 5 call sites):
- Modify: `src/app/search/page.tsx`, `src/app/creator/[address]/creator-username-client.tsx`, `src/app/account/[address]/creator-page-client.tsx`, `src/components/creator/collection-carousel-row.tsx`, `src/components/portfolio/assets-grid.tsx`, `package.json` (bump `@medialane/ui`).

**medialane-starknet** (Phase 1 — fiat display):
- Create: `src/hooks/use-usd-prices.ts`
- Modify: `src/lib/utils.ts` (add `usdValueFor`), `package.json` (bump `@medialane/ui`), `src/components/marketplace/listing-card.tsx`, `src/app/asset/[chain]/[contract]/[tokenId]/asset-page-{standard,membership,edition,ticket,drop}.tsx` (5 files), `src/app/collections/[chain]/[contract]/collection-page-client.tsx`, `src/components/shared/token-card.tsx`, `src/components/marketplace/offer-dialog.tsx`, `src/components/marketplace/counter-offer-dialog.tsx`.

**medialane-starknet** (Phase 2 — auto-swap):
- Create: `src/lib/swap-billing.ts`, `src/lib/swap-billing.test.ts`, `src/app/api/wallet/swap/quote/route.ts`, `src/app/api/wallet/swap/build/route.ts`, `src/hooks/use-swap-quote.ts`, `src/lib/swap-calls.ts`, `src/components/marketplace/pay-with-picker.tsx`.
- Modify: `package.json` (add `@avnu/avnu-sdk`), `src/hooks/use-marketplace.ts` (`checkoutCart` gains `swapCalls`), `src/components/marketplace/purchase-dialog.tsx`.

---

## Phase 1: Fiat price display

### Task 1: Redesign TokenCard's price chip in @medialane/ui

**Repo:** medialane-ui

**Files:**
- Modify: `src/components/token-card.tsx`
- Test: none (package has no test suite for this component; verified via `bun run typecheck` + `bun run build`)

**Interfaces:**
- Produces: `TokenCardProps.usdValue?: string | null` — pre-formatted USD equivalent of the token's active listing price (e.g. `"$13.15"`), host-computed. `undefined`/`null` renders the crypto-only chip (today's behavior).

- [ ] **Step 1: Add the `usdValue` prop and `isStableCurrency` import**

Edit `src/components/token-card.tsx`, add to the imports:

```tsx
import { formatDisplayPrice, isStableCurrency } from "../utils/format.js";
```
(replaces the existing `import { formatDisplayPrice } from "../utils/format.js";`)

Add to `TokenCardProps` (after `onReport?: (token: ApiToken) => void;`):

```tsx
  /**
   * Pre-formatted USD equivalent of the active listing price (e.g.
   * "$13.15"), computed by the host from its own live rate feed — this
   * package has no price-feed access by design. Omit/null renders the
   * crypto-only chip.
   */
  usdValue?: string | null;
```

Add `usdValue` to the destructured props in `export function TokenCard({ ... })`:

```tsx
export function TokenCard({
  token,
  isOwner = false,
  onList,
  onTransfer,
  onCancel,
  onBuy,
  onOffer,
  onReport,
  usdValue,
}: TokenCardProps) {
```

- [ ] **Step 2: Redesign the price chip**

Replace the existing price-chip block:

```tsx
          {/* Price chip — bottom right overlay */}
          {listingOrder && (
            <div className="absolute bottom-2 right-2 z-10">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-2xs font-bold bg-background/90 backdrop-blur-sm border border-border/40 shadow-sm">
                <CurrencyIcon symbol={listingOrder.price.currency ?? ""} size={10} />
                {formatDisplayPrice(listingOrder.price.formatted)}
                <span className="text-muted-foreground font-normal">{listingOrder.price.currency}</span>
              </span>
            </div>
          )}
```

with:

```tsx
          {/* Price chip — bottom right overlay. Fiat leads when a live rate
              is available; the crypto amount trails, dimmer, middot-
              separated — same language as AssetCard's pill. Stablecoins
              collapse to fiat + symbol alone (no duplicate number). */}
          {listingOrder && (() => {
            const cryptoDisplay = formatDisplayPrice(listingOrder.price.formatted);
            const stable = isStableCurrency(listingOrder.price.currency);
            return (
              <div className="absolute bottom-2 right-2 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-bold bg-background/90 backdrop-blur-sm border border-border/40 shadow-sm tabular-nums">
                  {usdValue ? (
                    <>
                      {usdValue}
                      <span className="text-muted-foreground/50">·</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
                        <CurrencyIcon symbol={listingOrder.price.currency ?? ""} size={12} />
                        {stable ? listingOrder.price.currency : cryptoDisplay}
                      </span>
                    </>
                  ) : (
                    <>
                      <CurrencyIcon symbol={listingOrder.price.currency ?? ""} size={13} />
                      {cryptoDisplay}
                    </>
                  )}
                </span>
              </div>
            );
          })()}
```

- [ ] **Step 3: Typecheck and build**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run build`
Expected: builds clean, `dist/components/token-card.d.ts` includes the new `usdValue` field (spot-check with `grep usdValue dist/components/token-card.d.ts`).

- [ ] **Step 4: Bump version, publish**

Edit `package.json`, bump `"version"` to the next patch after whatever is currently published (check `bun run build 2>&1 | tail -1` output or `cat package.json | grep version` beforehand — at time of writing the package is at `0.114.0`, so this becomes `0.115.0`).

Create a temporary `.npmrc` with the npm auth token (ask the user for it if not already available in this session — never hardcode or reuse a token from a different session without re-confirming it's still valid):

```
//registry.npmjs.org/:_authToken=<TOKEN>
```

Run: `bun publish --access public`
Expected: `+ @medialane/ui@0.115.0` (or whatever version was set).

Delete the `.npmrc` immediately after (`rm .npmrc`) — never commit it, it's already gitignored but don't rely on that alone.

- [ ] **Step 5: Commit**

```bash
git add package.json src/components/token-card.tsx
git commit -m "feat(TokenCard): add usdValue prop, redesign price chip

Same dual-price/coin-chip treatment as AssetCard and
AssetMarketplacePanel — fiat leads, crypto trails dimmer,
stablecoins collapse to fiat + symbol alone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Wire usdValue into medialane-io's TokenCard call sites

**Repo:** medialane-io

**Files:**
- Modify: `package.json`, `src/app/search/page.tsx`, `src/app/creator/[address]/creator-username-client.tsx`, `src/app/account/[address]/creator-page-client.tsx`, `src/components/creator/collection-carousel-row.tsx`, `src/components/portfolio/assets-grid.tsx`

**Interfaces:**
- Consumes: `TokenCardProps.usdValue` (Task 1), `useUsdPrices()` from `@/hooks/use-usd-prices` (already exists in io), `usdValueFor` from `@/lib/wallet-format` (already exists in io).

Every call site follows the identical pattern: derive the token's active listing order the same way `TokenCard` does internally (`token.activeOrders?.find(o => o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155")`), compute `usdValueFor(listingOrder?.price.formatted, listingOrder?.price.currency, usdPrices)`, pass as `usdValue`.

- [ ] **Step 1: Bump `@medialane/ui`**

```bash
cd /Users/medialane/dev/medialane-io
```

Edit `package.json`, set `"@medialane/ui": "0.115.0"` (or whatever version Task 1 published).

Run: `bun install`
Expected: `+ @medialane/ui@0.115.0`.

- [ ] **Step 2: Wire `search/page.tsx`**

Read the file around the `<TokenCard key={...} token={t} />` call (line ~308) to confirm the exact variable holding the mapped token array (likely `results` or similar — read the surrounding `.map()` call first). Add near the top of the component:

```tsx
import { useUsdPrices } from "@/hooks/use-usd-prices";
import { usdValueFor } from "@/lib/wallet-format";
```

Inside the component body (before the render):

```tsx
  const usdPrices = useUsdPrices();
```

Replace:

```tsx
                  <TokenCard key={`${t.contractAddress}-${t.tokenId}`} token={t} />
```

with:

```tsx
                  <TokenCard
                    key={`${t.contractAddress}-${t.tokenId}`}
                    token={t}
                    usdValue={usdValueFor(
                      t.activeOrders?.find((o) => o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155")?.price.formatted,
                      t.activeOrders?.find((o) => o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155")?.price.currency,
                      usdPrices
                    )}
                  />
```

- [ ] **Step 3: Wire `creator-page-client.tsx`**

Read the file around line ~304 (`<TokenCard key={...} ... />`) to see its exact prop list (it passes more props than search's bare usage — preserve all existing props, only add `usdValue`). Add the same `useUsdPrices`/`usdValueFor` imports and `usdPrices` hook call as Step 2, then add the same `usdValue={usdValueFor(...)}` prop (same derivation expression, using whatever the mapped token variable is named there — confirm from the `.map()` call).

- [ ] **Step 4: Wire `creator-username-client.tsx`, `collection-carousel-row.tsx`, `assets-grid.tsx`**

Same pattern for each: add the two imports, call `useUsdPrices()` once in the component, add `usdValue={usdValueFor(token.activeOrders?.find(...)?.price.formatted, ...)}` to each `<TokenCard>` call. Read each file's exact `<TokenCard>` call site first (variable naming for the mapped token differs per file — `t`, `token`, etc.) before editing, since the derivation expression must reference the correct variable name in scope.

Note: `assets-grid.tsx`'s `TokenCard` usage passes `isOwner onList={...} onTransfer={...} onCancel={...}` — these are the *owner's own* listings, so `usdValue` still applies the same way (an owner's listing still has a USD-equivalent price worth showing).

- [ ] **Step 5: Typecheck, lint, test**

```bash
bun run typecheck
bun run lint
bun test src
```
Expected: typecheck clean, lint shows no new warnings, all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add package.json src/app/search/page.tsx src/app/creator/[address]/creator-username-client.tsx src/app/account/[address]/creator-page-client.tsx src/components/creator/collection-carousel-row.tsx src/components/portfolio/assets-grid.tsx
git commit -m "feat: wire usdValue into TokenCard call sites

Bumps @medialane/ui to 0.115.0 (TokenCard's fiat-pill redesign) and
wires it through search, creator pages, the collection carousel, and
the portfolio assets grid — the last surfaces still showing a
crypto-only price chip.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

Push a branch, open a PR (`gh pr create`), wait for the Vercel preview check to pass, merge (`gh pr merge --merge --delete-branch`) — same flow used for every io PR this session.

---

### Task 3: medialane-starknet — add useUsdPrices hook + usdValueFor util, bump @medialane/ui

**Repo:** medialane-starknet

**Files:**
- Create: `src/hooks/use-usd-prices.ts`
- Modify: `src/lib/utils.ts`, `package.json`

**Interfaces:**
- Produces: `useUsdPrices(): UsdPrices | null` (polls `/api/proxy/v1/prices` every 60s), `usdValueFor(amountFormatted, currency, usdPrices): string | null`.

- [ ] **Step 1: Bump `@medialane/ui`**

Edit `package.json`, set `"@medialane/ui": "0.115.0"`.

Run: `bun install`
Expected: `+ @medialane/ui@0.115.0`.

- [ ] **Step 2: Create `use-usd-prices.ts`**

```tsx
"use client";

import { useEffect, useState } from "react";

export type UsdPrices = Partial<Record<"STRK" | "ETH" | "USDC" | "USDT" | "WBTC", number>>;

const REFRESH_MS = 60_000;

export function useUsdPrices(): UsdPrices | null {
  const [prices, setPrices] = useState<UsdPrices | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/proxy/v1/prices")
        .then((r) => r.json())
        .then((r: { data?: { usd?: UsdPrices } }) => {
          if (!cancelled && r.data?.usd) setPrices(r.data.usd);
        })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return prices;
}
```

- [ ] **Step 3: Add `usdValueFor` to `src/lib/utils.ts`**

Add near `formatDisplayPrice` (both live in the same file already):

```tsx
import type { UsdPrices } from "@/hooks/use-usd-prices";

const fmtUsd = (n: number): string =>
  n > 0 && n < 0.01 ? "<$0.01" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * USD equivalent of a human-readable token amount, or null when there's no
 * live rate for the currency — callers must render nothing rather than a
 * stale or fabricated conversion.
 */
export function usdValueFor(
  amountFormatted: string | null | undefined,
  currency: string | null | undefined,
  usdPrices: UsdPrices | null
): string | null {
  if (!amountFormatted || !currency || !usdPrices) return null;
  const rate = usdPrices[currency.toUpperCase() as keyof UsdPrices];
  if (rate == null) return null;
  const amount = parseFloat(amountFormatted);
  if (isNaN(amount)) return null;
  return fmtUsd(amount * rate);
}
```

Place this import at the top of `src/lib/utils.ts` alongside its existing imports (check the file's current import block first — `src/lib/utils.ts` is a shared utility file, add without disturbing existing exports).

- [ ] **Step 4: Typecheck**

Run: `bun run typecheck`
Expected: no errors. (Note: `@/lib/utils` importing from `@/hooks/use-usd-prices` for a type-only import is safe — no circular runtime dependency since it's `import type`.)

- [ ] **Step 5: Commit**

```bash
git add package.json src/hooks/use-usd-prices.ts src/lib/utils.ts
git commit -m "feat: add useUsdPrices hook + usdValueFor util

Bumps @medialane/ui to 0.115.0. Same pattern as medialane-io's
implementation — polls the existing /api/proxy/v1/prices BFF proxy,
no new backend work needed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire usdValue into ListingCard wrapper (covers marketplace grid + New listings carousel)

**Repo:** medialane-starknet

**Files:**
- Modify: `src/components/marketplace/listing-card.tsx`

**Interfaces:**
- Consumes: `useUsdPrices` (Task 3), `usdValueFor` (Task 3), `PackageListingCard`'s `usdValue` prop (already published in `@medialane/ui`, carried in by Task 3's bump).

- [ ] **Step 1: Wire the wrapper**

Edit `src/components/marketplace/listing-card.tsx`. Add imports:

```tsx
import { useUsdPrices } from "@/hooks/use-usd-prices";
import { usdValueFor } from "@/lib/utils";
```

Inside `export function ListingCard({ order, onBuy, compact = false }: ListingCardProps)`, after the existing `const [reportOpen, setReportOpen] = useState(false);` line, add:

```tsx
  const usdPrices = useUsdPrices();
  const usdValue = usdValueFor(order.price?.formatted, order.price?.currency, usdPrices);
```

In the `<PackageListingCard ... />` call, add the prop:

```tsx
      <PackageListingCard
        order={order}
        onBuy={onBuy}
        compact={compact}
        overflowMenu={overflowMenu}
        imageUrl={imageUrl}
        usdValue={usdValue}
      />
```

This single change covers every caller of this wrapper — the marketplace grid page and `components/home/new-on-marketplace.tsx` both render `<ListingCard order={...} />` without needing any changes themselves.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketplace/listing-card.tsx
git commit -m "feat: wire usdValue into ListingCard wrapper

Self-contained in the wrapper, so every caller (marketplace grid,
home's New listings carousel) gets the fiat price for free.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire usdValue into the 5 asset-page variants

**Repo:** medialane-starknet

**Files:**
- Modify: `src/app/asset/[chain]/[contract]/[tokenId]/asset-page-standard.tsx`, `asset-page-membership.tsx`, `asset-page-edition.tsx`, `asset-page-ticket.tsx`, `asset-page-drop.tsx`

**Interfaces:**
- Consumes: `useUsdPrices`, `usdValueFor` (Task 3), `AssetMarketplacePanel`'s `usdValue` prop (already published).

All 5 files share the identical `const { activeListings, activeBids, cheapest, isOwner, myListing, ... } = useAssetMarketState(token, listings, walletAddress);` destructure and an `<AssetMarketplacePanel cheapest={cheapest} ... floorPriceRaw={collection?.floorPrice} ... />` call — same edit at each.

- [ ] **Step 1: Wire `asset-page-standard.tsx`**

Add import near the top (alongside the existing `import { ipfsToHttp } from "@/lib/utils";` line):

```tsx
import { usdValueFor } from "@/lib/utils";
import { useUsdPrices } from "@/hooks/use-usd-prices";
```

After the `} = useAssetMarketState(token, listings, walletAddress);` line, add:

```tsx
  const usdPrices = useUsdPrices();
  const cheapestUsd = usdValueFor(cheapest?.price?.formatted, cheapest?.price?.currency, usdPrices);
```

In the `<AssetMarketplacePanel ... floorPriceRaw={collection?.floorPrice} .../>` block, add the prop right after `floorPriceRaw`:

```tsx
              floorPriceRaw={collection?.floorPrice}
              usdValue={cheapestUsd}
```

- [ ] **Step 2: Repeat identically for `asset-page-membership.tsx`, `asset-page-edition.tsx`, `asset-page-ticket.tsx`, `asset-page-drop.tsx`**

Same three edits (import, `usdPrices`/`cheapestUsd` computation after the `useAssetMarketState` destructure, `usdValue={cheapestUsd}` prop after `floorPriceRaw`) in each of the remaining 4 files. Read each file's existing import block first to place the two new imports alongside whatever's already imported from `@/lib/utils` and `@/hooks/*` (avoid duplicate imports if either module is already partially imported).

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors across all 5 files.

- [ ] **Step 4: Commit**

```bash
git add src/app/asset/\[chain\]/\[contract\]/\[tokenId\]/asset-page-standard.tsx src/app/asset/\[chain\]/\[contract\]/\[tokenId\]/asset-page-membership.tsx src/app/asset/\[chain\]/\[contract\]/\[tokenId\]/asset-page-edition.tsx src/app/asset/\[chain\]/\[contract\]/\[tokenId\]/asset-page-ticket.tsx src/app/asset/\[chain\]/\[contract\]/\[tokenId\]/asset-page-drop.tsx
git commit -m "feat: wire usdValue into all 5 asset-page variants

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire usdValue into collection-page-client.tsx's TokenCard

**Repo:** medialane-starknet

**Files:**
- Modify: `src/app/collections/[chain]/[contract]/collection-page-client.tsx`

**Interfaces:**
- Consumes: `useUsdPrices`, `usdValueFor` (Task 3), local `TokenCard` wrapper's `usdValue` prop (Task 7 adds this — **do this task after Task 7**, or pass `usdValue` straight to `@medialane/ui`'s underlying prop name once Task 7 threads it through; sequencing note below).

> **Sequencing:** `src/components/shared/token-card.tsx` (the app's `TokenCard` wrapper, edited in Task 7) must forward a `usdValue` prop down to `@medialane/ui`'s `TokenCard` before this task's caller-side wiring has any visible effect. Do Task 7 first, then this task. (Numbering follows the plan's narrative order — file-structure order, not execution order. Executors: run Task 7 before Task 6.)

- [ ] **Step 1: Locate the `<TokenCard>` render call**

Read `src/app/collections/[chain]/[contract]/collection-page-client.tsx` around line 176 (`<TokenCard` — confirmed earlier at line 176) to see the exact prop list and the mapped token variable name (from context gathered during planning, the render loop maps over `filteredTokens` or similar — confirm exact variable name by reading the surrounding `.map()` before editing).

- [ ] **Step 2: Wire it**

Add imports near the existing `import { ipfsToHttp, formatDisplayPrice, cn, checkIsOwner } from "@/lib/utils";` line:

```tsx
import { usdValueFor } from "@/lib/utils";
import { useUsdPrices } from "@/hooks/use-usd-prices";
```

Inside the component body (near other top-level hooks), add:

```tsx
  const usdPrices = useUsdPrices();
```

In the `<TokenCard ... />` call, add:

```tsx
                <TokenCard
                  key={`${t.contractAddress}-${t.tokenId}`}
                  token={t}
                  usdValue={usdValueFor(
                    t.activeOrders?.find((o) => o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155")?.price.formatted,
                    t.activeOrders?.find((o) => o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155")?.price.currency,
                    usdPrices
                  )}
                  {/* ...preserve every other existing prop on this call unchanged... */}
                />
```

(Replace `t` with whatever the actual mapped-token variable is named at this call site — confirmed during Step 1.)

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors — this depends on Task 7 having added `usdValue` to the local `TokenCard` wrapper's prop type first.

- [ ] **Step 4: Commit**

```bash
git add "src/app/collections/[chain]/[contract]/collection-page-client.tsx"
git commit -m "feat: wire usdValue into collection page's TokenCard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Thread usdValue through the local TokenCard wrapper

**Repo:** medialane-starknet

**Files:**
- Modify: `src/components/shared/token-card.tsx`

**Interfaces:**
- Consumes: `@medialane/ui`'s `TokenCard`'s `usdValue` prop (Task 1).
- Produces: local `TokenCard` wrapper's `usdValue?: string | null` prop, for Task 6's caller.

- [ ] **Step 1: Thread the prop through**

Edit `src/components/shared/token-card.tsx`. Change:

```tsx
export function TokenCard(props: Omit<TokenCardProps, "onOffer" | "onReport"> & {
  onOffer?: TokenCardProps["onOffer"];
}) {
```

to:

```tsx
export function TokenCard(props: Omit<TokenCardProps, "onOffer" | "onReport"> & {
  onOffer?: TokenCardProps["onOffer"];
  usdValue?: string | null;
}) {
```

The `<UiTokenCard {...props} .../>` spread already forwards `usdValue` automatically since it's part of the spread `props` object — no further change needed there.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/token-card.tsx
git commit -m "feat: thread usdValue through the local TokenCard wrapper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**Note to executor:** run this task's steps before Task 6's steps, even though it's numbered after in this document (Task 6 depends on it).

---

### Task 8: Wire usdValue into offer-dialog.tsx and counter-offer-dialog.tsx

**Repo:** medialane-starknet

**Files:**
- Modify: `src/components/marketplace/offer-dialog.tsx`, `src/components/marketplace/counter-offer-dialog.tsx`

**Interfaces:**
- Consumes: `useUsdPrices`, `usdValueFor` (Task 3).

- [ ] **Step 1: Wire `offer-dialog.tsx`**

Add imports after the existing `import { CurrencyIcon } from "@/components/shared/currency-icon";` line:

```tsx
import { useUsdPrices } from "@/hooks/use-usd-prices";
import { usdValueFor } from "@/lib/utils";
```

After the `const form = useForm<FormValues>({...});` block, add:

```tsx
  const usdPrices = useUsdPrices();
  const watchedPrice = form.watch("price");
  const watchedCurrency = form.watch("currency");
  const usdEquivalent = usdValueFor(watchedPrice || undefined, watchedCurrency, usdPrices);
```

In the JSX, inside the `<FormField control={form.control} name="price" ...>` block, right after the closing `</div>` of the relative-positioned input wrapper and before `<FormMessage />`, add:

```tsx
                      {usdEquivalent && (
                        <p className="text-xs text-muted-foreground mt-1">≈ {usdEquivalent}</p>
                      )}
```

(This mirrors io's `offer-dialog.tsx` treatment — a small `≈ $X` line under the price input, updating live as the user types.)

- [ ] **Step 2: Wire `counter-offer-dialog.tsx`**

Add the same two imports. After `const form = useForm<FormValues>({...});`, add:

```tsx
  const usdPrices = useUsdPrices();
  const watchedPrice = form.watch("price");
  const usdEquivalent = usdValueFor(watchedPrice || undefined, currencySymbol, usdPrices);
```

In the `<FormField control={form.control} name="price" ...>` block, after `<FormControl>...</FormControl>` and before `<FormMessage />`, add:

```tsx
                    {usdEquivalent && (
                      <p className="text-xs text-muted-foreground">≈ {usdEquivalent}</p>
                    )}
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketplace/offer-dialog.tsx src/components/marketplace/counter-offer-dialog.tsx
git commit -m "feat: show USD equivalent on offer + counter-offer price inputs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Ship Phase 1

**Files:** none (verification + PR)

- [ ] **Step 1: Full verification**

```bash
cd /Users/medialane/dev/medialane-starknet
bun run typecheck
bun run lint
bun test
```
Expected: typecheck clean, lint shows no new warnings/errors, all tests pass.

- [ ] **Step 2: Push, PR, merge**

```bash
git checkout -b feat/fiat-price-display
```

(Tasks 3–8's commits should already be on this branch if executed sequentially — if each task committed to `main` directly, instead `git log` to confirm all commits are present, then push `main`.)

```bash
git push -u origin feat/fiat-price-display
gh pr create --title "Port fiat price display from medialane-io" --body "Ports the fiat-first price display shipped in medialane-io: useUsdPrices hook, usdValueFor util, wired into the marketplace grid, all 5 asset-page variants, the collection page, and offer/counter-offer dialogs. Also fixes TokenCard's price chip (shared with io) to carry the same dual-price treatment — see companion PRs in medialane-ui and medialane-io.

## Test plan
- [x] bun run typecheck — clean
- [x] bun run lint — no new warnings
- [x] bun test — all pass
- [ ] Visual check: marketplace grid, asset page (all 5 variants if reachable), collection page, offer/counter-offer dialogs"
```

Wait for the Vercel preview check to pass (poll `gh pr checks <number>` — Vercel checks typically take several minutes; poll every ~10–15s rather than a long single wait), then:

```bash
gh pr merge <number> --merge --delete-branch
```

---

## Phase 2: Auto-swap purchases

### Task 10: Add @avnu/avnu-sdk dependency

**Repo:** medialane-starknet

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the dependency**

```bash
bun add @avnu/avnu-sdk@4.2.0
```
Expected: `package.json`'s `dependencies` gains `"@avnu/avnu-sdk": "^4.2.0"` (or exact `4.2.0`, matching io's pin), `bun.lock` updates.

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors (nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add @avnu/avnu-sdk for the auto-swap purchase flow

Replaces the unused, swap-incapable @avnu/gasless-sdk (paymaster-only,
no getQuotes/quoteToCalls) for this purpose — gasless-sdk stays as a
dependency for now, removing it is a separate cleanup, not blocking
this feature.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Port swap-billing.ts

**Repo:** medialane-starknet

**Files:**
- Create: `src/lib/swap-billing.ts`
- Test: `src/lib/swap-billing.test.ts`

**Interfaces:**
- Produces: `billSwapCall(action: "quote" | "build"): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/swap-billing.test.ts`:

```ts
import { afterEach, describe, expect, mock, test } from "bun:test";

// Mock the module directly rather than setting process.env — constants.ts
// reads MEDIALANE_API_KEY at module-load time, and bun's module cache is
// process-wide across the whole test run, so whichever test file imports
// "@/lib/constants" first freezes the value for every other test in the
// same `bun test` invocation.
mock.module("@/lib/constants", () => ({
  MEDIALANE_BACKEND_URL: "http://localhost:3001",
  MEDIALANE_API_KEY: "test-key",
}));

describe("billSwapCall", () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete globalThis.fetch;
  });

  test("returns true when the backend accepts the charge", async () => {
    globalThis.fetch = mock(async (url: string, init?: RequestInit) => {
      expect(url).toBe("http://localhost:3001/v1/swap/quote/meter");
      expect((init!.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
      return new Response(JSON.stringify({ data: { billed: true } }), { status: 200 });
    }) as never;

    const { billSwapCall } = await import("./swap-billing");
    expect(await billSwapCall("quote")).toBe(true);
  });

  test("returns false when the backend refuses (insufficient credits)", async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ error: "insufficient credits" }), { status: 402 })) as never;

    const { billSwapCall } = await import("./swap-billing");
    expect(await billSwapCall("build")).toBe(false);
  });

  test("returns false when the billing fetch itself throws", async () => {
    globalThis.fetch = mock(async () => { throw new Error("network down"); }) as never;

    const { billSwapCall } = await import("./swap-billing");
    expect(await billSwapCall("quote")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/lib/swap-billing.test.ts`
Expected: FAIL — `Cannot find module './swap-billing'` or similar (the module doesn't exist yet).

- [ ] **Step 3: Create `src/lib/swap-billing.ts`**

```ts
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

export type SwapAction = "quote" | "build";

/**
 * Bills this app's credit balance for an upcoming AVNU-swap call, via the
 * backend's metered POST /v1/swap/<action>/meter
 * (medialane-backend/src/api/routes/swap-meter.ts). The swap call itself
 * still goes straight to AVNU below — this only makes it a credited action
 * instead of a free bypass.
 *
 * Returns false (caller must refuse to forward to AVNU) on insufficient
 * credits or any billing failure.
 */
export async function billSwapCall(action: SwapAction): Promise<boolean> {
  if (!MEDIALANE_API_KEY) {
    console.error(`[swap:${action}] MEDIALANE_API_KEY is not configured — refusing to bill/forward`);
    return false;
  }
  try {
    const res = await fetch(`${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/swap/${action}/meter`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": MEDIALANE_API_KEY },
    });
    return res.ok;
  } catch (err) {
    console.error(`[swap:${action}] billing call failed`, { err: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/lib/swap-billing.test.ts`
Expected: `3 pass, 0 fail`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/swap-billing.ts src/lib/swap-billing.test.ts
git commit -m "feat: add billSwapCall — bills the shared backend before any AVNU call

Ports medialane-io's swap-billing.ts verbatim (same env vars, same
metered-route pattern, same backend routes — already live from io's
PR #105, no backend changes needed).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Port the /api/wallet/swap/{quote,build} server routes

**Repo:** medialane-starknet

**Files:**
- Create: `src/app/api/wallet/swap/quote/route.ts`, `src/app/api/wallet/swap/build/route.ts`

**Interfaces:**
- Consumes: `billSwapCall` (Task 11).
- Produces: `POST /api/wallet/swap/quote` → `{ quote: {...} }` or `{ error }`; `POST /api/wallet/swap/build` → `{ calls, chainId, quote }` or `{ error }`.

- [ ] **Step 1: Create the quote route**

```bash
mkdir -p src/app/api/wallet/swap/quote src/app/api/wallet/swap/build
```

Create `src/app/api/wallet/swap/quote/route.ts`:

```ts
/**
 * Server-only: fetches an AVNU swap quote for the "pay with any token"
 * auto-swap flow. Billed via billSwapCall before any AVNU call — this
 * route never forwards to AVNU on insufficient credits. AVNU's swap quote
 * endpoint needs no API key, but that doesn't exempt it from metering
 * (see swap-billing.ts).
 *
 * This is the browsing-estimate phase — stale-tolerant, used only to show
 * "≈ X token" in the pay-with picker. The buy-time flow re-fetches a fresh
 * quote itself before calling /swap/build.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@avnu/avnu-sdk";
import { getTokenBySymbol, stringifyBigInts } from "@medialane/sdk";
import { billSwapCall } from "@/lib/swap-billing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { sellSymbol?: string; buySymbol?: string; buyAmountRaw?: string; takerAddress?: string }
    | null;
  if (!body?.sellSymbol || !body.buySymbol || !body.buyAmountRaw) {
    return NextResponse.json(
      { error: "sellSymbol, buySymbol, and buyAmountRaw are required" },
      { status: 400 },
    );
  }

  const sellToken = getTokenBySymbol(body.sellSymbol);
  const buyToken = getTokenBySymbol(body.buySymbol);
  if (!sellToken || !buyToken) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  if (!(await billSwapCall("quote"))) {
    return NextResponse.json({ error: "Insufficient credits or billing unavailable" }, { status: 402 });
  }

  try {
    const quotes = await getQuotes({
      sellTokenAddress: sellToken.address,
      buyTokenAddress: buyToken.address,
      buyAmount: BigInt(body.buyAmountRaw),
      takerAddress: body.takerAddress,
    });
    const best = quotes[0];
    if (!best) {
      return NextResponse.json({ error: "No swap route available for this pair" }, { status: 502 });
    }
    return NextResponse.json({ quote: stringifyBigInts(best) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch swap quote" },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Create the build route**

Create `src/app/api/wallet/swap/build/route.ts`:

```ts
/**
 * Server-only: builds the approve+swap Call[] for the auto-swap-to-purchase
 * flow, via AVNU's getQuotes + quoteToCalls. Billed via billSwapCall before
 * any AVNU call. Companion to quote/route.ts — see that file's header.
 *
 * Always fetches a FRESH quote (never reuses a client-supplied quoteId from
 * the browsing-estimate phase) so the built calldata reflects current
 * market data. buyAmountRaw is treated as an exact-output request: the
 * caller gets exactly that much of buyToken, with slippage applied to how
 * much of sellToken is spent — so the downstream purchase call is always
 * guaranteed enough of the order's currency to succeed.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getQuotes, quoteToCalls } from "@avnu/avnu-sdk";
import { getTokenBySymbol, stringifyBigInts } from "@medialane/sdk";
import { billSwapCall } from "@/lib/swap-billing";

export const runtime = "nodejs";

/** Fixed per the design spec — not user-adjustable in this phase. */
const DEFAULT_SLIPPAGE = 0.01;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { sellSymbol?: string; buySymbol?: string; buyAmountRaw?: string; takerAddress?: string }
    | null;
  if (!body?.sellSymbol || !body.buySymbol || !body.buyAmountRaw || !body.takerAddress) {
    return NextResponse.json(
      { error: "sellSymbol, buySymbol, buyAmountRaw, and takerAddress are required" },
      { status: 400 },
    );
  }

  const sellToken = getTokenBySymbol(body.sellSymbol);
  const buyToken = getTokenBySymbol(body.buySymbol);
  if (!sellToken || !buyToken) {
    return NextResponse.json({ error: "Unsupported currency" }, { status: 400 });
  }

  if (!(await billSwapCall("build"))) {
    return NextResponse.json({ error: "Insufficient credits or billing unavailable" }, { status: 402 });
  }

  try {
    const quotes = await getQuotes({
      sellTokenAddress: sellToken.address,
      buyTokenAddress: buyToken.address,
      buyAmount: BigInt(body.buyAmountRaw),
      takerAddress: body.takerAddress,
    });
    const quote = quotes[0];
    if (!quote) {
      return NextResponse.json({ error: "No swap route available for this pair" }, { status: 502 });
    }

    const built = await quoteToCalls({
      quoteId: quote.quoteId,
      slippage: DEFAULT_SLIPPAGE,
      takerAddress: body.takerAddress,
    });

    return NextResponse.json(stringifyBigInts({ calls: built.calls, chainId: built.chainId, quote }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build swap calls" },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/wallet/swap
git commit -m "feat: add /api/wallet/swap/{quote,build} server routes

Ports medialane-io's routes verbatim (same billing-first pattern, same
AVNU calls). Nothing calls AVNU's swap API from the browser.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: Port use-swap-quote.ts

**Repo:** medialane-starknet

**Files:**
- Create: `src/hooks/use-swap-quote.ts`

**Interfaces:**
- Produces: `useSwapQuote(sellSymbol, buySymbol, buyAmountRaw, takerAddress): { quote: SwapQuoteSummary | null; isLoading: boolean; error?: Error }`.

- [ ] **Step 1: Confirm `swr` is available**

```bash
grep '"swr"' package.json
```
Expected: a version string present (the dapp already uses SWR elsewhere per its hook conventions — `use-orders.ts`/`use-collections.ts` etc. If absent, run `bun add swr` first.)

- [ ] **Step 2: Create the hook**

```tsx
"use client";

import useSWR from "swr";

export interface SwapQuoteSummary {
  quoteId: string;
  sellTokenAddress: string;
  sellAmount: string;
  buyTokenAddress: string;
  buyAmount: string;
}

async function fetchQuote(
  sellSymbol: string,
  buySymbol: string,
  buyAmountRaw: string,
  takerAddress: string | null
): Promise<SwapQuoteSummary> {
  const res = await fetch("/api/wallet/swap/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sellSymbol, buySymbol, buyAmountRaw, takerAddress: takerAddress ?? undefined }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to fetch swap quote");
  }
  const { quote } = (await res.json()) as { quote: SwapQuoteSummary };
  return quote;
}

/**
 * Browsing-estimate swap quote for the "pay with" picker — stale-tolerant,
 * refreshed periodically, informational only. Never reused to build calls;
 * the buy-time flow fetches its own fresh quote via /api/wallet/swap/build
 * (see lib/swap-calls.ts).
 */
export function useSwapQuote(
  sellSymbol: string | null,
  buySymbol: string | null,
  buyAmountRaw: string | null,
  takerAddress: string | null
) {
  const key = sellSymbol && buySymbol && buyAmountRaw
    ? (["swap-quote", sellSymbol, buySymbol, buyAmountRaw, takerAddress] as const)
    : null;
  const { data, error, isLoading } = useSWR(
    key,
    ([, sell, buy, amount, taker]) => fetchQuote(sell, buy, amount, taker),
    {
      refreshInterval: 20_000,
      dedupingInterval: 15_000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );
  return { quote: data ?? null, isLoading, error: error as Error | undefined };
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-swap-quote.ts
git commit -m "feat: add useSwapQuote — browsing-estimate quote for the pay-with picker

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Port swap-calls.ts (buy-time build-calls helper)

**Repo:** medialane-starknet

**Files:**
- Create: `src/lib/swap-calls.ts`

**Interfaces:**
- Produces: `buildSwapCalls(params: { sellSymbol, buySymbol, buyAmountRaw, takerAddress }): Promise<BuiltSwap>`.

- [ ] **Step 1: Create the helper**

```ts
import type { Call } from "starknet";

export interface BuiltSwap {
  calls: Call[];
  chainId: string;
  quote: { quoteId: string; sellAmount: string; buyAmount: string; sellTokenAddress: string; buyTokenAddress: string };
}

/**
 * Buy-time swap-call builder — always fetches a fresh AVNU quote server-side
 * (never reuses the picker's browsing estimate) and returns ready-to-execute
 * approve+swap calls for the exact buyAmountRaw needed. Throws on any
 * failure (no route, quote/build error, insufficient credits) — callers
 * should surface this as "price moved, try again" rather than proceed.
 */
export async function buildSwapCalls(params: {
  sellSymbol: string;
  buySymbol: string;
  buyAmountRaw: string;
  takerAddress: string;
}): Promise<BuiltSwap> {
  const res = await fetch("/api/wallet/swap/build", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to prepare swap");
  }
  return res.json();
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/swap-calls.ts
git commit -m "feat: add buildSwapCalls — fresh quote + calldata at buy time

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: Extend checkoutCart with an optional swapCalls option

**Repo:** medialane-starknet

**Files:**
- Modify: `src/hooks/use-marketplace.ts`
- Test: `src/hooks/use-marketplace.test.ts` (create if it doesn't already exist — check first with `find src/hooks -iname "use-marketplace.test.ts"`)

**Interfaces:**
- Consumes: `Call[]` from starknet.js (already imported in this file).
- Produces: `WriteOpts.swapCalls?: Call[]` — when present, prepended ahead of `fulfillCalls` in `checkoutCart`'s final `signer.execute()` call. Existing two call sites (`purchase-dialog.tsx`, `counter-offers-table.tsx`) are unaffected — this is a new optional field on an options object, not a new positional parameter, so neither existing call site needs to change.

- [ ] **Step 1: Check for an existing test file**

```bash
find src/hooks -iname "use-marketplace.test.ts"
```

If it exists, read it fully before proceeding (to match its existing test patterns/mocking style exactly). If it doesn't exist, skip straight to Step 2 — this task doesn't introduce a new testable unit in isolation (it's a small internal change to an existing, already-covered-elsewhere flow); verification is via typecheck + the manual/prod check in Task 17.

- [ ] **Step 2: Extend `WriteOpts` and thread `swapCalls` through**

Edit `src/hooks/use-marketplace.ts`. Change:

```ts
interface WriteOpts { silent?: boolean }
```

to:

```ts
interface WriteOpts {
  silent?: boolean;
  /** Auto-swap approve+swap calls (from lib/swap-calls.ts), prepended
   *  ahead of the fulfill calls in the same atomic multicall when the
   *  buyer is paying with a token other than the order's own currency. */
  swapCalls?: Call[];
}
```

In `checkoutCart`, find:

```ts
            const { txHash: hash } = await signer.execute([...fulfillCalls, ...feeCalls]);
```

and change to:

```ts
            // Auto-swap calls (if any) go FIRST — swap into the order's
            // currency, then fulfill, then the platform fee. Same atomicity
            // guarantee as every other bundled call here: swap and purchase
            // either both land or both fail.
            const { txHash: hash } = await signer.execute([
              ...(opts?.swapCalls ?? []),
              ...fulfillCalls,
              ...feeCalls,
            ]);
```

- [ ] **Step 3: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 4: Run the existing marketplace hook tests (if any) plus the full suite**

Run: `bun test`
Expected: all existing tests still pass (this change is additive/backward-compatible — no existing behavior changes when `opts.swapCalls` is omitted).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-marketplace.ts
git commit -m "feat: checkoutCart accepts optional swapCalls, prepended into the multicall

Adapts medialane-io's runIntent prependCalls pattern to this app's
checkoutCart — an options-bag field rather than a new positional
parameter, so the two existing call sites (purchase-dialog,
counter-offers-table) need no changes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: Port pay-with-picker.tsx (adapted to this app's balance hook)

**Repo:** medialane-starknet

**Files:**
- Create: `src/components/marketplace/pay-with-picker.tsx`

**Interfaces:**
- Consumes: `useTokenBalance(symbol, address): { raw, formatted, isLoading, error, refresh }` (existing, `src/hooks/use-token-balance.ts` — note: keyed by **symbol**, not address, unlike io's address-keyed hook), `SWAP_TOKENS` (existing, `src/utils/swap-tokens.ts`), `useSwapQuote` (Task 13), `isStableCurrency` (from `@medialane/ui`, already published), `CurrencyIcon` (existing, `src/components/shared/currency-icon.tsx`).
- Produces: `<PayWithPicker orderCurrency requiredRaw walletAddress selected onSelect />`.

- [ ] **Step 1: Check `formatTokenAmount`'s signature matches what's needed for display**

Already confirmed in `src/utils/swap-tokens.ts`: `formatTokenAmount(raw: bigint, decimals: number): string`. Use this instead of io's `fmt()` from `wallet-format.ts` (which doesn't exist in this app).

- [ ] **Step 2: Create the picker**

```tsx
"use client";

import { Loader2 } from "lucide-react";
import { isStableCurrency } from "@medialane/ui";
import { SWAP_TOKENS } from "@/utils/swap-tokens";
import { formatTokenAmount } from "@/utils/swap-tokens";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useSwapQuote } from "@/hooks/use-swap-quote";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { cn } from "@/lib/utils";

interface PayWithOptionProps {
  symbol: string;
  decimals: number;
  orderCurrency: string;
  requiredRaw: bigint;
  walletAddress: string | null;
  selected: boolean;
  onSelect: () => void;
}

function PayWithOption({
  symbol, decimals, orderCurrency, requiredRaw, walletAddress, selected, onSelect,
}: PayWithOptionProps) {
  const { raw: rawBalance } = useTokenBalance(symbol, walletAddress ?? undefined);
  const hasBalance = rawBalance !== null && rawBalance > 0n;

  // Only fetch a browsing quote for tokens the user actually holds — a zero
  // balance can never cover the purchase regardless of rate, so there's no
  // reason to spend a credit finding out.
  const { quote, isLoading } = useSwapQuote(
    hasBalance ? symbol : null,
    orderCurrency,
    hasBalance ? requiredRaw.toString() : null,
    walletAddress
  );

  const sellAmount = quote ? BigInt(quote.sellAmount) : null;
  const insufficient = !hasBalance || (sellAmount !== null && rawBalance! < sellAmount);

  return (
    <button
      type="button"
      disabled={insufficient}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
        insufficient && "opacity-40 pointer-events-none"
      )}
    >
      <CurrencyIcon symbol={symbol} size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{symbol}</p>
        <p className="text-xs text-muted-foreground">
          Balance: {rawBalance !== null ? formatTokenAmount(rawBalance, decimals) : "—"}
        </p>
      </div>
      {hasBalance && isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
      ) : sellAmount !== null ? (
        <p className="text-xs text-muted-foreground shrink-0">
          ≈ {formatTokenAmount(sellAmount, decimals)} {symbol}
        </p>
      ) : insufficient ? (
        <p className="text-xs text-amber-500 shrink-0">Insufficient</p>
      ) : null}
    </button>
  );
}

interface PayWithPickerProps {
  orderCurrency: string;
  requiredRaw: bigint;
  walletAddress: string | null;
  selected: string | null;
  onSelect: (symbol: string) => void;
}

/**
 * Shown only when the buyer's balance in the order's own currency is
 * insufficient — lets them pay with any other SWAP_TOKENS currency instead,
 * auto-swapped into the order's currency as part of the same atomic
 * purchase transaction (executed via checkoutCart's swapCalls option).
 */
export function PayWithPicker({ orderCurrency, requiredRaw, walletAddress, selected, onSelect }: PayWithPickerProps) {
  const alternatives = SWAP_TOKENS.filter((t) => t.symbol !== orderCurrency);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Your {orderCurrency} balance is too low — pay with another token instead:
      </p>
      <div className="space-y-1.5">
        {alternatives.map((token) => (
          <PayWithOption
            key={token.symbol}
            symbol={token.symbol}
            decimals={token.decimals}
            orderCurrency={orderCurrency}
            requiredRaw={requiredRaw}
            walletAddress={walletAddress}
            selected={selected === token.symbol}
            onSelect={() => onSelect(token.symbol)}
          />
        ))}
      </div>
    </div>
  );
}
```

Note: `isStableCurrency` is imported but unused in this file (io's version doesn't use it in the picker either — it's only needed in the price-display components). Remove that import if `bun run lint` flags it as unused in Step 3.

- [ ] **Step 3: Typecheck and lint**

Run: `bun run typecheck`
Expected: no errors.

Run: `bun run lint`
Expected: no new warnings — if `isStableCurrency` shows as unused, remove that import line.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketplace/pay-with-picker.tsx
git commit -m "feat: add PayWithPicker — choose an alternate token for auto-swap

Adapted from medialane-io's picker: this app's useTokenBalance is
symbol-keyed (not address-keyed) and SWAP_TOKENS (utils/swap-tokens.ts)
already matches io's 5-token SUPPORTED_TOKENS shortlist exactly.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 17: Wire auto-swap into purchase-dialog.tsx

**Repo:** medialane-starknet

**Files:**
- Modify: `src/components/marketplace/purchase-dialog.tsx`

**Interfaces:**
- Consumes: `useTokenBalance` (existing), `buildSwapCalls` (Task 14), `PayWithPicker` (Task 16), `checkoutCart`'s `swapCalls` option (Task 15), `orderTotal` (existing, `@/lib/checkout`), `isStableCurrency` (from `@medialane/ui`).

- [ ] **Step 1: Add imports**

Add to the existing import block in `src/components/marketplace/purchase-dialog.tsx`:

```tsx
import { useTokenBalance } from "@/hooks/use-token-balance";
import { buildSwapCalls } from "@/lib/swap-calls";
import { PayWithPicker } from "@/components/marketplace/pay-with-picker";
```

- [ ] **Step 2: Add balance-check + picker state**

Inside `export function PurchaseDialog({ order, open, onOpenChange, onSuccess }: PurchaseDialogProps)`, after the existing:

```tsx
  const [step, setStep] = useState<Step>("details");
  const [quantity, setQuantity] = useState(1);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
```

add:

```tsx
  const [paymentSymbol, setPaymentSymbol] = useState<string | null>(null);
```

After the existing:

```tsx
  const isERC1155 = order.offer.itemType === "ERC1155";
  const maxQty = isERC1155
    ? Math.max(1, parseInt(order.remainingAmount ?? order.offer.startAmount ?? "1", 10))
    : 1;
```

add:

```tsx
  // The exact amount (raw wei, order's own currency) checkoutCart needs —
  // shared by the balance check below and the swap-build step in handleBuy.
  const requiredRaw = orderTotal(order, quantity);
  const { raw: orderCurrencyBalance, isLoading: balanceLoading } = useTokenBalance(
    order.price?.currency ?? "",
    address ?? undefined
  );
  // Explicitly false (not null/loading) before showing the pay-with picker —
  // never flash it while the balance is still resolving.
  const needsSwap = !balanceLoading && orderCurrencyBalance !== null && orderCurrencyBalance < requiredRaw;
  const canBuy = !needsSwap || !!paymentSymbol;
```

Reset `paymentSymbol` alongside the other dialog-open resets — edit:

```tsx
  useEffect(() => {
    if (open) {
      resetState();
      setStep("details");
      setQuantity(1);
      setSuccessTxHash(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
```

to:

```tsx
  useEffect(() => {
    if (open) {
      resetState();
      setStep("details");
      setQuantity(1);
      setSuccessTxHash(null);
      setPaymentSymbol(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Build swap calls in handleBuy before checkoutCart**

Edit the existing `handleBuy`:

```tsx
  const handleBuy = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (isOwnOrder) {
      toast.error("This is your own listing — you can't buy it.");
      return;
    }

    try {
      setStep("processing");
      const item: CheckoutItem = {
        orderHash: order.orderHash,
        considerationToken: order.consideration.token,
        // orderTotal() owns the price-per-edition × quantity maths.
        considerationAmount: orderTotal(order, quantity).toString(),
        offerIdentifier: order.offer.identifier,
        isERC1155,
        quantity: quantity.toString(),
      };
      const hash = await checkoutCart([item], { silent: true });
      if (hash) {
        setSuccessTxHash(hash);
        setStep("success");
        fireConfetti();
        onSuccess?.();
      } else {
        setStep("details");
      }
    } catch (e) {
      setStep("details");
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    }
  };
```

to:

```tsx
  const handleBuy = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (isOwnOrder) {
      toast.error("This is your own listing — you can't buy it.");
      return;
    }
    if (needsSwap && !paymentSymbol) return;

    try {
      setStep("processing");

      // Auto-swap: buyer is paying with a token other than the order's own
      // currency. Build a FRESH swap quote+calls right now (never reuse the
      // picker's browsing estimate) and prepend them into the same atomic
      // multicall as the fulfill call — one signature, one transaction.
      // Unlike medialane-io, this is NOT gas-sponsored — the connected
      // wallet pays gas as usual, exactly like every other purchase here.
      let swapCalls: Awaited<ReturnType<typeof buildSwapCalls>>["calls"] | undefined;
      if (paymentSymbol && order.price?.currency && address) {
        try {
          const built = await buildSwapCalls({
            sellSymbol: paymentSymbol,
            buySymbol: order.price.currency,
            buyAmountRaw: orderTotal(order, quantity).toString(),
            takerAddress: address,
          });
          swapCalls = built.calls;
        } catch {
          setStep("details");
          toast.error("Price moved before the swap could be prepared — please try again.");
          return;
        }
      }

      const item: CheckoutItem = {
        orderHash: order.orderHash,
        considerationToken: order.consideration.token,
        // orderTotal() owns the price-per-edition × quantity maths.
        considerationAmount: orderTotal(order, quantity).toString(),
        offerIdentifier: order.offer.identifier,
        isERC1155,
        quantity: quantity.toString(),
      };
      const hash = await checkoutCart([item], { silent: true, swapCalls });
      if (hash) {
        setSuccessTxHash(hash);
        setStep("success");
        fireConfetti();
        onSuccess?.();
      } else {
        setStep("details");
      }
    } catch (e) {
      setStep("details");
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    }
  };
```

- [ ] **Step 4: Render the picker and gate the Buy button**

In the "details" step JSX, find:

```tsx
              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {isOwnOrder ? (
```

Insert the picker right before the `error` Alert block:

```tsx
              {isConnected && needsSwap && order.price?.currency ? (
                <PayWithPicker
                  orderCurrency={order.price.currency}
                  requiredRaw={requiredRaw}
                  walletAddress={address}
                  selected={paymentSymbol}
                  onSelect={setPaymentSymbol}
                />
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {isOwnOrder ? (
```

Gate the Buy button — find:

```tsx
              ) : isConnected ? (
                <div className="space-y-3">
                  <div className="btn-border-animated p-[1px] rounded-xl">
                    <Button
                      className="w-full h-12 text-base font-semibold text-white rounded-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-background/30"
                      onClick={handleBuy}
                      disabled={isProcessing}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Buy now
                    </Button>
                  </div>
```

and change to:

```tsx
              ) : isConnected ? (
                <div className="space-y-3">
                  <div className={`btn-border-animated p-[1px] rounded-xl ${!canBuy ? "opacity-50 pointer-events-none" : ""}`}>
                    <Button
                      className="w-full h-12 text-base font-semibold text-white rounded-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-background/30"
                      onClick={handleBuy}
                      disabled={isProcessing || !canBuy}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {needsSwap && !paymentSymbol ? "Select a token to pay with" : "Buy now"}
                    </Button>
                  </div>
```

- [ ] **Step 5: Typecheck, lint, test**

```bash
bun run typecheck
bun run lint
bun test
```
Expected: typecheck clean, no new lint warnings, all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketplace/purchase-dialog.tsx
git commit -m "feat: wire auto-swap purchases into the purchase dialog

Balance check on the order's own currency (via existing
useTokenBalance) gates the PayWithPicker; a fresh swap quote is built
right before checkoutCart, prepended into the same signed multicall.
No gas sponsorship here (unlike io) — the connected wallet pays gas as
usual, same as every other purchase in this app.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 18: Ship Phase 2

**Files:** none (verification + PR)

- [ ] **Step 1: Full verification**

```bash
bun run typecheck
bun run lint
bun test
```
Expected: typecheck clean, no new lint warnings, all tests pass.

- [ ] **Step 2: Push, PR, merge**

```bash
git checkout -b feat/auto-swap-purchases
git push -u origin feat/auto-swap-purchases
gh pr create --title "Port frictionless auto-swap purchases from medialane-io" --body "Ports io's auto-swap-on-purchase flow, adapted to this app's checkoutCart/multi-wallet-kind architecture. When a buyer's balance in the order's own currency is insufficient, PayWithPicker lets them pay with any of SWAP_TOKENS instead — the swap is bundled into the same signed multicall as the purchase.

Key difference from io: no AVNU gas sponsorship here — every wallet kind (Ready/Braavos/injected/Cartridge/Privy) pays its own gas as usual. Cartridge users get a normal signature prompt for the swap calls (outside the static session policy), same as listing/offer today.

Depends on medialane-backend's /v1/swap/{quote,build}/meter routes, already live from io's PR #105.

## Test plan
- [x] bun run typecheck — clean
- [x] bun run lint — no new warnings
- [x] bun test — all pass
- [ ] Manual/prod check: real wallet, small amounts, each wallet kind if feasible — confirm whether Vercel previews can exercise real wallet connections here (unlike io, not confirmed prod-only for this app during planning)"
```

Wait for Vercel preview to pass, then `gh pr merge <number> --merge --delete-branch`.

---

## Self-Review

**Spec coverage:** Phase 1 (fiat display) — covered by Tasks 1–9 (TokenCard fix in both apps, useUsdPrices/usdValueFor port, wired into marketplace grid, all 5 asset-page variants, collection page, offer/counter-offer dialogs). Phase 2 (auto-swap) — covered by Tasks 10–18 (dependency, swap-billing, server routes, quote hook, build helper, checkoutCart extension, picker, purchase-dialog wiring). Wallet-kind notes (no sponsorship, Cartridge fallback) — addressed directly in Task 17's comments and the Task 18 PR description, no code gating needed per the confirmed decision.

**Placeholder scan:** No TBD/TODO markers. Caught and fixed during self-review: Task 17 Step 1 originally carried a stray planning-note import and an unused `isStableCurrency` import — both removed.

**Type consistency:** `usdValueFor(amountFormatted, currency, usdPrices): string | null` signature matches across every call site (Tasks 4–8). `checkoutCart`'s `WriteOpts.swapCalls?: Call[]` (Task 15) matches the type `buildSwapCalls` returns (`BuiltSwap.calls: Call[]`, Task 14) and what `PayWithPicker`'s consumer (Task 17) constructs. `useTokenBalance`'s actual return shape (`{ raw, formatted, isLoading, error, refresh }`, symbol-keyed) is used consistently in Tasks 16 and 17 — verified against the real source file during planning, not assumed from io's differently-shaped hook.

---

Plan complete and saved to `docs/superpowers/plans/2026-08-12-fiat-price-autoswap-port.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
