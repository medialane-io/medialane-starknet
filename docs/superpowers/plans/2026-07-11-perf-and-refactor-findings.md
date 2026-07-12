# Performance & Refactor Findings Implementation Plan

> **STATUS: COMPLETED & SHIPPED 2026-07-11.** All tasks executed and pushed
> (starknet `d759d9b`, ui 0.58.0 published to npm, io bumped in lock-step).
> Final numbers: homepage 671→480 kB, marketplace 676→484 kB, asset 817→523 kB,
> /mint & /br/mint ~1 MB→~437 kB; `/` and `/marketplace` are ISR-seeded.
> Deviations from the plan as written:
> - **Task 4 (lockfile) — skipped, no change needed.** `package-lock.json` is
>   *deliberately* gitignored; `bun.lock` is the canonical tracked lockfile
>   (bun installs, npm runs scripts). The finding was wrong.
> - **Extra hardening:** `apiFetch` in `src/lib/api-server.ts` gained a 5s
>   `AbortSignal.timeout` after a transient 60s prerender timeout on `/`
>   failed one build — ISR fetches must never hang page generation.
> - Task 14 measured far above its 50 kB gate (~190 kB off every page).
> Durable outcomes are documented in `CLAUDE.md` → "Performance architecture".

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all findings from the 2026-07-11 performance/UX investigation: cut first-load JS on the mint landings and asset page, route marketplace images through the existing resizing proxy, server-render the homepage hero and first marketplace page, edge-cache public reads, delete dead code, retire the wallet compat shims, and enforce the zero-type-error target.

**Architecture:** medialane-starknet is a Next.js 15 App Router dapp; all reads go through the BFF proxy to the Medialane backend; images resolve through the app's own `/api/ipfs/[...cid]?w=` resizing proxy. One small additive change lands in `@medialane/ui` (ListingCard `imageUrl` prop) with lock-step consumer bumps per the workspace SDK/UI versioning workflow.

**Tech Stack:** Next.js 15.5, React 19, SWR, starknet-react, StarkZap, `@medialane/ui`, `@medialane/sdk`.

## Spec — scope and non-goals

### In scope (the findings, in execution order)

| # | Finding | Fix |
|---|---|---|
| R3 | ~650 lines of dead code (5 orphan hooks, `lazy-image.tsx`, dead `utils/ipfs.ts` helpers, dead var in listing-card wrapper) | Delete |
| R4 | `useUnifiedWallet` shim has 11 live call sites | Migrate to `useWallet()`, delete both shims |
| R5 | `ignoreBuildErrors: true` while tsc is clean | Enforce type checking at build |
| R6 | Only `bun.lock` tracked in an npm-bootstrapped repo | Track `package-lock.json`, remove `bun.lock` |
| P9/R7 | Module-scope Privy server client breaks env-less builds | Lazy singleton |
| P1 | `/mint` + `/br/mint` ship full Privy SDK statically (~1 MB first load) | `next/dynamic` `PrivyInlineLogin` |
| P5 | recharts (344 kB) statically bundled into asset page for a below-the-fold tab | `next/dynamic` `PriceHistoryChart` |
| P2/R1/R2 | Marketplace grid images bypass the `/api/ipfs?w=` resizing proxy (ui `ipfsToHttp` → ipfs.io full-size) | `@medialane/ui` ListingCard `imageUrl` prop; dapp passes proxied resized URL |
| P3 | Homepage fully client-rendered — 4-hop LCP chain | Server-fetch hero collections in RSC, seed the slider |
| P3b | Marketplace first page renders skeletons only | Server-fetch first orders page, seed `ListingsGrid` |
| P6 | BFF proxy `no-store` on all public GETs | `s-maxage` + `stale-while-revalidate` on anonymous public GETs |
| P7 | Serial 4-gateway IPFS fallback (up to 15 s dead time) | Race the first two gateways |
| P8 | Poll stack-up (`useTokensByOwner` 12 s; comments poll while dialog closed) | 30 s owner poll; `active` param on `useComments` |
| P4 | StarkZap in the always-loaded chunk (~460 kB chunk 2145 on every page) | Dynamic-import StarkZap inside `connectCartridge`; measure |

### Non-goals

- **No `images.remotePatterns` scoping.** All `next/image` uses stay `unoptimized` (images go through our own `/api/ipfs` proxy, not the Next optimizer), so remotePatterns is unused; scoping it risks breaking external-collection images for zero benefit today.
- **No `as any` burn-down task.** 17 casts — fix opportunistically when touching those files, never as a sweep.
- **No broader ipfsToHttp consolidation beyond ListingCard.** The ui package keeps its resolver; the dapp overrides per-card via the new prop. Wider consolidation only if a second card surface shows the same bypass.
- **No new dependencies** (no bundle analyzer, no test framework). Verification = `npx tsc --noEmit`, `npm run build` route table, manual checks with `npm run dev`.

### Baseline (production build, 2026-07-11) — for before/after comparison

```
/            671 kB   /marketplace  676 kB   /asset/[..]/[..]  817 kB
/mint       ~1 MB     /br/mint     ~1 MB     /activities        397 kB
Shared baseline 104 kB
```

## Global Constraints

