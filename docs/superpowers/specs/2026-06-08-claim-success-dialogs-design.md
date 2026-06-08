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
and use it in the three claim/mint surfaces. medialane-io already has an equivalent
shared wrapper (`TransactionDialogStates`); the dapp has the primitives but no wrapper,
so this is the "improve the code you're touching" move rather than copy-pasting the same
Dialog boilerplate at each callsite.

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

1. **`collection-drop-mint-button.tsx`** — add `const [result, setResult] = useState<TxResult | null>(null)`.
   Replace `toast.success("Minted! …")` with
   `setResult({ status: "success", title: "Minted!", description: "Your drop token is on-chain.", txHash, tokenImage: <drop cover>, name: <drop name> })`
   and the catch's `toast.error(...)` with `setResult({ status: "error", title: "Mint failed", description: …, error: msg })`.
   Mount `<TransactionResultDialog result={result} onClose={() => setResult(null)} />`.
   Keep the pre-flight `toast.error("Connect your wallet first")` (guard, not a tx result).

2. **`pop-claim-button.tsx`** — same pattern; success copy "Credential claimed!" /
   "Your proof of participation is on-chain." Keep the pre-flight wallet guard toast.

3. **`approve-mint-sheet.tsx`** — on success, close the sheet and surface the result dialog
   ("Remix minted!" / "Buyer has been notified."). The error path likewise routes to the
   dialog. Confetti optional here (default on is fine).

4. **`transfer-ownership-dialog.tsx`** — already owns a `Dialog`. Replace the
   `toast.success(...) + setOpen(false)` success path with a local success flag and render
   `MarketplaceSuccessState` **directly** in place of the form body (no second dialog —
   reuse the primitive). "Ownership transferred" / new owner address in the description.
   `Done` button closes the dialog. Keep `toast.error` for the failure path or render the
   inline error — implementation picks whichever reads cleaner in this dialog.

5. **`use-transfer.ts`** — remove the redundant `toast.success("Transfer complete!")`
   (line ~107); `transfer-dialog.tsx` already renders `MarketplaceSuccessState` inline from
   the same hook, so the toast is a duplicate notification. Leave `toast.error` unless
   implementation confirms `transfer-dialog` already surfaces the error inline (in which
   case remove it too, to match).

## Verification

- `tsc --noEmit` clean.
- Full `bun run build` clean (per the build-before-push rule; no output filtering).
- No test runner in the dapp — the 5 surfaces are verified in the browser manually.
- Confirm no double-notification remains on transfer (dialog success state only, no toast).
