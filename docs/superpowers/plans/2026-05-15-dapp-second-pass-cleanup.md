# Dapp Second-Pass Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Knock out the seven remaining cleanup items from the second-pass audit — dead-file deletion, shim retirement, mirrored extractions in asset variants, Codex commit triage, plus surveys of three suspected duplication clusters (launchpad creators, notifications, IP-type page).

**Architecture:** Each task is independently shippable and lands as its own commit. Tasks ordered low-risk first: pure deletes → mechanical migrations → audits/decisions. None of these tasks gate trading, marketplace flows, or any production-critical path — those were already restored after the morning's incidents.

**Tech Stack:** Next.js 15 App Router, TypeScript, @medialane/sdk 0.11.0, starknet-react v8, shadcn/ui.

**Lessons that constrain this plan** (memory: `feedback_medialane_values.md`, `feedback_no_premature_constants.md`):
- The platform is permissionless / censorship-resistant / user-sovereign. **No task in this plan may add a gate on contract identity, wallet type, asset source, or migration history.** The smart contract is the only authority over what trades can happen.
- Don't extract literals into named constants for 1–2 callsites. Inline comment at the callsite is the right move.
- Don't name code after version/audit/migration internals.

**Verification model:** No test suite in this repo. Each task verifies with:
1. `npx tsc --noEmit` (must exit 0)
2. `bun run build` for tasks that touch app routes or hooks (never filter the build output with grep — read the full output)
3. Manual browser smoke deferred to user, called out per task where applicable.

**Deferred (intentionally NOT in this plan):**
- Full `<CreatorProfileView>` extraction (~500 LOC of duplication remains in `/account/[address]` and `/creator/[address]` page clients — the today-incident-day version did the safe inline-helper dedup only)
- Split `use-marketplace.ts` (812 LOC) into per-action hooks
Both will get their own plans when there's a quiet day for the kind of large structural rewrites that need careful browser verification.

---

## Pre-flight

- [ ] **Step 1: Confirm baseline is clean**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git status --short
git rev-list --left-right --count origin/main...HEAD
```

Expected: working tree clean, `0 0`. If not, stop and investigate.

- [ ] **Step 2: Capture baseline tsc + build state**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build 2>&1 | tail -8 ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0. If either fails, fix baseline before proceeding.

---

## Task 1: Delete `src/lib/templates.ts` (118 LOC, zero callers)

**Why:** Audit found this file has zero importers anywhere in `src/`. Same pattern as the `lib/types.ts` cleanup from yesterday's plan.

**Files (deleted):**
- `src/lib/templates.ts`

- [ ] **Step 1: Re-verify zero callers**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -rn "from \"@/lib/templates\"\|from '@/lib/templates'" src --include="*.ts" --include="*.tsx"
```

Expected: zero output. If anything matches, stop — the file is referenced.

- [ ] **Step 2: Delete**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git rm src/lib/templates.ts
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "EXIT=$?"
```

Expected: EXIT=0.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git commit -m "chore: delete unused src/lib/templates.ts

118 LOC, zero importers anywhere in src/. Same audit pattern as
the lib/types.ts cleanup."
```

---

## Task 2: Mirror `OwnerActionPanel` extraction in drop + edition variants

**Why:** Yesterday's cleanup extracted `<OwnerActionPanel>` from `asset-page-standard.tsx`. The drop and edition variants (`asset-page-drop.tsx`, `asset-page-edition.tsx`) almost certainly have the same kind of inlined owner-action block twice (has-listing / no-listing branches). Same surgery, same payoff. Doing this in two passes — one per variant — keeps each commit auditable.

### 2a. Drop variant

**Files:**
- Modify: `src/app/asset/[contract]/[tokenId]/asset-page-drop.tsx`

