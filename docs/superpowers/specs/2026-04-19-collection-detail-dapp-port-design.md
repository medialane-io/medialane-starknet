# Collection Detail Page Dapp Port — Design Spec

## Goal

Bring `medialane-dapp`'s `/collections/[contract]` page to full feature parity with `medialane-io`, which is the source of truth. No new features — faithful port only, with one deliberate skip.

## Architecture

Three files changed, one created. All required UI components (ListingDialog, TransferDialog, CancelOrderDialog, ShareButton, PopClaimButton) already exist in the dapp. The only genuinely new code is `checkIsOwner` utility, `CollectionServiceAction` coordinator, and the upgraded `CollectionItems`/`CollectionPageClient` render logic.

**Tech Stack:** Next.js 15 App Router · SWR · framer-motion · shadcn Tabs · Tailwind CSS · lucide-react

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/lib/utils.ts` | Add `checkIsOwner` utility |
| Create | `src/components/services/collection-service-action.tsx` | Source-to-action coordinator (POP only) |
| Rewrite | `src/app/collections/[contract]/collection-page-client.tsx` | Full io feature set |

---

## `checkIsOwner` (`src/lib/utils.ts`)

Copied from io's utils. Checks `token.balances` array first (ERC-1155 / TokenBalance model), falls back to legacy `token.owner` string field.

```typescript
export function checkIsOwner(
  token: { owner?: string | null; balances?: Array<{ owner: string; amount: string }> | null } | null | undefined,
  walletAddress: string | null | undefined
): boolean {
  if (!token || !walletAddress) return false;
  if (token.balances != null && token.balances.length > 0) {
    return token.balances.some(
      (b) => b.owner.toLowerCase() === walletAddress.toLowerCase() && Number(b.amount) > 0
    );
  }
  return !!(token.owner && token.owner.toLowerCase() === walletAddress.toLowerCase());
}
```

---

## `CollectionServiceAction` (`src/components/services/collection-service-action.tsx`)

Coordinator that maps `collection.source` to the appropriate action button. Dapp version handles `POP_PROTOCOL` only (renders `PopClaimButton`). `COLLECTION_DROP` returns null — `CollectionDropMintButton` not yet built. All other sources return null.

```typescript
export function CollectionServiceAction({ source, contractAddress }) {
  if (source === "POP_PROTOCOL") return <PopClaimButton collectionAddress={contractAddress} />;
  return null;
}
```

---

## Page Client (`collection-page-client.tsx`)

### `CollectionItems` sub-component

New props: `activeListings: ApiOrder[]` passed from parent. Builds `listingByTokenId` map via `useMemo` to enrich tokens with listing data so listed items show Buy button in the Items grid.

Ownership detection:
- Calls `useSessionKey()` for `walletAddress`
- ERC-1155 guard: `collection?.standard === "ERC1155"` → `isOwner = false` (no per-holder balances in list responses; holders manage from Portfolio)
- ERC-721: `checkIsOwner(token, walletAddress)`

Owner dialogs (already in dapp): `ListingDialog`, `TransferDialog`, `CancelOrderDialog` — same pattern as portfolio assets grid. Each opens via `onList`/`onTransfer`/`onCancel` callbacks passed to `TokenCard`.

### `CollectionPageClient` additions

- `useSessionKey()` → `walletAddress` (for ownership checks + ERC-1155 mint button)
- `useCollectionProfile(contract)` → `profile` (removed — dapp skips Exclusive tab; the hook exists in dapp but gated content is Clerk-only)
- `parsePriceDisplay` + `CurrencyIcon` — currency-aware stat chip rendering for floor/volume. Stat chips for Items/Holders remain plain text; Floor/Volume show currency icon + symbol.
- `CollectionServiceAction` rendered in meta section
- `ShareButton` added to address row
- ERC-1155 listings filter: `activeListings` includes both `ERC721` and `ERC1155` item types (io fix)
- "Mint editions" button: shown only when `collection.source === "ERC1155_FACTORY"` and `walletAddress === collection.owner`

### Deliberate skip — Exclusive tab

`useGatedContent` requires `useAuth` from Clerk — incompatible with dapp's permissionless constraint (no Clerk, no auth). The Exclusive tab and `GatedContentPanel` are omitted. `useCollectionProfile` is also skipped since its only use here is gating the Exclusive tab.

### `ParallaxBanner`

Dapp's existing gradient fallback (contract-address-derived colors) is kept — it's a better UX than io's plain muted bg, and keeping it is not a new feature.

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Collection not found | SWR returns null → page renders loading skeleton indefinitely (existing behavior) |
| Orders fetch fails | SWR error → sonner toast via global handler |
| Token fetch fails | SWR error → sonner toast |
| Ownership check with no wallet | `checkIsOwner` returns false → owner actions hidden |