- Repo commands: `npm run build`, `npx tsc --noEmit` (zero-error target). This repo uses **npm**, not bun.
- `medialane-ui` builds/publishes with `bun run build` → `npm publish`; consumers (`medialane-io`, `medialane-starknet`) pin exact versions and bump in lock-step, validated with build + `tsc --noEmit` each.
- Use the Edit tool for all file changes — never `sed -i`.
- Never introduce `NEXT_PUBLIC_` vars carrying keys; never guard client hooks on `MEDIALANE_API_KEY`.
- Token images resolve via `resolveTokenImage`/`ipfsToHttp` from `src/lib/utils.ts` (the `/api/ipfs` proxy), never raw gateway URLs.
- No hover-only effects; wallet signer/executor resolution must stay slot-gated (`walletType === "cartridge" || walletType === "privy"`).
- Run the full build and read all output before any push (no grep-filtering).
- Each task ends with `npx tsc --noEmit` clean + a commit. Full `npm run build` required for Tasks 3, 5, 6, 7, 10, 11, 14 (bundle/build-behavior changes); skip it for pure deletions/doc edits if tsc is clean.
- CLAUDE.md must be updated in the same commit as any change that invalidates it.

---

### Task 1: Dead code sweep

**Files:**
- Delete: `src/hooks/use-ipfs.ts`, `src/hooks/use-collection-assets.ts`, `src/hooks/use-tx-tracker.ts`, `src/hooks/use-user-activities.ts`, `src/hooks/use-wallet-session.ts`, `src/components/ui/lazy-image.tsx`
- Modify: `src/utils/ipfs.ts` (remove `getKnownCids`, `loadIPFSMetadataInBackground`, `combineData`; remove `AssetType`/`EnhancedAsset` if they become unreferenced), `src/components/marketplace/listing-card.tsx:34-36` (dead `image` var + unused imports), `CLAUDE.md`

**Interfaces:**
- Produces: nothing — pure deletion. Later tasks assume `use-tx-tracker.ts` and `use-wallet-session.ts` no longer exist.

- [ ] **Step 1: Re-verify zero importers immediately before deleting** (memory rule: verify before labeling)

```bash
cd /Users/kalamaha/dev/medialane-starknet/src
for n in use-ipfs use-collection-assets use-tx-tracker use-user-activities use-wallet-session lazy-image getKnownCids loadIPFSMetadataInBackground combineData useWalletSession useTxTracker; do
  echo "== $n =="; grep -rn "$n" --include="*.ts*" . | grep -v "hooks/$n.ts\|components/ui/$n.tsx\|utils/ipfs.ts"
done
```

Expected: no output for any name (self-references only). If any name has a hit, KEEP that file and report it — do not delete.

- [ ] **Step 2: Delete the six orphan files**

```bash
git rm src/hooks/use-ipfs.ts src/hooks/use-collection-assets.ts src/hooks/use-tx-tracker.ts src/hooks/use-user-activities.ts src/hooks/use-wallet-session.ts src/components/ui/lazy-image.tsx
```

- [ ] **Step 3: Remove dead helpers from `src/utils/ipfs.ts`**

Remove the functions `getKnownCids`, `loadIPFSMetadataInBackground`, and `combineData` (lines ~146-238 in current file). Then check whether `AssetType` and `EnhancedAsset` are referenced anywhere else:

```bash
grep -rn "AssetType\|EnhancedAsset" --include="*.ts*" src | grep -v "utils/ipfs.ts"
```

If unreferenced, remove those interfaces too. Keep `IPFSMetadata`, `fetchIPFSMetadata`, `clearIPFSCache`, `processIPFSHashToUrl`, `nextIpfsGatewayUrl`, `IPFS_GATEWAYS`, and the local-storage helpers untouched.

- [ ] **Step 4: Remove the dead `image` variable in `src/components/marketplace/listing-card.tsx`**

Delete line 35 (`const image = order.token?.image ? ipfsToHttp(order.token.image) : null;`) and remove `ipfsToHttp` and `formatDisplayPrice` from the `@medialane/ui` import on lines 5-10 **only if** they are unused elsewhere in the file (verify with a read — as of 2026-07-11 they are unused). Note: Task 9 will reintroduce a resolved image here via a different helper; that's intentional — this step just clears the dead code so Task 9 starts clean.

- [ ] **Step 5: Update `CLAUDE.md`**

In the "StarkZap Feature Hooks" section, remove the `useTxTracker(txHash)` bullet. In the wallet architecture section, change the compat-shim sentence to mention only `useUnifiedWallet()` (Task 2 removes that mention entirely; if executing both tasks together, do the full removal there). In "Directory Structure", remove the `src/hooks/use-tx-tracker.ts` bullet.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: delete dead code (orphan hooks, lazy-image, unused ipfs helpers)"
```

---

### Task 2: Migrate `useUnifiedWallet` call sites to `useWallet`, delete the shim

**Files:**
- Modify (11 call sites): `src/app/launchpad/pop/[contract]/manage/page.tsx`, `src/app/launchpad/nfteditions/[contract]/mint/page.tsx`, `src/app/launchpad/drop/[contract]/manage/page.tsx`, `src/components/shared/user-registration.tsx`, `src/components/claim/pop-claim-button.tsx`, `src/components/claim/collection-drop-mint-button.tsx`, `src/hooks/use-gated-content.ts`, `src/hooks/use-swap.ts`, `src/hooks/use-transfer.ts`, `src/hooks/use-remix-offers.ts`, `src/hooks/use-username-claims.ts`
- Delete: `src/hooks/use-unified-wallet.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `useWallet()` from `src/hooks/use-wallet.ts` → `{ address: string | null, isConnected, isConnecting, walletType, error, connect, disconnect, execute }`.
- Shape difference vs the shim: the shim returned `address: string | undefined` (via `address ?? undefined`) and cast `walletType` to `UnifiedWalletType`. Everything else is identical pass-through.

