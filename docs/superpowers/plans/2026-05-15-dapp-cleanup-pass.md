# Dapp Cleanup Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 7 targeted refactors identified in the 2026-05-15 dapp audit — dead-code removal, ABI consolidation, shared component extraction, and a documented-but-unenforced wallet-hook convention migration.

**Architecture:** Each task is a self-contained cleanup that produces working software on its own and lands as a single commit. Tasks are ordered low-risk first (deletes) → mechanical migrations → structural extractions. No task introduces new runtime behavior; all should be invisible to users.

**Tech Stack:** Next.js 15 App Router, TypeScript, @medialane/sdk (0.11.0+), starknet-react v8, AVNU paymaster, shadcn/ui.

**Verification model:** No test suite is configured in this repo (`No test suite is configured` per dapp CLAUDE.md). Each task verifies with:
1. `npx tsc --noEmit` (must exit 0, no new errors vs baseline)
2. `bun run build` for tasks that touch app routes or hooks
3. Manual browser smoke deferred to user (called out per task where applicable)

Memory says: never filter the build output with grep; read all of it.

---

## Pre-flight

- [ ] **Step 1: Confirm baseline is clean**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git status --short
git rev-list --left-right --count origin/main...HEAD
```

Expected: working tree clean, `0 0` (in sync with origin). If not clean, stop and investigate.

- [ ] **Step 2: Run baseline tsc + build to capture current error state**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build 2>&1 | tail -8 ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0. If either fails, fix the baseline before proceeding — this plan assumes a green starting state.

---

## Task 1: Delete dead hooks and their dead ABI dependencies

**Why:** Audit identified 7 hooks with zero callers in `src/` plus 2 ABI files with no live consumers. Pure deletion, no callers to migrate.

**Files (deleted):**
- `src/hooks/use-mint.ts`
- `src/hooks/use-create-asset.tsx`
- `src/hooks/use-post-mint-listing.ts`
- `src/hooks/use-ip-listing-contract.ts`
- `src/hooks/use-smart-contract.ts`
- `src/hooks/use-wallet-with-balance.ts`
- `src/hooks/use-paymaster-marketplace.ts`
- `src/abis/ip_listing.ts` (only consumer was `use-ip-listing-contract.ts`)
- `src/abis/ip_licensing.ts` (zero callers)

- [ ] **Step 1: Re-verify zero callers for each (paranoid double-check)**

```bash
cd /Users/kalamaha/dev/medialane-dapp
for hook in useMint useCreateAsset usePostMintListing useIpListingContract useSmartContract useWalletWithBalance usePaymasterMarketplace; do
  echo "=== $hook ==="
  grep -rn "${hook}\b" src --include="*.ts" --include="*.tsx" | grep -v "hooks/use-" | head -3
done
for abi in IPListingABI ipLicensingAbi; do
  echo "=== $abi ==="
  grep -rn "${abi}\b" src --include="*.ts" --include="*.tsx" | grep -v "abis/" | head -3
done
```

Expected: zero matches under every header. If any hook/ABI has matches, do not delete it — investigate and stop.

- [ ] **Step 2: Delete the files**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git rm src/hooks/use-mint.ts \
       src/hooks/use-create-asset.tsx \
       src/hooks/use-post-mint-listing.ts \
       src/hooks/use-ip-listing-contract.ts \
       src/hooks/use-smart-contract.ts \
       src/hooks/use-wallet-with-balance.ts \
       src/hooks/use-paymaster-marketplace.ts \
       src/abis/ip_listing.ts \
       src/abis/ip_licensing.ts
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "EXIT=$?"
```

Expected: EXIT=0. If any error references one of the deleted files, the Step 1 grep missed a caller — restore that file and stop.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git commit -m "chore: delete unused hooks and ABIs

Audited every export — zero non-self consumers in src/:
  - use-mint, use-create-asset, use-post-mint-listing
  - use-ip-listing-contract, use-smart-contract
  - use-wallet-with-balance, use-paymaster-marketplace
  - abis/ip_listing (only consumer was use-ip-listing-contract)
  - abis/ip_licensing (zero callers)"
