# MIP Collections v3 (Audited) Migration — UI & Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the new audited `MIP-Collections-ERC721` capabilities in medialane-dapp (immutable Berne Convention provenance, archive instead of burn, per-collection ownership transfer, transferability checks) and clean up obsolete `is_active` / `total_burned` references.

**Architecture:** Net-new UI sits on top of two new hooks (`useFullTokenData`, `useIsTransferable`) that wrap the audited `IPNft` and `IPCollection` reads. New dialogs (`ArchiveTokenDialog`, `TransferCollectionOwnershipDialog`) follow the existing paymaster-execution pattern (`executeAuto` from `usePaymasterTransaction`). Collection type drops removed contract fields rather than keeping shims, since user feedback confirmed hard switch.

**Tech Stack:** Next.js 15 App Router, starknet.js v8 via @starknet-react/core, StarkZap SDK, shadcn/ui dialogs, Tailwind, AVNU paymaster for gasless tx.

**Verification model:** No test suite in dapp. Each task verifies via `npx tsc --noEmit` (clean), plus a manual browser smoke step where UI-visible. Final task runs `bun run build`. Memory says always `tsc --noEmit` before `bun run build`; never filter build output with grep.

---

## Pre-flight (manual, not code — do before starting Task 1)

These are ops actions the human must run; they cannot be automated by an agent:

- [ ] **Railway env**: set `COLLECTION_721_CONTRACT_MAINNET=0x07c2207d200a1dce1cc82a117d8ba91dabfe3d1cc5072d9e4cdd9654fbb0ff10` on the medialane-backend service. Restart the service. Confirm `/health` returns 200.
- [ ] **Vercel env**: set `NEXT_PUBLIC_COLLECTION_CONTRACT=0x07c2207d200a1dce1cc82a117d8ba91dabfe3d1cc5072d9e4cdd9654fbb0ff10` for medialane-dapp production + preview. Trigger redeploy.
- [ ] **Smoke**: from the deployed dapp, create a test collection + mint one token. Within ~10s, confirm the backend `/v1/collections/:contract` returns the new collection with a non-null `collectionId`.

If the smoke step fails, **do not proceed** with the plan tasks — the contract integration is broken upstream.

---

## Task 1: Delete the broken `use-nft-details.ts` hook

**Why:** This hook calls `symbol` / `name` / `tokenURI` / `ownerOf` against the registry address (`IPCollection`). Those methods only exist on per-collection `IPNft` contracts. The hook has been broken since at least the v2 audited contract switch. Deleting it now prevents copy-paste of broken patterns.

**Files:**
- Delete: `src/hooks/use-nft-details.ts`
- Verify-only: grep for `useNFTDetails` references

- [ ] **Step 1: Confirm no callers**

```bash
grep -rn "useNFTDetails\|use-nft-details" /Users/kalamaha/dev/medialane-dapp/src
```

Expected: zero matches (the hook is unused).

- [ ] **Step 2: Delete the file**

```bash
rm /Users/kalamaha/dev/medialane-dapp/src/hooks/use-nft-details.ts
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit
```

Expected: EXIT=0, no output.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add -A src/hooks/use-nft-details.ts
git commit -m "chore: remove dead use-nft-details hook (called IPNft methods on the registry)"
```

---

## Task 2: Drop obsolete fields from local `Collection` type

**Why:** The audited contract removed `is_active` from the `Collection` struct and renamed `total_burned`/`last_burn_time` to `total_archived`/`last_archive_time` in `CollectionStats`. The dapp's local `Collection` interface (`src/lib/types.ts`) still has the old shape, which will silently produce `undefined` reads at runtime against the new ABI.

**Files:**
- Modify: `src/lib/types.ts` (Collection interface, CollectionValidator)
- Verify: every consumer of `isActive` / `totalBurned` / `lastBurnTime` on a `Collection` value

- [ ] **Step 1: Find non-Collection consumers to leave alone**

```bash
grep -rn "isActive\|totalBurned\|lastBurnTime" /Users/kalamaha/dev/medialane-dapp/src --include="*.ts" --include="*.tsx" | grep -v "/ui/\|sidebar\|input-otp\|pagination"
```

Note any matches — these are the call sites Task 2 has to either remove or rewrite. UI-library matches (sidebar/pagination/input-otp use `isActive` for menu state) are unrelated and must be left alone.

- [ ] **Step 2: Update the Collection type**

Replace the field block in `src/lib/types.ts:22-48`:

```typescript
export interface Collection {
  id: string | bigint;
  name: string;
  description: string;
  image: string;
  nftAddress: string;
  owner: string;
  totalMinted: number;
  totalArchived: number;
  totalTransfers: number;
  lastMintTime: string;
  lastArchiveTime: string;
  lastTransferTime: string;
  itemCount: number;
  nftBalance?: number;
  totalSupply: number;
  ownerBalance?: number;
  baseUri: string;
  floorPrice?: number;
  symbol?: string;
  type?: string;
  visibility?: string;
  enableVersioning?: boolean;
  allowComments?: boolean;
  requireApproval?: boolean;
}
```

- [ ] **Step 3: Update `CollectionValidator.isValid` field list**

Replace the `requiredFields` array and validations block in `src/lib/types.ts:64-85`:

```typescript
const requiredFields = [
  'id', 'name', 'description', 'image', 'nftAddress',
  'owner', 'totalMinted', 'totalArchived',
  'totalTransfers', 'lastMintTime', 'lastArchiveTime',
  'lastTransferTime', 'itemCount', 'totalSupply', 'baseUri'
];