- [ ] **Step 1: Migrate each call site**

In each of the 11 files, replace:

```ts
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
// ...
const { address, isConnected, execute /* whatever subset */ } = useUnifiedWallet();
```

with:

```ts
import { useWallet } from "@/hooks/use-wallet";
// ...
const { address, isConnected, execute } = useWallet();
```

Where a call site passes `address` to something typed `string | undefined` (tsc will flag it, since `useWallet` returns `string | null`), apply `address ?? undefined` **at that usage**, not by re-aliasing the whole object. If a call site imports the `UnifiedWalletType` type, replace it with `WalletType` from `src/lib/wallet-types.ts` (verify the union covers the usage; `UnifiedWalletType` additionally includes `"injected"` — if a file compares against `"injected"`, check `src/lib/wallet-types.ts` for the equivalent value before changing, and report if there is a semantic mismatch instead of guessing).

- [ ] **Step 2: Typecheck after all 11 files**

Run: `npx tsc --noEmit`
Expected: clean. Fix any `string | null` vs `string | undefined` flags with `?? undefined` at the specific usage.

- [ ] **Step 3: Delete the shim and verify no stragglers**

```bash
git rm src/hooks/use-unified-wallet.ts
grep -rn "useUnifiedWallet\|use-unified-wallet\|UnifiedWalletType" --include="*.ts*" src
```

Expected: no output.

- [ ] **Step 4: Update `CLAUDE.md`**

Remove both compat-shim references: the sentence "`useUnifiedWallet()` and `useWalletSession()` are kept as **thin compatibility shims** …" in the wallet architecture section, the key-files bullet `src/hooks/use-unified-wallet.ts, src/hooks/use-wallet-session.ts — compat shims over useWallet()`, the Directory Structure bullet for `use-unified-wallet.ts`, and the Conventions bullet's shim sentence (keep the `useWallet()` single-hook sentence).

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` → clean.

```bash
git add -A && git commit -m "refactor: migrate remaining useUnifiedWallet call sites to useWallet, delete shims"
```

---

### Task 3: Enforce type checking at build time

**Files:**
- Modify: `next.config.ts:51-53`, `CLAUDE.md:14`

- [ ] **Step 1: Remove the ignore flag**

In `next.config.ts`, delete:

```ts
  typescript: {
    ignoreBuildErrors: true,
  },
```

- [ ] **Step 2: Update `CLAUDE.md`**

Replace the line "No test suite is configured. TypeScript build errors are intentionally ignored (`typescript.ignoreBuildErrors: true` in `next.config.ts`), but `npx tsc --noEmit` should stay clean." with: "No test suite is configured. TypeScript errors fail the build (`ignoreBuildErrors` was removed 2026-07-11); `npx tsc --noEmit` must stay clean."

- [ ] **Step 3: Full build to prove it passes with checking on**

Run: `npm run build`
Expected: `✓ Compiled successfully`, type checking runs (no "Skipping validation of types" line), build completes. If type errors surface that `tsc --noEmit` didn't catch, fix them here (they are real errors, not config problems).

- [ ] **Step 4: Commit**

```bash
git add next.config.ts CLAUDE.md && git commit -m "chore: enforce TypeScript checking at build time"
```

---

### Task 4: Canonical lockfile — track `package-lock.json`, drop `bun.lock`

**Files:**
- Delete (from git): `bun.lock`
- Add: `package-lock.json`

- [ ] **Step 1: Verify preconditions**

```bash
git check-ignore package-lock.json; echo "ignore-status: $?"
git ls-files | grep -E "bun.lock|package-lock"
```

Expected: `ignore-status: 1` (not ignored) and only `bun.lock` listed. If `package-lock.json` IS gitignored, remove that `.gitignore` line in this step.

- [ ] **Step 2: Regenerate a clean lockfile and verify install parity**

```bash
npm install
npx tsc --noEmit
```

Expected: `npm install` completes without changing `package.json`; tsc clean (memory rule: verify node_modules sync — if tsc suddenly errors here, the previous install was stale; resolve before proceeding).

- [ ] **Step 3: Swap tracked lockfiles + commit**

```bash
git rm bun.lock
git add package-lock.json
git commit -m "chore: track package-lock.json as the canonical lockfile (repo is npm-bootstrapped)"
```

---

### Task 5: Lazy-init the Privy server client

**Files:**
- Modify: `src/lib/privy-server.ts`, `src/app/api/wallet/sign/route.ts`, `src/app/api/wallet/starknet/route.ts`

**Interfaces:**
- Produces: `getPrivyServer(): PrivyClient` — lazy singleton, replaces the exported `privyServer` const.

- [ ] **Step 1: Rewrite `src/lib/privy-server.ts`**

```ts
import { PrivyClient } from "@privy-io/node";