- [ ] **Step 1: Locate the owner blocks**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -n "isOwner ?" 'src/app/asset/[contract]/[tokenId]/asset-page-drop.tsx'
```

Expected: two `isOwner ? (` line numbers. Open the file and visually confirm both blocks render the same shape as the standard variant (Cancel listing button gated on `myListing`, then List / Transfer / Remix buttons).

- [ ] **Step 2: Check whether `<OwnerActionPanel>` props fit**

`<OwnerActionPanel>` expects:
```
myListing: ApiOrder | null
isERC1155: boolean
isProcessing: boolean
onCancelListing: (order: ApiOrder) => void
onOpenList: () => void
onOpenTransfer: () => void
onOpenRemix: () => void
```

If the drop variant has any extra action button (a service-specific CTA, claim button, etc.) that doesn't fit this shape, **stop**. The variant has divergent semantics; don't force the shared component. Document the divergence as a comment in the variant and skip the extraction for that file.

If the buttons match: continue.

- [ ] **Step 3: Replace both inline blocks**

Replace each `{isOwner ? (<div className="space-y-2">…</div>) : isSignedIn ? (` with `{isOwner ? (<OwnerActionPanel … />) : isSignedIn ? (`:

For the has-listing block:
```tsx
<OwnerActionPanel
  myListing={myListing ?? null}
  isERC1155={isERC1155}
  isProcessing={isProcessing}
  onCancelListing={handleCancelClick}
  onOpenList={() => setListOpen(true)}
  onOpenTransfer={() => setTransferOpen(true)}
  onOpenRemix={() => router.push(`/create/remix/${contract}/${tokenId}`)}
/>
```

For the no-listing block:
```tsx
<OwnerActionPanel
  myListing={null}
  isERC1155={isERC1155}
  isProcessing={isProcessing}
  onCancelListing={handleCancelClick}
  onOpenList={() => setListOpen(true)}
  onOpenTransfer={() => setTransferOpen(true)}
  onOpenRemix={() => router.push(`/create/remix/${contract}/${tokenId}`)}
/>
```

Add the import to the top of the file:

```typescript
import { OwnerActionPanel } from "@/components/asset/owner-action-panel";
```

- [ ] **Step 4: Remove now-unused imports**

After the replacement, the inline blocks' icons (`Tag`, `ArrowRightLeft`, `GitBranch`, `X`, `Loader2`) and helpers (`HelpIcon`) may be unused in this file. Re-check before removing:

```bash
cd /Users/kalamaha/dev/medialane-dapp
for sym in Tag ArrowRightLeft GitBranch HelpIcon; do
  count=$(grep -c "$sym" 'src/app/asset/[contract]/[tokenId]/asset-page-drop.tsx')
  echo "$sym: $count"
done
```

If `count == 1` for any of those (only the import line remains), drop it from the import. If `count > 1`, leave it (used elsewhere). `Loader2` and `X` are often used in other states — most likely keep both.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "EXIT=$?"
```

Expected: EXIT=0.

- [ ] **Step 6: Commit (drop variant only)**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add 'src/app/asset/[contract]/[tokenId]/asset-page-drop.tsx'
git commit -m "refactor(asset): use OwnerActionPanel in drop variant

Same extraction the standard variant got — replaces two inline
owner-action blocks (has-listing / no-listing branches) with the
shared component."
```

### 2b. Edition variant

**Files:**
- Modify: `src/app/asset/[contract]/[tokenId]/asset-page-edition.tsx`

- [ ] **Step 1: Repeat the same audit as 2a Step 1**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -n "isOwner ?" 'src/app/asset/[contract]/[tokenId]/asset-page-edition.tsx'
```

- [ ] **Step 2: Check shape compatibility**

ERC-1155 editions differ from ERC-721 in one place — the "List edition for sale" label vs "List for sale". `<OwnerActionPanel>` already handles this via the `isERC1155` prop:

```tsx
{isERC1155 ? "List edition for sale" : myListing ? "Create new listing" : "List for sale"}
```

The buttons themselves (Cancel / List / Transfer / Remix) are the same. The edition variant should fit cleanly. If any edition-specific CTA exists (e.g. an "Owners" panel hook, multi-edition burn, etc.) that the standard variant doesn't have, **stop and document** before forcing the extraction.

- [ ] **Step 3: Replace both inline blocks**

Same pattern as 2a Step 3. The edition variant uses `isERC1155 = true` so the List button label changes automatically.

- [ ] **Step 4: Typecheck + build**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build 2>&1 | tail -8 ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0.

- [ ] **Step 5: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add 'src/app/asset/[contract]/[tokenId]/asset-page-edition.tsx'
git commit -m "refactor(asset): use OwnerActionPanel in edition variant

ERC-1155 editions plug into OwnerActionPanel with isERC1155=true,
which already switches the List button label."
```

---

## Task 3: Migrate `useSessionKey` consumers → delete the shim

**Why:** `src/hooks/use-session-key.ts` is an explicit compatibility shim that just forwards to `useUnifiedWallet` and returns the io-shaped API. Memory says "Do not use in new code." Four files still use it. All four only consume `walletAddress` and (sometimes) `hasWallet` — both equivalent to `useWallet()`'s `address` and `isConnected`. Migrate the consumers and delete the shim.

**Files:**
- Modify: `src/components/launch-mint.tsx`
- Modify: `src/app/create/collection/page.tsx`
- Modify: `src/app/create/asset/page.tsx`
- Modify: `src/app/create/remix/[contract]/[tokenId]/page.tsx`
- Delete: `src/hooks/use-session-key.ts`

- [ ] **Step 1: Audit each consumer's destructure**

```bash
cd /Users/kalamaha/dev/medialane-dapp
for f in src/components/launch-mint.tsx \
         src/app/create/collection/page.tsx \
         src/app/create/asset/page.tsx \
         'src/app/create/remix/[contract]/[tokenId]/page.tsx'; do
  echo "=== $f ==="
  grep "useSessionKey(" "$f"
done
```

Expected: each line destructures only `walletAddress`, `hasWallet`, `isLoadingWallet`, or similar wallet-identity fields. If any consumer reads `storedSession`, `sessionPreferences`, `setupSession`, `signTypedData`, or `refetchWallet` — **stop**. Those don't exist on `useWallet()` and need separate handling. Document and skip that file (the shim stays alive for it).

- [ ] **Step 2: Migrate the destructures**

In each file, replace:
```typescript
import { useSessionKey } from "@/hooks/use-session-key";
```
with:
```typescript
import { useWallet } from "@/hooks/use-wallet";
```

And replace the destructure. The shim returns `{ walletAddress, hasWallet, isLoadingWallet, ... }`; `useWallet()` returns `{ address, isConnected, walletType }`. Map fields:
- `walletAddress` → `address`
- `hasWallet` → `isConnected`
- `isLoadingWallet` → there's no direct equivalent. If a file uses it (likely `launch-mint.tsx`), check what it gates and replace with a sensible alternative (often just `!isConnected`).

Concrete example for `launch-mint.tsx` (line 95 currently reads):
```typescript
const { walletAddress: sessionWalletAddress, hasWallet, isLoadingWallet } = useSessionKey();
```
Becomes:
```typescript
const { address: sessionWalletAddress, isConnected: hasWallet } = useWallet();
const isLoadingWallet = false; // useWallet exposes connection state synchronously; loading state was a useSessionKey artifact
```

(If `isLoadingWallet` is read anywhere meaningful in this file, leave the `useSessionKey` import in place for this file and document the reason in a comment. The shim survives until that's untangled.)

For the simpler files (`create/collection/page.tsx`, `create/asset/page.tsx`):
```typescript
const { walletAddress, hasWallet } = useSessionKey();
```
becomes:
```typescript
const { address: walletAddress, isConnected: hasWallet } = useWallet();
```

For `create/remix/.../page.tsx`:
```typescript
const { walletAddress } = useSessionKey();
```
becomes:
```typescript
const { address: walletAddress } = useWallet();
```

- [ ] **Step 3: Typecheck after each file (not batched)**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "EXIT=$?"
```

Migrate one file → typecheck → next file. If a file errors, revert THAT file with `git checkout <file>` and leave the shim for it.

- [ ] **Step 4: Confirm shim has zero consumers**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -rn "useSessionKey\|use-session-key" src --include="*.ts" --include="*.tsx" | grep -v "hooks/use-session-key.ts"
```

Expected: zero output. If anything matches, do not delete the shim — that consumer was missed.

- [ ] **Step 5: Delete the shim**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git rm src/hooks/use-session-key.ts
```

- [ ] **Step 6: Typecheck + build**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build 2>&1 | tail -8 ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0.

- [ ] **Step 7: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add -A
git commit -m "refactor: retire useSessionKey compatibility shim

The shim forwarded to useUnifiedWallet and exposed io's ChipiPay
API shape so copied components compiled. All 4 active consumers
only read walletAddress + hasWallet (both equivalent to
useWallet's address + isConnected). Migrated each, then deleted
the shim.

Memory note feedback_medialane_dapp_patterns.md said 'do not use
in new code' — this lands the eventual cleanup."
```

---

## Task 4: Codex commit `2f8a05c` triage — keep, revert, or re-do each piece

**Why:** That commit was unauthorized. The marketplace gate was hotfix-reverted on 2026-05-15. The other 5 changes are still on `main`, untouched, and haven't been reviewed deliberately. Decision needed per piece — this task does **not** rewrite anything; it surfaces each diff and writes the decision down.

**Files (unchanged but reviewed):**
- `src/app/api/ipfs/[...cid]/route.ts` — added rate limiting + body size cap
- `src/app/api/wallet/sign/route.ts` — added something (need to read)
- `src/components/shared/asset-preview-dialog.tsx` — `<img>` → `<Image>` migration
- `src/components/shared/asset-preview-standard.tsx` — `<img>` → `<Image>` migration
- `src/hooks/use-claims.ts` — **deleted by Codex**

- [ ] **Step 1: Pull the full diff of the commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git show 2f8a05c -- src/app/api/ipfs/'[...cid]'/route.ts \
                    src/app/api/wallet/sign/route.ts \
                    src/components/shared/asset-preview-dialog.tsx \
                    src/components/shared/asset-preview-standard.tsx \
                    src/hooks/use-claims.ts > /tmp/codex-commit-diff.patch
wc -l /tmp/codex-commit-diff.patch
```

Read `/tmp/codex-commit-diff.patch` end to end.

- [ ] **Step 2: Verify `use-claims.ts` deletion was safe**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -rn "useClaims\|use-claims" src --include="*.ts" --include="*.tsx"
```

Expected: zero references. If references exist anywhere in the current `src/`, the deletion broke an import — investigate.

If clean: the deletion is safe-after-the-fact. No action needed (the file is already gone).

- [ ] **Step 3: Decide on `/api/ipfs/[...cid]/route.ts` rate limit**

The change added an in-memory IP-keyed rate limiter (120 req / 60s window) and a 25MB response body cap. Both are legitimate defensive measures for an IPFS proxy.

Decision criteria:
- **Keep as-is** if production traffic is small enough that 120 req/min/IP is fine, AND you accept in-memory state (resets on restart, not shared across Vercel instances).
- **Replace with a deliberate version** if you'd rather use an existing rate-limit middleware (Vercel Edge has one, or Hono middleware on a separate route).
- **Revert** if you don't want any rate limit on IPFS (rare — IPFS proxies are a known abuse vector).

Most likely: **keep**. Write the decision in `docs/superpowers/decisions/2026-05-15-codex-commit-2f8a05c.md`:

```markdown
# Codex commit 2f8a05c triage (2026-05-15)

## IPFS rate limit (src/app/api/ipfs/[...cid]/route.ts)
DECISION: Keep.
RATIONALE: Defensive against IPFS proxy abuse. In-memory state is
acceptable for current traffic; revisit if Vercel scales to multiple
concurrent instances.
```

If the decision is "revert" or "replace", do that as a separate commit and update the decision doc.

- [ ] **Step 4: Decide on `/api/wallet/sign/route.ts` changes**

Read the diff carefully — this route handles Privy server-side signing. Any auth/authorization tightening is good; anything that changed the signature flow needs deliberate review.

```bash
cd /Users/kalamaha/dev/medialane-dapp
git show 2f8a05c -- src/app/api/wallet/sign/route.ts | head -80
```

Decision criteria:
- If the change tightens auth (e.g., added Privy session validation, request signature checks) → **keep**.
- If the change altered the typed-data format or PIN handling → **revert** and re-implement deliberately.

Append the decision to the same decision doc.

- [ ] **Step 5: Decide on `<img>` → `<Image>` migrations**

The `asset-preview-dialog.tsx` and `asset-preview-standard.tsx` changes swap raw `<img>` for Next.js `<Image>` with `unoptimized`. This is generally a quality improvement (lazy loading, CLS prevention) but the `unoptimized` flag means it's effectively the same as `<img>` at runtime.

Decision: **keep** unless there's a known regression (e.g. the `accentOverlay` hidden img was used for `onError` detection and the new `<Image>` doesn't fire `onError` reliably). Verify in the file:

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -n "onError\|setImgError" src/components/shared/asset-preview-standard.tsx
```

If `onError` fires correctly in the production build, keep. Otherwise revert just that one file.

- [ ] **Step 6: Commit the decision doc**

```bash
cd /Users/kalamaha/dev/medialane-dapp
mkdir -p docs/superpowers/decisions
git add docs/superpowers/decisions/2026-05-15-codex-commit-2f8a05c.md
git commit -m "docs: triage decisions for codex commit 2f8a05c

Records keep/revert decisions for the unauthorized commit's
non-marketplace pieces. The marketplace gate was already
hotfix-reverted on 2026-05-15."
```

(If any of steps 3/4/5 led to a revert, commit that separately first — the decision doc references those commits.)

---

## Task 5: Survey launchpad creation pages

**Why:** Three large pages (`drop/create`, `nfteditions/create`, `pop/create` — 626 + 428 + 427 = 1481 LOC) likely share form scaffolding, IPFS upload flow, success states. Or they might be intentionally divergent because the underlying contracts differ. **Survey first, then decide whether to extract.**

**Files (surveyed, not modified):**
- `src/app/launchpad/drop/create/page.tsx`
- `src/app/launchpad/nfteditions/create/page.tsx`
- `src/app/launchpad/pop/create/page.tsx`

- [ ] **Step 1: Pull the top-level structure of each**

```bash
cd /Users/kalamaha/dev/medialane-dapp
for f in src/app/launchpad/drop/create/page.tsx \
         src/app/launchpad/nfteditions/create/page.tsx \
         src/app/launchpad/pop/create/page.tsx; do
  echo "=== $f ==="
  grep -n "^function\|^const.*=\|^export\|^interface\|useState\|useForm\|onSubmit\|handleSubmit" "$f" | head -20
done
```

- [ ] **Step 2: Look for shared form fields**

```bash
cd /Users/kalamaha/dev/medialane-dapp
for f in src/app/launchpad/drop/create/page.tsx \
         src/app/launchpad/nfteditions/create/page.tsx \
         src/app/launchpad/pop/create/page.tsx; do
  echo "=== $f ==="
  grep -oE '"(name|symbol|description|image|baseUri|imageFile|maxSupply|royalty|priceToken|price|startTime|endTime)"' "$f" | sort -u
done
```

Common field names across all three indicate a shared form. If the same 4–6 fields appear in all three, there's a `<CollectionCreateForm>` extraction candidate.

- [ ] **Step 3: Diff each pair pairwise**

```bash
cd /Users/kalamaha/dev/medialane-dapp
diff -u src/app/launchpad/drop/create/page.tsx src/app/launchpad/nfteditions/create/page.tsx | wc -l
diff -u src/app/launchpad/drop/create/page.tsx src/app/launchpad/pop/create/page.tsx | wc -l
diff -u src/app/launchpad/nfteditions/create/page.tsx src/app/launchpad/pop/create/page.tsx | wc -l
```

If any pair has < 200 diff lines (out of 400-600 file lines), there's substantial sharing. If all three pairs have > 500 diff lines, the pages are largely different and forced unification would be bad.

- [ ] **Step 4: Decide and document**

Write findings to `docs/superpowers/decisions/2026-05-15-launchpad-create-survey.md`:

```markdown
# Launchpad create pages — survey (2026-05-15)

## Structure
- drop/create: <one-line summary of the flow>
- nfteditions/create: <one-line summary>
- pop/create: <one-line summary>

## Shared concepts
- <list fields/components/utilities seen in 2+ files>

## Divergent concepts
- <list things specific to each>

## DECISION
- [ ] Extract <ComponentName> for <responsibility>
- [ ] Leave as-is — pages are too divergent for shared abstraction
- [ ] Partial: extract <FieldGroup> only

## RATIONALE
<one paragraph>
```

- [ ] **Step 5: Commit the survey**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add docs/superpowers/decisions/2026-05-15-launchpad-create-survey.md
git commit -m "docs: survey launchpad create pages for shared structure

No code changes — captures whether the three create pages have
extractable shared scaffolding or are legitimately different."
```

If the decision was "extract", that's a separate refactor — schedule it as a follow-up plan. Do not extract in this task.

---

## Task 6: Audit the three notification components

**Why:** `notification-spotlight.tsx`, `notifications-feed.tsx`, `notifications-sheet.tsx` are three mounts for the same data. Likely share row rendering / empty states / icon maps.

**Files (surveyed):**
- `src/components/shared/notification-spotlight.tsx`
- `src/app/notifications/notifications-feed.tsx`
- `src/components/layout/notifications-sheet.tsx`

- [ ] **Step 1: Inventory each file's exports + structure**

```bash
cd /Users/kalamaha/dev/medialane-dapp
for f in src/components/shared/notification-spotlight.tsx \
         src/app/notifications/notifications-feed.tsx \
         src/components/layout/notifications-sheet.tsx; do
  echo "=== $f ($(wc -l < "$f") LOC) ==="
  grep -n "^function\|^const.*=.*function\|^export\|interface\|useNotifications\|NOTIFICATION_" "$f" | head -10
done
```

- [ ] **Step 2: Check for already-shared modules**

```bash
cd /Users/kalamaha/dev/medialane-dapp
grep -rln "NOTIFICATION_ICON\|NOTIFICATION_COLOR\|NOTIFICATION_LABEL\|notification-meta\|notification-row" src --include="*.ts" --include="*.tsx"
```

Memory note (`feedback_medialane_dapp_patterns`) mentions `src/lib/notification-meta.ts` and `src/components/shared/notification-row.tsx` are already shared. Confirm those still exist and are imported by all three.

- [ ] **Step 3: Decide**

Write findings to `docs/superpowers/decisions/2026-05-15-notifications-audit.md`:

```markdown
# Notifications components — audit (2026-05-15)

## Files
- src/components/shared/notification-spotlight.tsx (LOC)
- src/app/notifications/notifications-feed.tsx (LOC)
- src/components/layout/notifications-sheet.tsx (LOC)

## Existing shared modules
- <list — meta map, row component, hooks>

## DECISION
- [ ] No refactor needed — sharing is already in place via <module list>
- [ ] Extract <X> from <Y> (single targeted change)
- [ ] Full restructure warranted (separate plan)

## RATIONALE
<one paragraph>
```

- [ ] **Step 4: Commit the audit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add docs/superpowers/decisions/2026-05-15-notifications-audit.md
git commit -m "docs: audit notification components

Records whether the three notification mounts share enough or
need refactoring. No code changes."
```

If the decision was "extract" with a small targeted change, do it in a follow-up commit immediately. If "full restructure," schedule a separate plan.

---

## Task 7: Survey `ip-type-page-client.tsx` against `marketplace-page-client.tsx`

**Why:** `ip-type-page-client.tsx` (487 LOC) is a discover/filter-by-IP-type page. `marketplace-page-client.tsx` (461 LOC) is the main marketplace listing. Both render filterable token grids — likely share filter chips, sort dropdown, pagination, empty state.

**Files (surveyed):**
- `src/app/[ipType]/ip-type-page-client.tsx`
- `src/app/marketplace/marketplace-page-client.tsx`

- [ ] **Step 1: Compare imports + main sections**

```bash
cd /Users/kalamaha/dev/medialane-dapp
echo "=== ip-type imports ==="
head -40 'src/app/[ipType]/ip-type-page-client.tsx' | grep "^import"
echo "=== marketplace imports ==="
head -40 src/app/marketplace/marketplace-page-client.tsx | grep "^import"
echo "=== shared imports ==="
comm -12 \
  <(head -40 'src/app/[ipType]/ip-type-page-client.tsx' | grep "^import" | sort) \
  <(head -40 src/app/marketplace/marketplace-page-client.tsx | grep "^import" | sort)
```

- [ ] **Step 2: Diff size**

```bash
cd /Users/kalamaha/dev/medialane-dapp
diff -u 'src/app/[ipType]/ip-type-page-client.tsx' src/app/marketplace/marketplace-page-client.tsx | wc -l
```

If < 300 diff lines, substantial shared rendering. > 500, mostly different.

- [ ] **Step 3: Identify the most promising shared component**

The most likely extraction candidate is the filter toolbar (sort + currency + IP-type chips) or the token grid + pagination. Pick the largest contiguous block of duplicated JSX (read both files manually to confirm) and write the proposal.

- [ ] **Step 4: Decide and document**

Write findings to `docs/superpowers/decisions/2026-05-15-discover-pages-audit.md`:

```markdown
# Discover/filter pages — audit (2026-05-15)

## Files
- src/app/[ipType]/ip-type-page-client.tsx (LOC)
- src/app/marketplace/marketplace-page-client.tsx (LOC)

## Shared structure observed
- <list — filter toolbar, token grid, pagination, …>

## DECISION
- [ ] Extract <X> to <path>
- [ ] No refactor — pages are intentionally different
- [ ] Partial extraction of <Y>

## RATIONALE
<one paragraph — include estimated LOC reduction>
```

- [ ] **Step 5: Commit the survey**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add docs/superpowers/decisions/2026-05-15-discover-pages-audit.md
git commit -m "docs: audit ip-type-page-client vs marketplace-page-client

Records whether the two filterable token grids share enough
structure to extract a common toolbar/grid component, or are
intentionally different."
```

---

## Task 8: Final verification + push

- [ ] **Step 1: Confirm working tree clean**

```bash
cd /Users/kalamaha/dev/medialane-dapp && git status --short
```

Expected: empty output.

- [ ] **Step 2: Final tsc + build (read the full output)**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit ; echo "TSC_EXIT=$?"
~/.nvm/versions/node/v24.15.0/bin/bun run build ; echo "BUILD_EXIT=$?"
```

Expected: both EXIT=0. Scan the build output for new warnings vs the pre-flight baseline.

- [ ] **Step 3: Push**

```bash
cd /Users/kalamaha/dev/medialane-dapp && git push origin main
```

- [ ] **Step 4: Watch Vercel deploy**

User verification. The Vercel deploy should land cleanly — none of this work changes runtime behavior except Task 3 (which only swaps wallet-identity hooks; functionally identical).

---

## Out of scope (still deferred)

- **Full `<CreatorProfileView>` extraction** — partial dedup landed yesterday. Structural extraction needs ~500-line JSX surgery in two route shells with no tests; not after an incident day.
- **Split `use-marketplace.ts` into per-action hooks** — biggest single win in the audit, but real risk. Schedule its own plan.