```

---

## Task 2: Add `MIP_V3_AUDIT_CUTOVER` constant

**Why:** The audit cutover date `"2026-05-14"` is hardcoded in two files (`asset-page-standard.tsx`, `collection-page-client.tsx`) to gate v3-only UI. Move to a named constant for clarity and future edits.

**Files:**
- Modify: `src/lib/constants.ts` (add constant)
- Modify: `src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx` (replace literal)
- Modify: `src/app/collections/[contract]/collection-page-client.tsx` (replace literal)

- [ ] **Step 1: Add the constant**

In `src/lib/constants.ts`, append (preserve existing exports above):

```typescript
/**
 * Mainnet deployment date of the audited MIP-Collections-ERC721 (v3).
 * Used to gate v3-only UI (e.g. transfer_collection_ownership button)
 * since the legacy v2 contract does not implement the same surface.
 * ISO 8601 — sorts lexicographically against Collection.createdAt strings.
 */
export const MIP_V3_AUDIT_CUTOVER = "2026-05-14";
```

- [ ] **Step 2: Find existing usages**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -rn '"2026-05-14"' src --include="*.ts" --include="*.tsx"
```

Expected: 2 matches — one each in `asset-page-standard.tsx` and `collection-page-client.tsx`. If more, update each to use the constant.

- [ ] **Step 3: Replace in `collection-page-client.tsx`**

In `src/app/collections/[contract]/collection-page-client.tsx`:

Add to the existing constants import (find the line that imports from `@/lib/constants` and append):

```typescript
import { EXPLORER_URL, MIP_V3_AUDIT_CUTOVER } from "@/lib/constants";
```

(If the file already imports specific items from `@/lib/constants`, just add `MIP_V3_AUDIT_CUTOVER` to the destructuring.)

Then replace `collection.createdAt >= "2026-05-14"` with `collection.createdAt >= MIP_V3_AUDIT_CUTOVER`.

- [ ] **Step 4: Replace in `asset-page-standard.tsx`**

In `src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx`:

Add `MIP_V3_AUDIT_CUTOVER` to the existing `@/lib/constants` import. Replace `"2026-05-14"` literal with `MIP_V3_AUDIT_CUTOVER`.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "EXIT=$?"
```

Expected: EXIT=0.

- [ ] **Step 6: Confirm no more literals**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -rn '"2026-05-14"' src --include="*.ts" --include="*.tsx"
```

Expected: zero matches (only the constant definition remains, which uses single quotes per repo style — adjust if needed).

- [ ] **Step 7: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/lib/constants.ts 'src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx' 'src/app/collections/[contract]/collection-page-client.tsx'
git commit -m "refactor: extract MIP_V3_AUDIT_CUTOVER constant

The audit cutover date '2026-05-14' was hardcoded in two files to
gate v3-only UI (CreationRecord block, transfer_collection_ownership
button). Move to a named constant in lib/constants.ts."
```

---

## Task 3: Consolidate `src/lib/types.ts` to only `DisplayAsset`

**Why:** Audit found 16 of 17 exports in `lib/types.ts` are unused. Only `DisplayAsset` is consumed (by `use-asset.ts`). Keeping the file as 95% dead code creates a discovery hazard ("does this `Collection` type matter?") and gives lint/IDE false positives.

**Files:**
- Modify: `src/lib/types.ts` (reduce to just `DisplayAsset`)
- Modify: `src/hooks/use-asset.ts` (no import change — same export name and shape)

**Note:** Audit flagged that `Asset` and `Collection` types appeared to have 1 consumer each, but on re-check those were false positives (`Asset` was a same-named identifier elsewhere, `Collection` had no real importers). Verify in Step 1 before deleting.

- [ ] **Step 1: Verify which exports have real importers**

```bash
cd /Users/kalamaha/dev/medialane-dapp
for t in User Item Collection CollectionValidator Offer Deal SocialLink NFT Licensing NFTMetadata Asset SocialMediaLinks UserPreferences Transaction UserStats UserProfile DisplayAsset IPType; do
  importers=$(grep -rln "from \"@/lib/types\"\|from '@/lib/types'" src --include="*.ts" --include="*.tsx" | xargs grep -l "\b${t}\b" 2>/dev/null)
  if [ -n "$importers" ]; then
    echo "=== $t imported by ==="
    echo "$importers"
  fi