let _client: PrivyClient | null = null;

/**
 * Lazy singleton — instantiating at module scope makes `next build` fail in
 * any environment without Privy env vars (page-data collection imports the
 * route module). Resolve env at first call instead.
 */
export function getPrivyServer(): PrivyClient {
  if (_client) return _client;
  _client = new PrivyClient({
    appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    appSecret: process.env.PRIVY_APP_SECRET!,
  });
  return _client;
}
```

- [ ] **Step 2: Update both API routes**

In `src/app/api/wallet/sign/route.ts` and `src/app/api/wallet/starknet/route.ts`, replace `import { privyServer } from "@/lib/privy-server"` with `import { getPrivyServer } from "@/lib/privy-server"`, and every `privyServer.` usage with a local `const privy = getPrivyServer();` at the top of the request handler (in `sign/route.ts`, `getStarknetWalletForUser` also uses it — pass the client in or call `getPrivyServer()` inside it). Read `starknet/route.ts` first to catch all usages.

- [ ] **Step 3: Prove env-less builds work**

```bash
npx tsc --noEmit
env -u PRIVY_APP_ID -u PRIVY_APP_SECRET -u NEXT_PUBLIC_PRIVY_APP_ID npm run build
```

Expected: build succeeds with **no** dummy Privy vars (this failed before the change).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "fix: lazy-init Privy server client so builds don't require Privy env"
```

---

### Task 6: Lazy-load `PrivyInlineLogin` on the mint landings

**Files:**
- Modify: `src/components/airdrop/airdrop-claim.tsx`, `src/app/br/mint/br-mint-content.tsx`

- [ ] **Step 1: Convert the import in `airdrop-claim.tsx`**

Replace lines 6 and the component usage:

```ts
import dynamic from "next/dynamic";
import type { PrivyInlineLocale } from "@/components/airdrop/privy-inline-login";

const PrivyInlineLogin = dynamic(
  () => import("@/components/airdrop/privy-inline-login").then((m) => m.PrivyInlineLogin),
  {
    ssr: false,
    loading: () => (
      <div className="h-32 w-full max-w-md animate-pulse rounded-xl bg-muted" aria-hidden />
    ),
  },
);
```

The JSX usage (`<PrivyInlineLogin onOpenWalletPicker={openWalletPicker} locale={locale} />`) is unchanged. The `type` import is erased at compile time — it does not pull the bundle.

- [ ] **Step 2: Apply the identical pattern in `br-mint-content.tsx`**

