# Claim/Mint Success Dialogs — Design

**Date:** 2026-06-08
**Branch:** `feat/claim-success-dialogs`

## Problem

medialane-dapp's create and trade flows already show rich success/error **dialogs**
(`MintProgressDialog`, `CollectionProgressDialog`, and inline `MarketplaceSuccessState`
in every marketplace dialog). But a few on-chain write surfaces still confirm completion
with only a `toast.success`, which is a weaker UX than the success-dialog pattern used
across the rest of the app and in medialane-io.

An audit of every on-chain write surface in the dapp found exactly these gaps:

| Surface | Today | Target |
|---|---|---|
| `collection-drop-mint-button.tsx` (Collection Drop claim) | `toast.success` | success dialog |
| `pop-claim-button.tsx` (POP credential claim) | `toast.success` | success dialog |
| `approve-mint-sheet.tsx` (remix approval mint) | `toast.success` | success dialog |
| `transfer-ownership-dialog.tsx` (collection ownership transfer) | `toast.success` + dialog closes | inline success state |
| `use-transfer.ts` | redundant `toast.success` (dialog already shows inline success) | remove toast |

Everything else already has a proper terminal success surface and is **out of scope**:
create asset/collection/remix, nft-editions create/mint, purchase/list/offer/accept/
counter/transfer/cancel dialogs, drop/create + pop/create (inline page success),
launch-mint, genesis-mint, comments-section. The drop/pop `manage` page toasts and
the create-page "Image uploaded to IPFS" progress toasts are intentionally left as
toasts (frequent lightweight admin actions / mid-flow progress, not completion events).

## Approach

Extract one small shared `TransactionResultDialog` (Dialog + success/error branch),
built on the existing `MarketplaceSuccessState` / `MarketplaceErrorState` primitives,
and use it in the two claim/mint **buttons** that have no dialog container of their own.
medialane-io already has an equivalent shared wrapper (`TransactionDialogStates`); the
dapp has the primitives but no wrapper, so this is the "improve the code you're touching"
move rather than copy-pasting the same Dialog boilerplate at each callsite.

Surfaces that **already own a container** (a `Dialog` or `Sheet`) reuse the
`MarketplaceSuccessState` primitive directly inside that container rather than stacking a
second dialog on top — that applies to `transfer-ownership-dialog` and `approve-mint-sheet`.

Rejected alternatives:
- **Inline per-surface** (io's claim-button pattern, copy-pasted): works, but duplicates
  the Dialog scaffolding 3–4×.
- **`useTxResultDialog()` hook + component**: more machinery than 3 callsites justify (YAGNI).

## Component

`src/components/marketplace/transaction-result-dialog.tsx`

```tsx
export type TxResult =
  | { status: "success"; title: string; description: ReactNode;
      txHash?: string | null; tokenImage?: string | null; name?: string }
  | { status: "error"; title: string; description: ReactNode; error?: string | null;
      txHash?: string | null; tokenImage?: string | null; name?: string; onRetry?: () => void };

interface TransactionResultDialogProps {
  result: TxResult | null;
  onClose: () => void;          // clears result → closes dialog (wired to onDone/onRetry)
  confettiOnSuccess?: boolean;  // default true
  footer?: ReactNode;           // optional, e.g. "View asset" / "View portfolio" link
}
```

Behavior:
- Renders `<Dialog open={!!result} onOpenChange={(o) => { if (!o) onClose() }}>` with the
  same `DialogContent` shell used by io's claim buttons (`max-w-[calc(100%-6px)] sm:max-w-md
  p-0 overflow-hidden gap-0 rounded-2xl`) and sr-only `DialogTitle` / `DialogDescription`.
- `status === "success"` → `MarketplaceSuccessState` (props: `tokenImage`, `name`, `title`,
  `description`, `txHash`, `explorerUrl={EXPLORER_URL}`, `onDone={onClose}`, `footer`).
- `status === "error"` → `MarketplaceErrorState` (adds `error`, optional `onRetry`).
- Fires `fireConfetti()` (from `@/lib/confetti`) exactly once when a success result first
  appears and `confettiOnSuccess !== false`, guarded by a ref so re-renders don't re-fire.
- `EXPLORER_URL` is imported internally so callsites never pass it.

## Integrations

1. **`collection-drop-mint-button.tsx`** (no container → `TransactionResultDialog`) — capture the
   `executeAuto` hash, swap `toast.success`/`toast.error` for `setResult({...})`, render the dialog.
   **Caveat:** the component has early `return`s and `mutate()` flips it to a "Minted" early-return
   on success — collapse the branches into a `content` node and render the dialog at the component
   root so it survives the status flip. Keep the pre-flight wallet-guard toast.
2. **`pop-claim-button.tsx`** (no container → `TransactionResultDialog`) — same `content`-node + root
   dialog pattern (more early returns). Keep the pre-flight wallet-guard toast.
3. **`approve-mint-sheet.tsx`** (already has a `Sheet` + bespoke inline success panel) — replace the
   bespoke `done` panel with `MarketplaceSuccessState` inside the sheet, fire `fireConfetti()` on
   success, and **remove the now-redundant `toast.success`**. Keep `toast.error` (no inline error state).
4. **`transfer-ownership-dialog.tsx`** (already owns a `Dialog`) — add a `done` flag; on success render
   `MarketplaceSuccessState` in place of the form body. Remove `toast.success`. Keep `toast.error`.
5. **`use-transfer.ts`** — remove the redundant `toast.success("Transfer complete!")`;
   `transfer-dialog.tsx` already renders `MarketplaceSuccessState` inline. **Keep `toast.error`** —
   confirmed `transfer-dialog` falls back to the form (not an error state) when `error` is set, so the
   hook's toast is the only error surface.

## Verification

- `tsc --noEmit` clean.
- Full `bun run build` clean (per the build-before-push rule; no output filtering).
- No test runner in the dapp — the 5 surfaces are verified in the browser manually.
- Confirm no double-notification remains on transfer (dialog success state only, no toast).