if (!requiredFields.every(field => field in collection)) {
  return false;
}

const validations = [
  typeof collection.name === 'string' && collection.name.trim() !== '',
  typeof collection.description === 'string',
  typeof collection.image === 'string',
  typeof collection.totalMinted === 'number' && collection.totalMinted >= 0,
  typeof collection.totalArchived === 'number' && collection.totalArchived >= 0,
  typeof collection.itemCount === 'number' && collection.itemCount >= 0,
];
```

- [ ] **Step 4: Update `CollectionValidator.normalize`**

Replace the body of `normalize()` in `src/lib/types.ts:93-121` (drop `isActive`, rename burned → archived):

```typescript
return {
  id: collection.id,
  name: String(collection.name || '').trim(),
  description: String(collection.description || ''),
  image: String(collection.image || '/placeholder.svg'),
  nftAddress: String(collection.nftAddress || ''),
  owner: String(collection.owner || ''),
  totalMinted: Number(collection.totalMinted) || 0,
  totalArchived: Number(collection.totalArchived ?? collection.totalBurned) || 0,
  totalTransfers: Number(collection.totalTransfers) || 0,
  lastMintTime: String(collection.lastMintTime || ''),
  lastArchiveTime: String(collection.lastArchiveTime ?? collection.lastBurnTime ?? ''),
  lastTransferTime: String(collection.lastTransferTime || ''),
  itemCount: Number(collection.itemCount) || 0,
  nftBalance: collection.nftBalance !== undefined ? Number(collection.nftBalance) : undefined,
  totalSupply: Number(collection.totalSupply) || 0,
  ownerBalance: collection.ownerBalance !== undefined ? Number(collection.ownerBalance) : undefined,
  baseUri: String(collection.baseUri || ''),
  floorPrice: collection.floorPrice !== undefined ? Number(collection.floorPrice) : undefined,
  symbol: collection.symbol ? String(collection.symbol) : undefined,
  type: collection.type ? String(collection.type) : undefined,
  visibility: collection.visibility ? String(collection.visibility) : undefined,
  enableVersioning: collection.enableVersioning !== undefined ? Boolean(collection.enableVersioning) : undefined,
  allowComments: collection.allowComments !== undefined ? Boolean(collection.allowComments) : undefined,
  requireApproval: collection.requireApproval !== undefined ? Boolean(collection.requireApproval) : undefined,
};
```

The `??` fallbacks let old persisted data still hydrate; new data uses the new names.

- [ ] **Step 5: Fix any consumers flagged by Step 1**

For each match from Step 1 that touches `Collection.isActive` / `Collection.totalBurned` / `Collection.lastBurnTime`: remove the reference (the field no longer exists) or rename to the archive variant. If the file is rendering a "Burned" stat, change the label to "Archived" and bind to `totalArchived`. Show the actual code change for each match here — do not write "fix similar to above".

(Agent: list each file from Step 1 output and write its exact diff inline before moving on.)

- [ ] **Step 6: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit
```

Expected: EXIT=0.