done
```

Expected: only `DisplayAsset` appears (imported by `src/hooks/use-asset.ts`). If anything else shows up — extend the keep-list in Step 2 to include it.

- [ ] **Step 2: Replace `src/lib/types.ts` with the minimal file**

Overwrite `src/lib/types.ts` with:

```typescript
/**
 * Local types for the dapp. The vast majority of types here were superseded
 * by @medialane/sdk's ApiToken / ApiCollection / ApiOrder types. This file
 * is the small remnant — only DisplayAsset, which use-asset.ts builds from
 * raw on-chain reads + IPFS metadata before the backend has indexed the
 * token, is still locally owned.
 */

export interface DisplayAsset {
  id: string;
  contractAddress: string;
  tokenId: string;
  owner: string | null;
  metadataUri: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  collection?: {
    name?: string;
    address?: string;
  };
  attributes?: Array<{ trait_type: string; value: string }>;
  externalUrl?: string;
}
```

**IMPORTANT:** Before overwriting, run this to copy the *exact current* `DisplayAsset` interface from `lib/types.ts`:

```bash
cd /Users/kalamaha/dev/medialane-dapp
awk '/^export interface DisplayAsset/,/^}/' src/lib/types.ts
```

Use the printed shape as the canonical definition — paste it into the new file in place of the example above. Do not paraphrase.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "EXIT=$?"
```