Read the file, find its `PrivyInlineLogin` static import, replace with the same `dynamic()` block (keep whatever props it passes; match the placeholder height to the form it replaces so the layout doesn't jump — check the rendered size in the file and adjust `h-32` accordingly). **Do not touch** the `gtag` conversion snippet or the hidden `<ConnectWallet />` ref.

- [ ] **Step 3: Verify no remaining static value-imports of the Privy component tree**

```bash
grep -rn 'from "@/components/airdrop/privy-inline-login"' src --include="*.tsx" | grep -v "import type"
```

Expected: no output (only `import type` lines remain).

- [ ] **Step 4: Build + measure**

Run: `npm run build` and read the route table.
Expected: `/mint` and `/br/mint` First Load JS drop from ~1 MB to roughly the neighborhood of the other pages (~650 kB). Record the numbers in the commit message.

- [ ] **Step 5: Manual check**

`npm run dev`, open `/br/mint` while logged out: hero + form skeleton paint immediately, the email login renders after the Privy chunk streams in, and "outras formas de entrar" still opens the wallet picker.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "perf: lazy-load PrivyInlineLogin — cuts ~350 kB gz off /mint and /br/mint first load"
```

---

### Task 7: Lazy-load the recharts price chart

**Files:**
- Modify: `src/app/asset/[contract]/[tokenId]/asset-provenance-tab.tsx:4`

- [ ] **Step 1: Convert the import**

Replace `import { PriceHistoryChart } from "@/components/asset/price-history-chart";` with:

```ts
import dynamic from "next/dynamic";

const PriceHistoryChart = dynamic(
  () => import("@/components/asset/price-history-chart").then((m) => m.PriceHistoryChart),
  {
    ssr: false,
    loading: () => <div className="h-48 w-full animate-pulse rounded-xl bg-muted" aria-hidden />,
  },
);
```

Match the placeholder height to the chart's actual rendered height (read `price-history-chart.tsx` for its container height and adjust `h-48`).

- [ ] **Step 2: Build + measure**

Run: `npm run build`.
Expected: `/asset/[contract]/[tokenId]` First Load JS drops from 817 kB by roughly the recharts chunk (expect ≥100 kB improvement). Record numbers.

- [ ] **Step 3: Manual check**

`npm run dev`, open any asset page, switch to the provenance tab: chart placeholder → chart renders.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "perf: lazy-load recharts price history chart out of asset page first load"
```

---

### Task 8: `@medialane/ui` — ListingCard accepts a pre-resolved image URL

**Files (in `/Users/kalamaha/dev/medialane-ui`):**
- Modify: `src/components/listing-card.tsx`, `package.json` (version bump)

**Interfaces:**
- Produces: `ListingCardProps.imageUrl?: string | null` — when the prop is **passed** (including `null`), it is used verbatim and the card's internal `ipfsToHttp(order.token.image)` resolution is skipped; `null` renders the existing no-image fallback. When **omitted** (`undefined`), behavior is byte-for-byte what it is today. Task 9 consumes this.

- [ ] **Step 1: Add the prop**

In `medialane-ui/src/components/listing-card.tsx`, extend the props interface:

```ts
/**
 * Pre-resolved, browser-loadable image URL. When provided (including null),
 * overrides the card's internal ipfsToHttp resolution — apps that proxy or
 * resize images (e.g. medialane-starknet's /api/ipfs?w=) pass it here.
 * Omit for the default gateway resolution.
 */
imageUrl?: string | null;
```

and change line 36 from:

```ts
const image = order.token?.image ? ipfsToHttp(order.token.image) : null;
```

to:

```ts
const image = imageUrl !== undefined ? imageUrl : (order.token?.image ? ipfsToHttp(order.token.image) : null);
```

(destructure `imageUrl` in the component signature alongside the existing props).

- [ ] **Step 2: Build the package**

```bash
cd /Users/kalamaha/dev/medialane-ui && bun run build
```

Expected: clean build.

- [ ] **Step 3: Bump version + publish**

Read the current `version` in `medialane-ui/package.json`, bump the **minor** (e.g. `0.57.x` → `0.58.0` — additive prop). Update the `medialane-ui/CLAUDE.md` version-history line per that repo's convention (read its CLAUDE.md "publish workflow" section and follow it exactly).

```bash
npm publish
```

No Claude Design re-sync needed — this adds a prop, not a component or brand token.

- [ ] **Step 4: Commit (medialane-ui repo)**

```bash
git add -A && git commit -m "feat: ListingCard imageUrl override prop for app-side image proxying/resizing"
```

---

### Task 9: Dapp passes proxied, resized card images + lock-step consumer bumps

**Files:**
- Modify: `medialane-starknet/package.json` (+ lockfile), `src/components/marketplace/listing-card.tsx`, `CLAUDE.md` (UI version note is workspace-level — update the workspace `/Users/kalamaha/dev/CLAUDE.md` "Current UI" line)
- Modify (lock-step): `medialane-io/package.json` (+ its lockfile) — version bump only, validated

**Interfaces:**
- Consumes: `ListingCardProps.imageUrl` from Task 8; `ipfsToHttp(uri, width)` from `src/lib/utils.ts` (returns `/api/ipfs/{cid}?w={width}` for `ipfs://` URIs).

- [ ] **Step 1: Bump `@medialane/ui` in medialane-starknet**

```bash
cd /Users/kalamaha/dev/medialane-starknet && npm install @medialane/ui@latest
```

- [ ] **Step 2: Pass the resolved image in the wrapper**

In `src/components/marketplace/listing-card.tsx` (post-Task-1 state):

```ts
import { ipfsToHttp } from "@/lib/utils";
// inside the component:
const imageUrl = order.token?.image ? ipfsToHttp(order.token.image, 640) : null;
```

and add `imageUrl={imageUrl}` to the `<PackageListingCard …>` props. Width 640 covers the largest grid-cell rendering (2-col mobile at high DPR); the proxy caps at `MAX_WIDTH = 2000` server-side. Note `ipfsToHttp` from `@/lib/utils` returns `/placeholder.svg` for empty input — the `order.token?.image ? … : null` guard keeps `null` semantics so the ui card's own fallback renders.

- [ ] **Step 3: Verify + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: clean. Manual check with `npm run dev`: marketplace grid images load from `/api/ipfs/...?w=640` (confirm in the browser network tab), no broken cards. Note: if `PINATA_DEDICATED_GATEWAY` is unset locally, the proxy serves the unresized original by design — the URL shape is still the thing to verify.

- [ ] **Step 4: Lock-step bump medialane-io**

```bash
cd /Users/kalamaha/dev/medialane-io && bun install @medialane/ui@latest && bun run build && npx tsc --noEmit
```

Expected: clean build, no code changes needed (prop is additive). Read that repo's CLAUDE.md first per workspace rules; commit there with `chore: bump @medialane/ui (ListingCard imageUrl prop)`.

- [ ] **Step 5: Update workspace CLAUDE.md + commit**

Update the "Current UI" line in `/Users/kalamaha/dev/CLAUDE.md` to the new version with a one-line note (`ListingCard imageUrl override`). Commit medialane-starknet:

```bash
git add -A && git commit -m "perf: marketplace grid images via /api/ipfs?w=640 resizing proxy"
```

---

### Task 10: Server-render the homepage hero

**Files:**
- Modify: `src/lib/api-server.ts`, `src/app/page.tsx`, `src/components/home/index.tsx`, `src/components/home/hero-slider.tsx`, `src/hooks/use-collections.ts`

**Interfaces:**
- Produces: `fetchFeaturedCollections(limit: number): Promise<ApiCollection[] | null>` in `api-server.ts`; `HomePage({ initialFeatured }: { initialFeatured?: ApiCollection[] })`; `HeroSlider({ initial }: { initial?: ApiCollection[] })`; `useCollections(...)` gains a final optional `fallback?: ApiCollection[]` param.

- [ ] **Step 1: Add the server fetch helper**

In `src/lib/api-server.ts`:

```ts
import type { ApiCollection } from "@medialane/sdk";

export async function fetchFeaturedCollections(limit: number) {
  return apiFetch<ApiCollection[]>(
    `/v1/collections?page=1&limit=${limit}&sort=recent&isFeatured=true&hideEmpty=true`
  );
}
```

(`apiFetch` already sets `next: { revalidate: 60 }` and returns `json.data` — matching `useCollections`'s unwrapped `data.data`.)

- [ ] **Step 2: Thread the data through `page.tsx`**

```ts
import { fetchFeaturedCollections } from "@/lib/api-server";

export const revalidate = 60;

export default async function Page() {
  const featured = await fetchFeaturedCollections(3);
  return <HomePage initialFeatured={featured ?? undefined} />;
}
```

(metadata export unchanged.)

- [ ] **Step 3: Add the SWR fallback to `useCollections`**

Append a final optional param and wire it as `fallbackData` (the SWR key already encodes all query params, so the fallback binds to exactly this query):

```ts
export function useCollections(
  page = 1,
  limit = 20,
  isFeatured?: boolean,
  sort: CollectionSort = "recent",
  hideEmpty = true,
  service?: string,
  standard?: string,
  fallback?: ApiCollection[]
) {
  // …existing key + fetcher unchanged…
    {
      revalidateOnFocus: false,
      ...(fallback ? { fallbackData: { data: fallback } as ApiResponse<ApiCollection[]> } : {}),
    }
```

With `fallbackData` present, `isLoading` is false on first render and SWR revalidates in the background — existing callers (no fallback) are unaffected.

- [ ] **Step 4: Thread through `HomePage` and `HeroSlider`**

`src/components/home/index.tsx`: accept and forward the prop —

```ts
import type { ApiCollection } from "@medialane/sdk";

export function HomePage({ initialFeatured }: { initialFeatured?: ApiCollection[] }) {
  // …
  <HeroSlider initial={initialFeatured} />
```

`src/components/home/hero-slider.tsx`: accept `initial` and pass it as the fallback —

```ts
export function HeroSlider({ initial }: { initial?: ApiCollection[] }) {
  const { collections, isLoading } = useCollections(1, 3, true, "recent", true, undefined, undefined, initial);
```

The hero image (`priority`, first slide) now renders in the server HTML instead of after hydration + fetch.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run build
```

Expected: `/` becomes ISR (`revalidate: 60` shown in the route table). Then `npm run dev`, hard-reload `/` with JS disabled in devtools once: the hero collection name and image tag must be present in the initial HTML (view-source). Re-enable JS; slider still rotates.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "perf: server-render homepage hero via ISR — hero image in initial HTML"
```

---

### Task 11: Server-render the first marketplace page

**Files:**
- Modify: `src/lib/api-server.ts`, `src/app/marketplace/page.tsx`, `src/app/marketplace/marketplace-page-client.tsx`, `src/components/marketplace/listings-grid.tsx`

**Interfaces:**
- Produces: `fetchActiveOrders(limit: number): Promise<ApiOrder[] | null>` in `api-server.ts`; `MarketplacePageClient({ initialOrders }: { initialOrders?: ApiOrder[] })`; `ListingsGridProps.initialOrders?: ApiOrder[]`.

- [ ] **Step 1: Add the server fetch helper**

In `src/lib/api-server.ts`:

```ts
import type { ApiOrder } from "@medialane/sdk";

export async function fetchActiveOrders(limit: number) {
  return apiFetch<ApiOrder[]>(`/v1/orders?status=ACTIVE&sort=recent&page=1&limit=${limit}`);
}
```

Before relying on this, verify the query-param names against the SDK's `getOrders` implementation (`node_modules/@medialane/sdk` — read how `ApiOrdersQuery` serializes; use exactly those param names, per the RPC-facts memory rule: never invent endpoint params).

- [ ] **Step 2: Thread through the page**

`src/app/marketplace/page.tsx`:

```ts
import { fetchActiveOrders } from "@/lib/api-server";

export const revalidate = 30;

export default async function MarketplacePage() {
  const initialOrders = await fetchActiveOrders(50);
  return <MarketplacePageClient initialOrders={initialOrders ?? undefined} />;
}
```

- [ ] **Step 3: Seed `ListingsGrid`**

`marketplace-page-client.tsx`: accept `initialOrders` and pass `<ListingsGrid … initialOrders={initialOrders} />` (only meaningful for the default filter state; that's fine — filters trigger the existing reset effect).

`listings-grid.tsx`: seed the accumulator and skip the skeleton when seeded:

```ts
export function ListingsGrid({ sort = "recent", currency, orderType = "", minPrice, maxPrice, initialOrders }: ListingsGridProps = {}) {
  const [allOrders, setAllOrders] = useState<ApiOrder[]>(initialOrders ?? []);
```

(add `initialOrders?: ApiOrder[]` to `ListingsGridProps`). The existing `backendPage === 1` append-effect replaces the seed with fresh SWR data as soon as it lands, and the filter-change reset effect clears it — no other changes. `isInitialLoading` (`isLoading && allOrders.length === 0`) is automatically false when seeded, so real cards render in the server HTML instead of skeletons.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit && npm run build
```

Expected: `/marketplace` shows `revalidate: 30` in the route table. `npm run dev`: view-source on `/marketplace` contains real listing names; filters still reset and re-fetch correctly; infinite scroll still loads more.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "perf: seed marketplace grid with server-fetched first page (ISR 30s)"
```

---

### Task 12: Edge-cache anonymous public GETs in the BFF proxy

**Files:**
- Modify: `src/app/api/proxy/v1/[...path]/route.ts`

- [ ] **Step 1: Add the cacheable-path rule**

After the `ALLOWED_ROUTES` block, add:

```ts
// ─── Edge caching for anonymous public reads ─────────────────────────────
//
// Public catalog reads (collections/tokens/orders/coins/activities and the
// rewards config/leaderboard) are identical for every anonymous visitor —
// let Vercel's edge cache absorb repeat traffic instead of hitting the
// metered backend per user. Strictly anonymous GET only: any request
// carrying an Authorization header (SIWS identity) is never cached, and
// user-scoped paths are simply not listed here.
const CACHEABLE_GET_PATHS = [
  /^collections(\/|$)/,
  /^tokens(\/|$)/,
  /^orders(\/|$)/,
  /^coins(\/|$)/,
  /^activities(\/|$)/,
  /^rewards\/(config|leaderboard)$/,
  /^search(\/|$)/,
];
const EDGE_CACHE_CONTROL = "public, s-maxage=30, stale-while-revalidate=120";
```

- [ ] **Step 2: Apply it in `handle()`**

Immediately before the final `return new NextResponse(...)`:

```ts
  if (
    req.method === "GET" &&
    res.ok &&
    !req.headers.get("authorization") &&
    CACHEABLE_GET_PATHS.some((re) => re.test(joinedPath))
  ) {
    outHeaders.set("cache-control", EDGE_CACHE_CONTROL);
  }
```

The upstream `fetch(..., { cache: "no-store" })` stays — the proxy itself must always fetch fresh from the backend; the header only lets Vercel's edge serve repeat *clients*.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm run dev &
sleep 5
curl -sD - -o /dev/null http://localhost:3000/api/proxy/v1/collections?page=1&limit=3 | grep -i cache-control
curl -sD - -o /dev/null -H "Authorization: Bearer x" http://localhost:3000/api/proxy/v1/collections?page=1&limit=3 | grep -i cache-control
kill %1
```

Expected: first curl shows `cache-control: public, s-maxage=30, stale-while-revalidate=120`; the Authorization one does NOT (either absent or the backend's own value).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "perf: edge-cache anonymous public GETs through the BFF proxy (s-maxage=30)"
```

---

### Task 13: IPFS gateway race + polling tune

**Files:**
- Modify: `src/utils/ipfs.ts` (`fetchIPFSMetadata`), `src/hooks/use-tokens.ts:28`, `src/hooks/use-comments.ts`

- [ ] **Step 1: Race the first two gateways in `fetchIPFSMetadata`**

Replace the sequential `for (const gateway of IPFS_GATEWAYS)` loop body with a helper + race-then-serial strategy (cache and SSR-guard logic above it unchanged):

```ts
  const tryGateway = async (gateway: string): Promise<IPFSMetadata> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${gateway}${cid}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as IPFSMetadata;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Race the two primary gateways (Pinata + ipfs.io) so one slow/down
  // gateway no longer costs a serial 5s timeout; fall back to the rest
  // serially only if both lose.
  let metadata: IPFSMetadata | null = null;
  try {
    metadata = await Promise.any(IPFS_GATEWAYS.slice(0, 2).map(tryGateway));
  } catch {
    for (const gateway of IPFS_GATEWAYS.slice(2)) {
      try {
        metadata = await tryGateway(gateway);
        break;
      } catch { /* next */ }
    }
  }

  if (metadata) {
    localSet(`${CACHE_PREFIX}${cid}`, JSON.stringify({ data: metadata, timestamp: Date.now() }));
    return metadata;
  }
```

(keep the existing dev-only "all gateways failed" warn + `return null`).

- [ ] **Step 2: Slow the owner-tokens poll**

In `src/hooks/use-tokens.ts:28`, change `refreshInterval: 12000` → `refreshInterval: 30_000` (matches the order-poll cadence; post-buy/mint updates flow through explicit `mutate()` calls, not the poll).

- [ ] **Step 3: Gate comment polling on visibility**

In `src/hooks/use-comments.ts`, add an `active` param (default `true` — no caller breaks):

```ts
export function useComments(
  contract: string,
  tokenId: string,
  page = 1,
  limit = 20,
  active = true
): UseCommentsResult {
  // …
    {
      refreshInterval: active ? 15000 : 0,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
```

Then find the callers (`grep -rn "useComments(" src --include="*.tsx"`) and pass the dialog/panel open state as `active` from any caller that renders a closed-by-default surface (e.g. the asset comments dialog: `useComments(contract, tokenId, page, limit, dialogOpen)`). Callers that show comments inline and always-visible keep the default.

- [ ] **Step 4: Verify + commit**

`npx tsc --noEmit` clean; `npm run dev` → open an asset page, open/close the comments dialog and confirm (network tab) the comments request stops repeating while closed.

```bash
git add -A && git commit -m "perf: race primary IPFS gateways, tune owner-token and comment polling"
```

---

### Task 14: Move StarkZap out of the always-loaded bundle (measured, gated)

**Files:**
- Modify: `src/contexts/starkzap-wallet-context.tsx:12,15,151-169`

**Interfaces:**
- Consumes: existing `getCartridgeStarkZapSdk()` from `src/lib/starkzap.ts` (unchanged signature — only the import site becomes dynamic).
- Behavior contract: `connectCartridge()` covers BOTH explicit connect and the silent resume on reload (wallet-context.tsx:163 calls it for restore) — the lazy import must work identically for both.

This is the riskiest task (wallet layer; Cartridge connect silently broke for ~4 weeks once before). It is deliberately last, isolated to one file, and gated on a measurement: if the bundle win is < 50 kB, revert and report rather than pushing further lazy-loading into the wallet layer.

- [ ] **Step 1: Record the baseline**

Run `npm run build`; save the full route table (e.g. into the commit message draft). Key rows: `/`, `/marketplace`, `/activities`, shared First Load.

- [ ] **Step 2: Make the StarkZap imports dynamic**

In `src/contexts/starkzap-wallet-context.tsx`:

Remove line 12 (`import { OnboardStrategy } from "starkzap";`) and line 15 (`import { getCartridgeStarkZapSdk } from "@/lib/starkzap";`). Keep line 13 (`import type { WalletInterface } from "starkzap";`) — type-only, erased.

Rewrite `connectCartridge`:

```ts
  const connectCartridge = useCallback(async () => {
    setSession(walletConnecting("cartridge"));
    try {
      // StarkZap (and its zod-heavy dependency graph) loads only when a
      // Cartridge connect/resume actually happens — keeping it out of the
      // first-load bundle of every page for every visitor.
      const [{ OnboardStrategy }, { getCartridgeStarkZapSdk }] = await Promise.all([
        import("starkzap"),
        import("@/lib/starkzap"),
      ]);
      const sdk = getCartridgeStarkZapSdk();
      const result = await sdk.onboard({
        strategy: OnboardStrategy.Cartridge,
        cartridge: { policies: CARTRIDGE_POLICIES },
        deploy: "if_needed",
      });
      setWallet(result.wallet);
      setSession(walletReady("cartridge", result.wallet.address as unknown as string));
      writePersistedWallet("cartridge");
    } catch (err) {
      console.error("[Cartridge] connect failed:", err);
      setWallet(null);
      setSession(walletError("cartridge", getFriendlyWalletError(err).message));
    }
  }, []);
```

Everything else in the file (CARTRIDGE_POLICIES, Privy paths, session plumbing) is untouched. `privy-connector.tsx` also imports StarkZap statically but is already lazy-loaded by `providers.tsx` — do not modify it. `use-swap.ts` / `use-token-balance.ts` keep their static imports — they live in route-level chunks (coin pages, /swap), not the shared graph.

- [ ] **Step 3: Verify no remaining static StarkZap value-import in the always-loaded graph**

```bash
grep -rn 'from "starkzap"\|from "@/lib/starkzap"' src/contexts/starkzap-wallet-context.tsx src/contexts/wallet-context.tsx src/lib/wallet-adapters.ts src/hooks/use-wallet.ts src/app/providers.tsx | grep -v "import type"
```

Expected: no output.

- [ ] **Step 4: Build + measure against Step 1**

Run `npm run build`. Compare browse-page First Load JS (e.g. `/marketplace` 676 kB baseline).
- **≥ 50 kB improvement:** proceed.
- **< 50 kB:** the chunk is held in the graph by something else — `git checkout -- src/contexts/starkzap-wallet-context.tsx`, and report the measured numbers + the largest remaining chunks (`ls -S .next/static/chunks/*.js | head -5`) instead of improvising further wallet-layer changes.

- [ ] **Step 5: Manual wallet regression check (mandatory before commit)**

With `npm run dev`:
1. Connect Cartridge from the picker — completes without error.
2. Reload the page — Cartridge session silently resumes (the restore path also goes through `connectCartridge`).
3. Connect an injected wallet (Ready/Braavos) — unaffected.
4. If any step fails, revert and report; do not ship a partial wallet change.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "perf: dynamic-import StarkZap inside connectCartridge — out of shared first load (<before>kB → <after>kB on /marketplace)"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — read ALL output; record the final route table and diff against the baseline in this plan.
- [ ] Manual smoke with `npm run dev`: homepage hero in initial HTML, marketplace cards in initial HTML + images via `/api/ipfs?...w=640`, asset page provenance chart loads, `/br/mint` paints before Privy loads, Cartridge + injected connect both work.
- [ ] Confirm `CLAUDE.md` (repo + workspace "Current UI" line) matches reality after Tasks 1-3 and 9.