- [ ] **Step 7: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/lib/types.ts src
git commit -m "refactor: align Collection type with audited contract (drop is_active, burned→archived)"
```

---

## Task 3: Add `useFullTokenData` hook

**Why:** The audited `IPNft.get_full_token_data(token_id)` returns `(owner, metadata_uri, original_creator, registered_at)` in one call. Today the dapp makes 3–4 separate reads for the same data. This hook becomes the single source for asset-page reads.

**Files:**
- Create: `src/hooks/use-full-token-data.ts`
- Reads: `src/abis/ip_nft.ts` (`COLLECTION_NFT_ABI`)

- [ ] **Step 1: Create the hook**

Write `src/hooks/use-full-token-data.ts`:

```typescript
import { useReadContract } from "@starknet-react/core";
import { Abi, cairo, num } from "starknet";
import { COLLECTION_NFT_ABI } from "@/abis/ip_nft";

export interface FullTokenData {
  owner: string;
  metadataUri: string;
  originalCreator: string;
  registeredAt: number; // unix seconds
}

interface UseFullTokenDataArgs {
  ipNftAddress: string | undefined;
  tokenId: bigint | undefined;
}

export function useFullTokenData({ ipNftAddress, tokenId }: UseFullTokenDataArgs) {
  const enabled = Boolean(ipNftAddress && tokenId !== undefined);

  const { data, isLoading, error, refetch } = useReadContract({
    abi: COLLECTION_NFT_ABI as Abi,
    functionName: "get_full_token_data",
    address: enabled ? (ipNftAddress as `0x${string}`) : undefined,
    args: enabled && tokenId !== undefined ? [cairo.uint256(tokenId)] : undefined,
    watch: false,
  });

  if (!data) {
    return { data: null as FullTokenData | null, isLoading, error, refetch };
  }

  // Cairo tuple: (ContractAddress, ByteArray, ContractAddress, u64)
  const tuple = data as unknown as [bigint, string, bigint, bigint];
  const parsed: FullTokenData = {
    owner: num.toHex(tuple[0]),
    metadataUri: tuple[1],
    originalCreator: num.toHex(tuple[2]),
    registeredAt: Number(tuple[3]),
  };
  return { data: parsed, isLoading, error, refetch };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit
```

Expected: EXIT=0.

- [ ] **Step 3: Sanity-check decoding against a live token**

Open a quick Node REPL or temporary page to call the hook against a known minted token. Expected: `originalCreator` matches the address that called `mint`; `registeredAt` is a Unix timestamp in seconds within the last year. If `metadataUri` decodes as `[object Object]` or similar, the ByteArray decoding is wrong — fix decoder before committing.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/hooks/use-full-token-data.ts
git commit -m "feat: add useFullTokenData hook wrapping IPNft.get_full_token_data"
```

---

## Task 4: Surface `original_creator` + `registered_at` in the asset provenance tab

**Why:** This is the most user-visible benefit of the audit — an immutable legal authorship record. Today the dapp infers the creator from the earliest transfer event, which is heuristic. After the audit, the contract stores the creator immutably at mint time (Berne Convention compliance).

**Files:**
- Create: `src/components/asset/creation-record.tsx`
- Modify: `src/app/asset/[contract]/[tokenId]/asset-provenance-tab.tsx`

- [ ] **Step 1: Build the CreationRecord component**

Write `src/components/asset/creation-record.tsx`:

```typescript
"use client";

import { Award, ExternalLink } from "lucide-react";
import Link from "next/link";
import { EXPLORER_URL } from "@/lib/constants";
import { normalizeStarknetAddress } from "@/lib/utils";

interface CreationRecordProps {
  originalCreator: string;
  registeredAt: number; // unix seconds
}

export function CreationRecord({ originalCreator, registeredAt }: CreationRecordProps) {
  const creator = normalizeStarknetAddress(originalCreator);
  const date = new Date(registeredAt * 1000);
  const formatted = date.toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Award className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-semibold text-amber-500">Creation Record</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Immutable on-chain authorship record set at mint and stored permanently for legal evidence of creation (Berne Convention).
      </p>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Original creator</dt>
          <dd className="font-mono">
            <Link
              href={`/creator/${creator}`}
              className="hover:underline"
            >
              {creator.slice(0, 6)}…{creator.slice(-4)}
            </Link>
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Registered at</dt>
          <dd>
            <a
              href={`${EXPLORER_URL}/contract/${creator}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              {formatted}
              <ExternalLink className="h-3 w-3" />
            </a>
          </dd>
        </div>
      </dl>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the provenance tab**

Modify `src/app/asset/[contract]/[tokenId]/asset-provenance-tab.tsx`:

Add to the interface around line 23–28:

```typescript
interface AssetProvenanceTabProps {
  history: ApiActivity[];
  contract: string;
  tokenId: string;
  remixCount: number;
  originalCreator?: string;
  registeredAt?: number;
}
```

Update the function signature on line 30 to destructure the two new props.

Add this block immediately after the "Onchain attestation badge" `</div>` closing tag (around line 65, before the next section):

```tsx
{originalCreator && registeredAt ? (
  <CreationRecord originalCreator={originalCreator} registeredAt={registeredAt} />
) : null}
```

Add the import at the top of the file:

```typescript
import { CreationRecord } from "@/components/asset/creation-record";
```

- [ ] **Step 3: Pass the props from the asset page**

In each variant that renders the provenance tab (`asset-page-standard.tsx`, `asset-page-pop.tsx`, `asset-page-drop.tsx`, `asset-page-edition.tsx`), look for `<AssetProvenanceTab` and find or add a `useFullTokenData` call alongside the existing token reads. Pass `data?.originalCreator` and `data?.registeredAt` to the tab.

For `asset-page-standard.tsx` specifically — the most common case — add near the top of the component:

```typescript
import { useFullTokenData } from "@/hooks/use-full-token-data";
// ...
const { data: fullTokenData } = useFullTokenData({
  ipNftAddress: contract,
  tokenId: BigInt(tokenId),
});
```

And update the JSX:

```tsx
<AssetProvenanceTab
  history={history}
  contract={contract}
  tokenId={tokenId}
  remixCount={remixCount}
  originalCreator={fullTokenData?.originalCreator}
  registeredAt={fullTokenData?.registeredAt}
/>
```

Repeat exactly the same imports + hook call + prop pass in `asset-page-pop.tsx` and `asset-page-drop.tsx` (both ERC-721, both use the audited IPNft).

For `asset-page-edition.tsx` (ERC-1155): **do not** add the hook — the ERC-1155 collection contract does not implement `get_full_token_data`. Pass `originalCreator={undefined}` / `registeredAt={undefined}` so the new block hides itself.

- [ ] **Step 4: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit
```

Expected: EXIT=0.

- [ ] **Step 5: Manual browser smoke**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npm run dev
```

Open an asset minted on the new audited contract. Navigate to the Provenance tab. Confirm:
- "Creation Record" block renders with an amber border
- Creator address links to `/creator/<address>`
- Date is human-readable, not "Invalid Date" or a Unix integer
- Old (pre-audit) assets do not crash — the block is simply hidden

- [ ] **Step 6: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/asset/creation-record.tsx 'src/app/asset/[contract]/[tokenId]/'
git commit -m "feat(asset): show Berne Convention creation record from IPNft.get_full_token_data"
```

---

## Task 5: Build `ArchiveTokenDialog`

**Why:** The audited contract replaces `burn` with `archive`: archived tokens are non-transferable but the legal record persists. The current dapp has **no burn UI at all** (verified via grep), so this is net-new — a single dialog that calls `IPCollection.archive(token)` via the paymaster, with clear copy explaining the permanence.

**Files:**
- Create: `src/components/asset/archive-token-dialog.tsx`
- Reads: `src/abis/ip_collection.ts`, `src/hooks/use-paymaster-transaction.ts`

- [ ] **Step 1: Write the dialog**

Write `src/components/asset/archive-token-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Archive, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Contract } from "starknet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { COLLECTION_721_CONTRACT } from "@/lib/constants";
import { ipCollectionAbi } from "@/abis/ip_collection";
import { toast } from "sonner";