Expected: EXIT=0. If errors mention any removed type, restore that one type (Step 1's audit missed it) and try again.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/lib/types.ts
git commit -m "chore: trim lib/types.ts to live exports only

Audit confirmed only DisplayAsset has consumers (one — use-asset.ts).
The other 16 exports (User, Item, Collection, CollectionValidator,
Offer, Deal, SocialLink, NFT, Licensing, NFTMetadata, Asset,
SocialMediaLinks, UserPreferences, Transaction, UserStats,
UserProfile, IPType) were superseded by @medialane/sdk's API types
and had zero importers."
```

---

## Task 4: Migrate marketplace ABIs to `@medialane/sdk`

**Why:** Same pattern as the prior Refactor 1 (which moved IPCollection/IPNft ABIs to SDK). `src/abis/ip_market.ts` and `src/abis/ip_market_1155.ts` are local copies of ABIs that SDK 0.11.0 already exports as `IPMarketplaceABI` and `Medialane1155ABI`. Sole consumer is `use-marketplace.ts`.

**Files:**
- Modify: `src/hooks/use-marketplace.ts` (swap imports to SDK, aliased to existing identifiers)
- Delete: `src/abis/ip_market.ts`, `src/abis/ip_market_1155.ts`

- [ ] **Step 1: Confirm `use-marketplace.ts` is the only consumer**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -rn "from \"@/abis/ip_market\"\|from \"@/abis/ip_market_1155\"\|from '@/abis/ip_market'\|from '@/abis/ip_market_1155'" src --include="*.ts" --include="*.tsx"
```

Expected: only `src/hooks/use-marketplace.ts` matches (two lines: one for each ABI).

- [ ] **Step 2: Confirm the SDK exports match the local shape**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep "IPMarketplaceABI\|Medialane1155ABI" node_modules/@medialane/sdk/dist/index.d.ts | head -5
```

Expected: both names appear as `declare const ...ABI: readonly [...]`. If either is missing, stop — the SDK doesn't expose what we need yet.

- [ ] **Step 3: Swap imports in `use-marketplace.ts`**

Find these two lines in `src/hooks/use-marketplace.ts`:

```typescript
import { IPMarketplaceABI } from "@/abis/ip_market";
import { IPMarketplace1155ABI } from "@/abis/ip_market_1155";
```

Replace with:

```typescript
import { IPMarketplaceABI, Medialane1155ABI as IPMarketplace1155ABI } from "@medialane/sdk";
```

The `as IPMarketplace1155ABI` alias keeps every call site in this hook unchanged (the SDK names the second export `Medialane1155ABI`).

- [ ] **Step 4: Delete the local ABIs**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git rm src/abis/ip_market.ts src/abis/ip_market_1155.ts
```

- [ ] **Step 5: Typecheck + build**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build 2>&1 | tail -8 ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0. If the build fails with shape mismatch, the SDK's ABI export differs from the local copy — stop and diff the two before proceeding.

- [ ] **Step 6: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add -A
git commit -m "refactor: consume marketplace ABIs from @medialane/sdk

src/abis/ip_market.ts and src/abis/ip_market_1155.ts were the last
local ABI copies that have SDK equivalents (IPMarketplaceABI and
Medialane1155ABI in @medialane/sdk@0.11.0). Sole consumer is
use-marketplace.ts; swapped via aliased imports so call sites are
unchanged. Local files deleted."
```

---

## Task 5: Extract `<OwnerActionPanel>` from `asset-page-standard.tsx`

**Why:** `asset-page-standard.tsx` is 923 LOC. The owner-action button row (List / Transfer / Remix / Archive) is duplicated *within the same file*: once for the "has listing" branch, once for the "no listing" branch. Identical JSX except one extra "Cancel listing" button at the top of the has-listing version. Extract to a single component, take a `hasListing?: ApiOrder` prop.

**Files:**
- Create: `src/components/asset/owner-action-panel.tsx`
- Modify: `src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx` (replace both inline blocks with `<OwnerActionPanel />`)

- [ ] **Step 1: Read the current owner block to capture the exact JSX**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -n "isOwner ?" 'src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx'
```

Expected: at least 2 line numbers (the two `{isOwner ? (` blocks). Open the file in your editor and read each block in full so you have the exact button copy / icon / `onClick` handlers (`onClick={() => setListOpen(true)}`, `onClick={() => setTransferOpen(true)}`, `onClick={handleAutoRemix}`, etc.).

- [ ] **Step 2: Create the component**

Create `src/components/asset/owner-action-panel.tsx`:

```typescript
"use client";

import { Tag, ArrowRightLeft, GitBranch, X, Loader2 } from "lucide-react";
import { ArchiveTokenDialog } from "@/components/asset/archive-token-dialog";
import { HelpIcon } from "@/components/ui/help-icon";
import type { ApiOrder } from "@medialane/sdk";

interface OwnerActionPanelProps {
  /** Active listing for this token; renders the Cancel button when present. */
  myListing: ApiOrder | null;
  isERC1155: boolean;
  isProcessing: boolean;
  /** Disables List / Transfer when the token is archived. */
  isArchived: boolean;
  archivedTitle?: string;
  /** Audited registry numeric collection ID — enables ArchiveTokenDialog when present. */
  collectionId?: string | null;
  tokenId: string;
  /** Whether useFullTokenData succeeded (gates ArchiveTokenDialog visibility). */
  fullTokenDataAvailable: boolean;
  onCancelListing: (order: ApiOrder) => void;
  onOpenList: () => void;
  onOpenTransfer: () => void;
  onOpenRemix: () => void;
}

/**
 * Owner-only action row for the standard ERC-721 asset page.
 * Renders Cancel (if has listing) + List + Transfer + Remix + Archive,
 * with gating for archived tokens and audited-contract-only Archive.
 *
 * Extracted from asset-page-standard.tsx where the same block was
 * inlined twice (has-listing branch + no-listing branch).
 */
export function OwnerActionPanel({
  myListing,
  isERC1155,
  isProcessing,
  isArchived,
  archivedTitle,
  collectionId,
  tokenId,
  fullTokenDataAvailable,
  onCancelListing,
  onOpenList,
  onOpenTransfer,
  onOpenRemix,
}: OwnerActionPanelProps) {
  return (
    <div className="space-y-2">
      {myListing && (
        <div className="btn-border-animated p-[1px] rounded-xl">
          <button
            className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-destructive disabled:opacity-50"
            disabled={isProcessing}
            onClick={() => onCancelListing(myListing)}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Cancel listing
          </button>
        </div>
      )}
      <div className="btn-border-animated p-[1px] rounded-xl">
        <button
          className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-blue disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
          disabled={isArchived}
          title={archivedTitle}
          onClick={onOpenList}
        >
          <Tag className="h-4 w-4" />
          {isERC1155 ? "List edition for sale" : myListing ? "Create new listing" : "List for sale"}
        </button>
      </div>
      <div className="btn-border-animated p-[1px] rounded-xl">
        <button
          className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-orange disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100"
          disabled={isArchived}
          title={archivedTitle}
          onClick={onOpenTransfer}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transfer
        </button>
      </div>
      <div className="btn-border-animated p-[1px] rounded-xl">
        <button
          className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-purple"
          onClick={onOpenRemix}
        >
          <GitBranch className="h-4 w-4" />
          Create a Remix
          <HelpIcon
            content="Build a licensed derivative of this IP asset — your remix is minted as a new onchain NFT linked to the original"
            side="top"
          />
        </button>
      </div>
      {collectionId && fullTokenDataAvailable && (
        <div className="pt-1 flex justify-center">
          <ArchiveTokenDialog collectionId={collectionId} tokenId={tokenId} />
        </div>
      )}
    </div>
  );
}
```

**Verify the JSX matches the existing button copy before saving.** If Step 1 showed different `onClick` handlers or text, update accordingly. The "Create a Remix" handler in the existing file is `handleAutoRemix` — the panel takes it as `onOpenRemix`.

- [ ] **Step 3: Replace both inline blocks in `asset-page-standard.tsx`**

Open `src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx`. There are two `isOwner ? (` blocks. In each, replace the `<div className="space-y-2">…</div>` block (i.e., the entire owner action panel JSX) with:

```tsx
<OwnerActionPanel
  myListing={myListing ?? null}
  isERC1155={isERC1155}
  isProcessing={isProcessing}
  isArchived={isArchived}
  archivedTitle={archivedTitle}
  collectionId={collection?.collectionId ?? null}
  tokenId={tokenId}
  fullTokenDataAvailable={!!fullTokenData}
  onCancelListing={handleCancelClick}
  onOpenList={() => setListOpen(true)}
  onOpenTransfer={() => setTransferOpen(true)}
  onOpenRemix={handleAutoRemix}
/>
```

Add the import to the top of the file (alongside the existing asset-component imports):

```typescript
import { OwnerActionPanel } from "@/components/asset/owner-action-panel";
```

**Watch out:** the two blocks differ in one place — the List button label in the "has listing" block reads "Create new listing", in the "no listing" block it reads "List for sale". The new component handles this via `myListing ? "Create new listing" : "List for sale"`. Confirm the existing copy matches before replacing each block. If you find any other divergence between the two blocks beyond the cancel button + list label, do NOT extract — investigate the divergence first.

- [ ] **Step 4: Typecheck + build**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build 2>&1 | tail -8 ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0.

- [ ] **Step 5: Manual browser smoke (deferred to user)**

User verification:
- As owner of an unlisted audited-contract token: List + Transfer + Remix + Archive buttons appear; archive trigger visible.
- As owner of a listed audited-contract token: Cancel listing button appears above the other four.
- As owner of an archived token: List/Transfer disabled (40% opacity, "This token is archived…" tooltip), Remix still enabled, Archive trigger hidden.
- As non-owner: panel not rendered.

- [ ] **Step 6: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add 'src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx' src/components/asset/owner-action-panel.tsx
git commit -m "refactor: extract OwnerActionPanel from asset-page-standard

The owner action row (Cancel / List / Transfer / Remix / Archive)
was inlined twice in asset-page-standard.tsx — once for the
has-listing branch and once for the no-listing branch. Identical
JSX except for an extra Cancel button at the top of the has-listing
variant and a different List label.

The new component encapsulates both shapes via a single myListing
prop, keeping the page client free of duplicated styling and gating
logic."
```

---

## Task 6: Migrate identity-only sites from `useUnifiedWallet` to `useWallet`

**Why:** Repo's documented convention (memory `feedback_medialane_dapp_patterns.md`): use `useWallet()` (returns `{ address, isConnected, walletType }`) for identity; reserve `useUnifiedWallet()` for signing / execution. Actual usage inverts this — 50 files use `useUnifiedWallet`, only 5 use `useWallet`. At least 15 files use `useUnifiedWallet` for identity-only purposes.

This task is **mechanical and per-file**: each candidate must be inspected for actual usage before migrating. Some grep hits may legitimately need `useUnifiedWallet` for execution.

**Candidate files (from audit grep):**
```
src/app/[ipType]/ip-type-page-client.tsx
src/app/asset/[contract]/[tokenId]/asset-page-pop.tsx
src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx
src/app/asset/[contract]/[tokenId]/asset-page-edition.tsx
src/app/asset/[contract]/[tokenId]/asset-page-drop.tsx
src/app/swap/swap-content.tsx
src/app/launchpad/launchpad-content.tsx
src/app/launchpad/pop/my-events/page.tsx
src/app/launchpad/nfteditions/nfteditions-content.tsx
src/app/launchpad/drop/my-drops/page.tsx
src/app/launchpad/drop/[contract]/page.tsx
src/app/portfolio/layout.tsx
src/app/portfolio/offers/page.tsx
src/app/portfolio/received/page.tsx
src/app/portfolio/settings/page.tsx
```

- [ ] **Step 1: Re-run the audit grep to get the current candidate list**

```bash
cd /Users/kalamaha/dev/medialane-dapp
for f in $(grep -rln "useUnifiedWallet" src --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "hooks/use-"); do
  # Files that DON'T reference account/executeAuto/walletType/signMessage/chainId are identity-only
  if ! grep -q "account\b\|executeAuto\|walletType\|signMessage\|chainId" "$f"; then
    echo "$f"
  fi
done
```

Save the output — that's your working set. The audit list above may be stale; trust this fresh grep.

- [ ] **Step 2: Per-file migration loop**

For each file in the working set, do the migration in isolation. Per file:

**2a. Open the file and read all `useUnifiedWallet()` lines.**

The typical pattern is:
```typescript
const { isConnected: isSignedIn, address: walletAddress } = useUnifiedWallet();
```
or
```typescript
const { address, isConnected } = useUnifiedWallet();
```

**2b. Confirm the destructured properties are only `address` and `isConnected` (optionally `walletType`).** If the destructure includes `account`, `executeAuto`, `signMessage`, `chainId`, or anything else — abort this file; it really needs `useUnifiedWallet`. Move to the next file.

**2c. Apply the migration:**

Replace the import line `import { useUnifiedWallet } from "@/hooks/use-unified-wallet";` with `import { useWallet } from "@/hooks/use-wallet";`.

Replace the call `useUnifiedWallet()` with `useWallet()`. Both return `address`, `isConnected`, and `walletType` — same shape for identity reads.

**2d. Typecheck after each file** (don't batch):

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "EXIT=$?"
```

If EXIT≠0, revert the file with `git checkout <file>` and skip it — it needed `useUnifiedWallet` for a reason your grep missed.

- [ ] **Step 3: Final build**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build 2>&1 | tail -8 ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add -A
git commit -m "refactor: migrate identity-only consumers to useWallet()

useWallet() is the documented normalized identity hook (memory:
feedback_medialane_dapp_patterns.md). useUnifiedWallet() should be
reserved for signing / execution. Audit found ~15 files using the
heavyweight hook for read-only address + isConnected access; this
commit migrates the ones that pass a per-file safety check (no
references to account / executeAuto / walletType / signMessage /
chainId in the file body).

Future wallet-stack refactors (e.g. removing StarkZap one day)
won't touch identity-only sites."
```

---

## Task 7: Extract `<CreatorProfileView>` shared component

**Why:** `/account/[address]/creator-page-client.tsx` (545 LOC) and `/creator/[address]/creator-page-client.tsx` (549 LOC) render the same logical creator profile with ~50% identical code. Per user direction, **both routes stay** (different semantic entry points: `/account/[wallet]` for raw addresses, `/creator/[slug-or-wallet]` for vanity/username flow). Only the rendering is shared.

**Files:**
- Create: `src/components/creator/creator-profile-view.tsx`
- Modify: `src/app/account/[address]/creator-page-client.tsx` (thin shell)
- Modify: `src/app/creator/[address]/creator-page-client.tsx` (thin shell with username extras)

- [ ] **Step 1: Identify what each route needs uniquely**

```bash
cd /Users/kalamaha/dev/medialane-dapp
diff -u 'src/app/account/[address]/creator-page-client.tsx' 'src/app/creator/[address]/creator-page-client.tsx' > /tmp/creator-diff.patch
wc -l /tmp/creator-diff.patch
echo "--- imports only in /creator (newer version) ---"
diff 'src/app/account/[address]/creator-page-client.tsx' 'src/app/creator/[address]/creator-page-client.tsx' | grep "^>" | grep "^> import" | head -10
```

Read `/tmp/creator-diff.patch`. The differences cluster into:
- Helpers extracted in `/creator/` but inlined in `/account/`: `addressPalette`, `ActivityRow`, `ACTIVITY_META`, `ACTIVITY_ICONS`
- `/creator/` extras: `CreatorAnalytics` component, social-links banner, `useCreatorProfile` hook

These extras are what makes `/creator/` route different. The rest is identical shared rendering.

- [ ] **Step 2: Decide the prop interface**

The shared `<CreatorProfileView>` will accept:

```typescript
interface CreatorProfileViewProps {
  /** Resolved wallet address (both routes pass this — username route resolves the slug first). */
  address: string;
  /** Optional creator profile from useCreatorProfile (only /creator/ route passes this). */
  profile?: ApiCreatorProfile | null;
  /** Optional analytics block to render between header and tabs (only /creator/ passes this). */
  analyticsSlot?: React.ReactNode;
  /** Whether to render social-links banner under the header. */
  showSocialLinks?: boolean;
}
```

This makes both extras (analytics + social links) opt-in via props/slots, so `/account/` simply doesn't pass them.

- [ ] **Step 3: Create `creator-profile-view.tsx`**

Create `src/components/creator/creator-profile-view.tsx`. The body is the **newer** `/creator/[address]/creator-page-client.tsx` rendering, with these changes:
1. Wrap the default export as a named export: `export function CreatorProfileView({ address, profile, analyticsSlot, showSocialLinks }: CreatorProfileViewProps)`.
2. Remove the `useParams` call at the top — `address` now comes from props.
3. Remove the `useCreatorProfile(address)` call — `profile` now comes from props (so `/account/` can skip the API hit).
4. Replace the inline analytics render with `{analyticsSlot}`.
5. Replace the inline social-links section with `{showSocialLinks && profile && (<SocialLinks profile={profile} />)}`. If the social-links code is more than a few lines, extract that block into a local `function SocialLinks(...)` inside the same file.

**Do not paraphrase the existing JSX** — copy it verbatim from `/creator/[address]/creator-page-client.tsx` and only apply the four mechanical changes above.

- [ ] **Step 4: Rewrite `/creator/[address]/creator-page-client.tsx` as a thin shell**

Overwrite the file:

```typescript
"use client";

import { useParams } from "next/navigation";
import { useCreatorProfile } from "@/hooks/use-profiles";
import { CreatorProfileView } from "@/components/creator/creator-profile-view";
import { CreatorAnalytics } from "@/components/creator/creator-analytics";

export default function CreatorPageClient() {
  const { address } = useParams<{ address: string }>();
  const { profile } = useCreatorProfile(address);

  return (
    <CreatorProfileView
      address={address}
      profile={profile}
      analyticsSlot={<CreatorAnalytics address={address} />}
      showSocialLinks
    />
  );
}
```

- [ ] **Step 5: Rewrite `/account/[address]/creator-page-client.tsx` as a thinner shell**

Overwrite the file:

```typescript
"use client";

import { useParams } from "next/navigation";
import { CreatorProfileView } from "@/components/creator/creator-profile-view";

export default function CreatorPageClient() {
  const { address } = useParams<{ address: string }>();
  return <CreatorProfileView address={address} />;
}
```

- [ ] **Step 6: Verify the addressPalette + ActivityRow helpers are still importable**

```bash
cd /Users/kalamaha/dev/medialane-dapp
ls src/lib/creator-utils.ts src/components/creator/activity-row.tsx
```

Expected: both exist. The shared `CreatorProfileView` imports them; the old inlined copies in `/account/` go away.

- [ ] **Step 7: Typecheck + build**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build 2>&1 | tail -8 ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0.

- [ ] **Step 8: Manual browser smoke (deferred to user)**

User verification:
- `/account/0x...` (a raw wallet) renders the profile, no analytics block, no social-links banner.
- `/creator/some-username` redirects (per existing redirect logic) and renders profile WITH analytics + social links.
- `/creator/0x...` (a wallet, not a username) redirects to `/account/0x...` per existing logic.

- [ ] **Step 9: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/creator/creator-profile-view.tsx 'src/app/account/[address]/creator-page-client.tsx' 'src/app/creator/[address]/creator-page-client.tsx'
git commit -m "refactor: share CreatorProfileView between /account and /creator

Both routes render the same logical creator profile but historically
maintained two parallel ~550-line page clients with ~50% drift
(addressPalette inline vs extracted, ActivityRow inline vs
component, etc.). Per product intent both routes stay — only the
rendering is shared.

CreatorProfileView accepts optional analyticsSlot + showSocialLinks
so /creator/ (username flow with profile fetch + analytics + socials)
can pass them while /account/ (raw wallet address) skips them
entirely."
```

---

## Task 8: Final verification pass

- [ ] **Step 1: Confirm working tree is clean**

```bash
cd /Users/kalamaha/dev/medialane-dapp && git status --short
```

Expected: empty output.

- [ ] **Step 2: Final tsc + build (don't filter output)**

Per memory `feedback_run_build_before_push.md`: never filter with grep; read the full output.

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0. Scan the build output for new warnings that weren't in the baseline (captured in pre-flight Step 2).

- [ ] **Step 3: Push**

```bash
cd /Users/kalamaha/dev/medialane-dapp && git push origin main
```

- [ ] **Step 4: Confirm Vercel deploy completes cleanly**

User verification — watch the Vercel dashboard for the deploy of the merged commits. If anything fails, investigate before celebrating.

---

## Out of scope (deferred)

Two items from the audit are deliberately not in this plan:

1. **Split `use-marketplace.ts` (812 LOC) into per-action hooks.** Real win but the biggest change in the audit, and unlike everything in this plan it would alter runtime behavior (separate `isProcessing` states per action). Deserves its own plan and a careful browser pass. Schedule separately.

2. **Re-evaluate the wallet stack abstractions** (`useUnifiedWallet`, `useWalletSession`, `useSessionKey` shim). Task 6 cleans up the misuse of `useUnifiedWallet`, but the underlying question — do we need three layers? — is unanswered. Suggest a separate brainstorm/plan once the StarkZap migration solidifies.