interface ArchiveTokenDialogProps {
  collectionId: string;
  tokenId: string;
  onArchived?: () => void;
}

export function ArchiveTokenDialog({ collectionId, tokenId, onArchived }: ArchiveTokenDialogProps) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { executeAuto } = usePaymasterTransaction();

  const handleArchive = async () => {
    if (!acknowledged) return;
    setSubmitting(true);
    try {
      const tokenKey = `${collectionId}:${tokenId}`;
      // Contract.populate serializes the Cairo ByteArray correctly.
      const contract = new Contract(ipCollectionAbi as any, COLLECTION_721_CONTRACT);
      const call = contract.populate("archive", [tokenKey]);
      await executeAuto([call]);
      toast.success("Token archived", {
        description: "The legal record is preserved on-chain forever.",
      });
      setOpen(false);
      onArchived?.();
    } catch (err) {
      toast.error("Archive failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Archive className="h-4 w-4" /> Archive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" /> Archive this token?
          </DialogTitle>
          <DialogDescription>
            Archiving is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p><strong>Archive is not burn.</strong> The token is not destroyed.</p>
            <p>After archiving:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li>The token can no longer be transferred or sold.</li>
              <li>The creator, mint date, and metadata stay readable on-chain forever (Berne Convention).</li>
              <li>This action cannot be reversed.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="archive-ack"
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
          />
          <Label htmlFor="archive-ack" className="text-sm">
            I understand this is permanent.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleArchive}
            disabled={!acknowledged || submitting}
          >
            {submitting ? "Archiving…" : "Archive token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Note on calldata: starknet.js v8's `byteArray.byteArrayFromString` returns `{ data, pending_word, pending_word_len }`. The Cairo ABI expects them in the order `data_len, ...data, pending_word, pending_word_len`. If `@starknet-react/core`'s contract auto-serialization handles this correctly when passing the result object as a single arg, replace the manual array build with `[ba]` — but verify against the actual on-chain tx, do not assume.

- [ ] **Step 2: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit
```

Expected: EXIT=0.

- [ ] **Step 3: Sanity-check the call**

Before exposing the dialog, log `console.log(JSON.stringify(call))` once on click. Expected shape: `{ contractAddress: "0x07c2207d…", entrypoint: "archive", calldata: ["<data_len>", …, "<pending_word>", "<pending_word_len>"] }`. The calldata length must equal `data_len + 3` (data_len felt + data felts + pending_word + pending_word_len). If it doesn't, the ABI typing isn't being picked up — recheck the `Contract` constructor and the imported ABI.

- [ ] **Step 4: Commit (component only, not yet wired)**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/asset/archive-token-dialog.tsx
git commit -m "feat: ArchiveTokenDialog component (replaces burn semantics)"
```

---

## Task 6: Wire `ArchiveTokenDialog` into the asset action menu (owner only)

**Files:**
- Modify: `src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx`

- [ ] **Step 1: Locate the owner-actions area**

In `asset-page-standard.tsx`, find the existing block that conditionally renders owner actions (likely keyed on `isOwner` or similar). The ArchiveTokenDialog must only show when `useWallet().address === fullTokenData.owner`.

- [ ] **Step 2: Add the dialog**

Add this within the owner-actions block, alongside the existing "List for sale" button:

```tsx
{isOwner && fullTokenData && (
  <ArchiveTokenDialog
    collectionId={collectionId}
    tokenId={tokenId}
    onArchived={() => refetchToken?.()}
  />
)}
```

And the import:

```typescript
import { ArchiveTokenDialog } from "@/components/asset/archive-token-dialog";
```

The `collectionId` value must be the on-chain numeric ID (decimal string, e.g. `"1"`). For tokens minted via the new contract, this comes from `ApiToken.collection?.collectionId`. If unavailable, do not render the dialog — show a tooltip "Archive not available for this token type" instead.

- [ ] **Step 3: Typecheck + browser smoke**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit && npm run dev
```

Test plan:
- Connect a wallet that owns a token minted via the new contract → "Archive" button appears
- Connect a different wallet on the same token → no Archive button
- Click Archive → dialog opens with the warning copy
- Cancel → dialog closes, no tx
- Acknowledge + confirm → paymaster pops, tx submits, toast shows
- Refresh page → token is now in archived state (transfer/list buttons disabled — covered in Task 8)

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add 'src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx'
git commit -m "feat(asset): expose archive action to token owners"
```

---

## Task 7: Add `useIsTransferable` hook

**Why:** Before signing a listing or offer, the dapp must check that the token isn't archived. The audited registry exposes `is_transferable_token(token) → bool`. Without this, users will sign orders that the contract rejects, wasting gas and confusing them.

**Files:**
- Create: `src/hooks/use-is-transferable.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useReadContract } from "@starknet-react/core";
import { Abi } from "starknet";
import { ipCollectionAbi } from "@/abis/ip_collection";
import { COLLECTION_721_CONTRACT } from "@/lib/constants";

interface UseIsTransferableArgs {
  collectionId: string | undefined;
  tokenId: string | undefined;
}

export function useIsTransferable({ collectionId, tokenId }: UseIsTransferableArgs) {
  const enabled = Boolean(collectionId && tokenId);
  const tokenKey = enabled ? `${collectionId}:${tokenId}` : undefined;

  const { data, isLoading, error, refetch } = useReadContract({
    abi: ipCollectionAbi as Abi,
    functionName: "is_transferable_token",
    address: COLLECTION_721_CONTRACT,
    args: tokenKey ? [tokenKey] : undefined,
    watch: false,
  });

  return {
    isTransferable: data === true || data === 1n,
    isLoading,
    error,
    refetch,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit
```

Expected: EXIT=0.

- [ ] **Step 3: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/hooks/use-is-transferable.ts
git commit -m "feat: useIsTransferable hook for pre-list/offer gating"
```

---

## Task 8: Gate listing & offer flows on `is_transferable_token`

**Files:**
- Modify: any component that opens the listing dialog (e.g. `src/components/marketplace/list-token-dialog.tsx` if it exists, or wherever the "List for sale" CTA lives in `asset-page-standard.tsx`)
- Modify: the corresponding offer dialog

- [ ] **Step 1: Locate the listing CTA**

```bash
grep -rn "register_order\|createListing\|List for sale" /Users/kalamaha/dev/medialane-dapp/src/components/marketplace /Users/kalamaha/dev/medialane-dapp/src/app/asset 2>/dev/null | head
```

The CTA component is the one that takes `collectionId` + `tokenId` and triggers the sign flow.

- [ ] **Step 2: Add the gate**

In the component that contains the "List for sale" button (and separately the "Make offer" button), wire in the hook and disable the action when not transferable:

```tsx
import { useIsTransferable } from "@/hooks/use-is-transferable";
// ...
const { isTransferable, isLoading: transferableLoading } =
  useIsTransferable({ collectionId, tokenId });

// In the button:
<Button
  onClick={openListDialog}
  disabled={transferableLoading || !isTransferable}
  title={!isTransferable ? "This token is archived and cannot be listed" : undefined}
>
  List for sale
</Button>
```

Repeat for the offer CTA.

For tokens not on the audited registry (external/legacy collections), the hook will return undefined / errored — the gate must **default to allowing** the action in that case (only block when we explicitly know the token is archived). Implement this as:

```typescript
const blocked = isTransferable === false; // not !isTransferable — undefined is treated as allowed
```

- [ ] **Step 3: Typecheck + browser smoke**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit && npm run dev
```

Test plan:
- Open a token that you just archived in Task 6 → List/Offer buttons are disabled with the tooltip
- Open a normal token on the new contract → buttons enabled
- Open an external/legacy collection token → buttons enabled (no spurious blocking)

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src
git commit -m "feat(marketplace): gate listing & offer on is_transferable_token"
```

---

## Task 9: Build `TransferCollectionOwnershipDialog`

**Why:** The audited contract replaces the global `Ownable` admin with `transfer_collection_ownership(collection_id, new_owner)` — each collection has its own owner who can hand it off without touching other collections. Creators expect this in their dashboard.

**Files:**
- Create: `src/components/collection/transfer-ownership-dialog.tsx`

- [ ] **Step 1: Write the component**

```typescript
"use client";

import { useState } from "react";
import { UserRoundCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Contract, cairo } from "starknet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { ipCollectionAbi } from "@/abis/ip_collection";
import { COLLECTION_721_CONTRACT } from "@/lib/constants";
import { normalizeStarknetAddress } from "@/lib/utils";
import { toast } from "sonner";

interface TransferOwnershipDialogProps {
  collectionId: string;
  currentOwner: string;
  onTransferred?: () => void;
}

export function TransferCollectionOwnershipDialog({
  collectionId, currentOwner, onTransferred,
}: TransferOwnershipDialogProps) {
  const [open, setOpen] = useState(false);
  const [newOwner, setNewOwner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { executeAuto } = usePaymasterTransaction();

  const isValid = /^0x[0-9a-fA-F]{1,64}$/.test(newOwner.trim());
  const wouldNoop = isValid &&
    normalizeStarknetAddress(newOwner) === normalizeStarknetAddress(currentOwner);

  const handleTransfer = async () => {
    if (!isValid || wouldNoop) return;
    setSubmitting(true);
    try {
      const contract = new Contract(ipCollectionAbi as any, COLLECTION_721_CONTRACT);
      const call = contract.populate("transfer_collection_ownership", [
        cairo.uint256(BigInt(collectionId)),
        newOwner.trim(),
      ]);
      await executeAuto([call]);
      toast.success("Collection ownership transferred", {
        description: `New owner: ${newOwner.slice(0, 6)}…${newOwner.slice(-4)}`,
      });
      setOpen(false);
      setNewOwner("");
      onTransferred?.();
    } catch (err) {
      toast.error("Transfer failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserRoundCog className="h-4 w-4" /> Transfer ownership
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer collection ownership</DialogTitle>
          <DialogDescription>
            The new owner will control minting and future ownership transfers for this collection. Existing tokens are unaffected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-owner">New owner address</Label>
          <Input
            id="new-owner"
            placeholder="0x…"
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            className="font-mono text-sm"
          />
          {newOwner && !isValid && (
            <p className="text-xs text-red-500">Not a valid Starknet address.</p>
          )}
          {wouldNoop && (
            <p className="text-xs text-amber-500">This is already the current owner.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!isValid || wouldNoop || submitting}>
            {submitting ? "Transferring…" : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire into the collection settings UI**

Find the collection settings page for owners (likely under `src/app/collection/[slug]/` or `src/app/creator/[address]/` — confirm with a grep for the existing "Edit collection" CTA):

```bash
grep -rn "Edit collection\|collection settings\|isOwner" /Users/kalamaha/dev/medialane-dapp/src/app/collection /Users/kalamaha/dev/medialane-dapp/src/app/creator 2>/dev/null | head
```

In the file that gates owner-only actions, render the dialog alongside the existing edit affordance:

```tsx
import { TransferCollectionOwnershipDialog } from "@/components/collection/transfer-ownership-dialog";
// ...
{isOwner && collection.collectionId && (
  <TransferCollectionOwnershipDialog
    collectionId={collection.collectionId}
    currentOwner={collection.owner}
    onTransferred={() => mutateCollection?.()}
  />
)}
```

If the collection was minted on the legacy registry (no `collectionId` available), do not render the dialog — the legacy registry uses global Ownable and is out of scope here.

- [ ] **Step 3: Typecheck + browser smoke**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit && npm run dev
```

Test plan:
- As collection owner: button appears in settings, accepts a valid address, rejects invalid input, rejects current owner
- Confirm tx → backend `CollectionOwnershipTransferred` event indexes (check `/v1/collections/:contract` returns the new `owner` after ~10s)
- Non-owner: button does not render

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/components/collection 'src/app/collection/[slug]/'
git commit -m "feat(collection): transfer_collection_ownership UI for owners"
```

---

## Task 10: Refactor existing reads to use `useFullTokenData`

**Why:** Today the asset page often calls `owner_of` + `token_uri` + (heuristic creator) separately. With `useFullTokenData` from Task 3 in place, collapse them into one read.

**Files:**
- Modify: `src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx`
- Modify: `src/hooks/use-asset.ts` (only if it makes multiple reads against the per-collection IPNft)

- [ ] **Step 1: Identify duplicate reads**

```bash
grep -n "owner_of\|tokenURI\|token_uri" /Users/kalamaha/dev/medialane-dapp/src/hooks/use-asset.ts 'src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx'
```

For each duplicate read against the **per-collection IPNft contract** (not the registry), replace with `useFullTokenData` and pull fields from `data?.owner` / `data?.metadataUri`. Do not touch reads that go to other contracts (marketplace, registry).

If `use-asset.ts` already pulls the same data from the indexed backend API rather than the chain — leave it alone. Memory: the dapp's primary read path is the backend API; on-chain reads are only for approvals + nonces. So this refactor may be a no-op if the asset page is already API-driven.

- [ ] **Step 2: Apply the refactor**

For each duplicate, replace the three separate `useReadContract` calls with a single `useFullTokenData` call. Show every diff inline.

- [ ] **Step 3: Typecheck + browser smoke**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit && npm run dev
```

Confirm the asset page still renders correctly. Open the network tab — RPC call count to the IPNft contract should drop.

- [ ] **Step 4: Commit (skip if no-op)**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add 'src/app/asset/[contract]/[tokenId]/' src/hooks
git commit -m "perf(asset): consolidate IPNft reads into get_full_token_data"
```

---

## Task 11: Save project memory for the audit milestone

Not strictly code, but a recorded fact for future sessions.

- [ ] **Step 1: Write the memory file**

Create `/Users/kalamaha/.claude/projects/-Users-kalamaha-dev/memory/project_mip_audit_v3.md`:

```markdown
---
name: mip-collections-v3-audited
description: Audited MIP-Collections-ERC721 mainnet rollout (2026-05-14) — addresses, class hashes, breaking changes, dapp migration plan reference
metadata:
  type: project
---

The audited MIP-Collections-ERC721 deployed to Starknet mainnet on 2026-05-14, replacing the v2 contract.

**Mainnet addresses:**
- IPCollection registry: `0x07c2207d200a1dce1cc82a117d8ba91dabfe3d1cc5072d9e4cdd9654fbb0ff10`
- IPCollection class hash: `0x00203f0e03a472cb6e058327ca22147c75e574cc2876f4981e99bcbcbe716a29`
- IPNft class hash: `0x02d50b7e6d1a14f17a8fdc2df24d6e493bae6fae579656d81959b8c92de4b13f`
- Previous v2 (legacy, read-only): `0x05c49ee5d3208a2c2e150fdd0c247d1195ed9ab54fa2d5dea7a633f39e4b205b`

**Why:** The audit replaced `burn` with `archive` (non-destructive, Berne Convention compliance), dropped global Ownable in favour of per-collection `transfer_collection_ownership`, removed `is_active` from `Collection`, and added `original_creator` + `registered_at` immutable fields on `TokenData`. `IPNft.get_full_token_data` returns owner+uri+creator+timestamp in one call.

**How to apply:** New mints go only to the new contract. Old tokens at the legacy address remain readable via the indexer (backend handles multi-source collections natively). When working in dapp/sdk/backend, the audited ABI is in `medialane-dapp/src/abis/ip_collection.ts` and `medialane-sdk/src/abis.ts`. Cartridge session policies include `archive` + `batch_archive` + `transfer_collection_ownership` (`starkzap-wallet-context.tsx`).

**Migration plan:** `medialane-dapp/docs/superpowers/plans/2026-05-14-mip-collections-v3-migration.md`.
```

- [ ] **Step 2: Update MEMORY.md index**

Append to `/Users/kalamaha/.claude/projects/-Users-kalamaha-dev/memory/MEMORY.md`:

```markdown
- [MIP Collections v3 Audit](project_mip_audit_v3.md) — Audited mainnet addresses, class hashes, breaking changes, dapp migration plan reference
```

- [ ] **Step 3: No commit** — memory lives outside the repos.

---

## Task 12: Full build + production smoke

- [ ] **Step 1: Run the full dapp build**

Memory: never filter the build output with grep. Read all of it.

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit
cd /Users/kalamaha/dev/medialane-dapp && bun run build
```

Both must complete cleanly. Investigate any new warning that wasn't in the baseline.

- [ ] **Step 2: SDK build**

```bash
cd /Users/kalamaha/dev/medialane-sdk && ~/.nvm/versions/node/v24.15.0/bin/bun run build
```

Confirm dist/ updates and there are no new errors.

- [ ] **Step 3: Manual end-to-end on staging or prod-clone**

Test plan checklist:
- [ ] Create a new collection on the new audited contract → indexed in backend within ~10s
- [ ] Mint a token into it → `CreationRecord` block shows on asset page
- [ ] List the token for sale → succeeds, indexed within ~10s
- [ ] Archive a different token → list & offer buttons grey out on its asset page
- [ ] Try to list the archived token → blocked by gate, no signature requested
- [ ] Transfer collection ownership to a second wallet → second wallet can now mint; original cannot

- [ ] **Step 4: Open PRs**

One PR per repo touched (dapp, sdk if regenerated, backend if env defaults changed). Reference the plan file in each PR description.

---

## Out of scope (deferred)

These were considered and deliberately deferred — do not silently add them:

- Re-introducing the legacy v2 contract as a read-only source in the dapp constants. The backend handles multi-source collections; the dapp doesn't need to know.
- Building a UI to view archived tokens as a separate gallery. The CreationRecord block + disabled actions on the asset page communicate state sufficiently for now.
- Migrating existing legacy tokens to the new contract. Out of protocol scope and impossible without coordination with token holders.
- Surfacing `CollectionStats` (total_archived, last_archive_time) anywhere — no current UI consumes them.
