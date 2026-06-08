# Claim/Mint Success Dialogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the dapp's three toast-only claim/mint surfaces (and two redundant-toast surfaces) up to the success-dialog UX used everywhere else in the dapp and in medialane-io.

**Architecture:** Add one shared `TransactionResultDialog` (a `Dialog` wrapper over the existing `MarketplaceSuccessState` / `MarketplaceErrorState` primitives) for surfaces with no container of their own; reuse `MarketplaceSuccessState` directly inside surfaces that already own a `Dialog`/`Sheet`. Remove duplicate success toasts where an inline success state already exists.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui `Dialog`, `sonner`, `@/lib/confetti`. No test runner — verification is `npx tsc --noEmit` + `npm run build` + manual browser checks.

**Spec:** `docs/superpowers/specs/2026-06-08-claim-success-dialogs-design.md`

**Branch:** `feat/claim-success-dialogs` (already created).

---

## Reference: existing primitive signatures (do not change)

From `src/components/marketplace/marketplace-dialog-primitives.tsx`:

```tsx
function MarketplaceSuccessState(props: {
  tokenImage?: string | null; name: string; title: string; description: ReactNode;
  txHash?: string | null; explorerUrl: string; onDone: () => void; footer?: ReactNode;
}): JSX.Element

function MarketplaceErrorState(props: {
  tokenImage?: string | null; name: string; title: string; description: ReactNode;
  error?: string | null; txHash?: string | null; explorerUrl: string;
  onRetry?: () => void; onDone: () => void; doneLabel?: string;
}): JSX.Element
```

- `EXPLORER_URL` is exported from `@/lib/constants`.
- `fireConfetti()` (no args) is exported from `@/lib/confetti`.
- `usePaymasterTransaction().executeAuto(calls)` returns `Promise<string | null>` (the tx hash, or `null`; throws on revert).

---

### Task 1: Create the shared `TransactionResultDialog`

**Files:**
- Create: `src/components/marketplace/transaction-result-dialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MarketplaceSuccessState,
  MarketplaceErrorState,
} from "@/components/marketplace/marketplace-dialog-primitives";
import { EXPLORER_URL } from "@/lib/constants";
import { fireConfetti } from "@/lib/confetti";

/**
 * Terminal-state dialog for one-shot write flows (claims, mints) that don't
 * already render their result inside a dialog/sheet of their own. Wraps the
 * shared MarketplaceSuccessState / MarketplaceErrorState primitives in a Dialog
 * and wires EXPLORER_URL + success confetti so callsites stay tiny.
 */
export type TxResult =
  | {
      status: "success";
      title: string;
      description: ReactNode;
      txHash?: string | null;
      tokenImage?: string | null;
      name?: string;
    }
  | {
      status: "error";
      title: string;
      description: ReactNode;
      error?: string | null;
      txHash?: string | null;
      tokenImage?: string | null;
      name?: string;
      onRetry?: () => void;
    };

interface TransactionResultDialogProps {
  result: TxResult | null;
  /** Clears the result → closes the dialog. Wired to onDone (and onRetry's reset). */
  onClose: () => void;
  /** Fire confetti when a success result first appears. Default true. */
  confettiOnSuccess?: boolean;
  /** Optional extra node rendered under the success Done button (e.g. a link). */
  footer?: ReactNode;
}

export function TransactionResultDialog({
  result,
  onClose,
  confettiOnSuccess = true,
  footer,
}: TransactionResultDialogProps) {
  const confettiFired = useRef(false);

  useEffect(() => {
    if (result?.status === "success" && confettiOnSuccess && !confettiFired.current) {
      confettiFired.current = true;
      fireConfetti();
    }
    if (!result) confettiFired.current = false;
  }, [result, confettiOnSuccess]);

  return (
    <Dialog open={!!result} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-6px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl">
        <DialogTitle className="sr-only">
          {result?.status === "error" ? "Transaction failed" : "Transaction complete"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {typeof result?.title === "string" ? result.title : "Transaction result"}
        </DialogDescription>
        {result?.status === "success" ? (
          <MarketplaceSuccessState
            tokenImage={result.tokenImage}
            name={result.name ?? "Asset"}
            title={result.title}
            description={result.description}
            txHash={result.txHash}
            explorerUrl={EXPLORER_URL}
            onDone={onClose}
            footer={footer}
          />
        ) : result?.status === "error" ? (
          <MarketplaceErrorState
            tokenImage={result.tokenImage}
            name={result.name ?? "Asset"}
            title={result.title}
            description={result.description}
            error={result.error}
            txHash={result.txHash}
            explorerUrl={EXPLORER_URL}
            onRetry={result.onRetry}
            onDone={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (no new errors referencing `transaction-result-dialog.tsx`).

- [ ] **Step 3: Commit**

```bash
git add src/components/marketplace/transaction-result-dialog.tsx
git commit -m "feat: shared TransactionResultDialog for claim/mint flows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire `collection-drop-mint-button` to the result dialog

**Files:**
- Modify: `src/components/claim/collection-drop-mint-button.tsx`

The component currently has early `return`s for not-connected / loading / already-minted, with the mint `<Button>` as the final return. After a successful mint, `mutate()` flips `mintStatus.mintedByWallet > 0`, hitting the "Minted" early-return — which would unmount a dialog placed only in that final return. So collapse the four UI branches into a `content` node and render the dialog at the component root.

- [ ] **Step 1: Add imports + result state**

Add to the import block (after the existing `ConnectWallet` import on line 12):

```tsx
import { useState, type ReactNode } from "react";
import { TransactionResultDialog, type TxResult } from "@/components/marketplace/transaction-result-dialog";
```

…and replace the existing `import { useState } from "react";` (line 3) — remove it, since `useState` now comes from the line above. (Net: line 3's `import { useState } from "react";` is deleted; `useState` + `ReactNode` are imported on the new line.)

Inside the component body, after the `const { executeAuto, isLoading: isProcessing } = usePaymasterTransaction();` line, add:

```tsx
  const [result, setResult] = useState<TxResult | null>(null);
```

- [ ] **Step 2: Set result instead of toasting in `handleMint`**

Replace these lines in `handleMint`:

```tsx
      await executeAuto(calls);
      toast.success("Minted! Your drop token is on-chain.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mint failed");
    }
```

with:

```tsx
      const hash = await executeAuto(calls);
      setResult({
        status: "success",
        title: "Minted!",
        description: "Your drop token is on-chain.",
        txHash: hash,
        name: "Drop token",
      });
      mutate();
    } catch (err) {
      setResult({
        status: "error",
        title: "Mint failed",
        description: "Something went wrong while minting.",
        error: err instanceof Error ? err.message : "Mint failed",
        onRetry: () => { setResult(null); void handleMint(); },
      });
    }
```

(Keep the pre-flight `toast.error("Connect your wallet first")` guard at the top of `handleMint` unchanged.)

- [ ] **Step 3: Collapse early returns into a `content` node + render dialog at root**

Replace the entire block from `if (!isConnected) {` (line ~106) through the final `);` of the component with:

```tsx
  let content: ReactNode;
  if (!isConnected) {
    content = <ConnectWallet label="Connect wallet to mint" className="w-full" />;
  } else if (isLoading) {
    content = (
      <Button variant="outline" size="sm" disabled className="w-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        Loading…
      </Button>
    );
  } else if (mintStatus && mintStatus.mintedByWallet > 0) {
    content = (
      <div className="flex items-center gap-1.5 text-sm text-orange-500 font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Minted · {mintStatus.mintedByWallet} token{mintStatus.mintedByWallet !== 1 ? "s" : ""}
      </div>
    );
  } else {
    content = (
      <Button
        size="lg"
        className="w-full gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
        onClick={handleMint}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Minting…
          </>
        ) : (
          <>
            <Package className="h-4 w-4" />
            {priceDisplay ? `Mint for ${priceDisplay}` : "Mint free"}
          </>
        )}
      </Button>
    );
  }

  return (
    <>
      {content}
      <TransactionResultDialog result={result} onClose={() => setResult(null)} />
    </>
  );
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (If `toast` is now unused in this file, remove the `import { toast } from "sonner";` line — but it is still used by the pre-flight guard, so it should stay.)

- [ ] **Step 5: Commit**

```bash
git add src/components/claim/collection-drop-mint-button.tsx
git commit -m "feat: drop-claim success dialog (replaces toast)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire `pop-claim-button` to the result dialog

**Files:**
- Modify: `src/components/claim/pop-claim-button.tsx`

Same pattern as Task 2. This component has more early returns (not-connected / loading / hook-error / claimed / not-eligible / default button) — collapse them into a `content` node and render the dialog at root.

- [ ] **Step 1: Add imports + result state**

Add after the existing imports:

```tsx
import { useState, type ReactNode } from "react";
import { TransactionResultDialog, type TxResult } from "@/components/marketplace/transaction-result-dialog";
```

Inside the component, after `const { executeAuto, isLoading: isTxLoading } = usePaymasterTransaction();` add:

```tsx
  const [result, setResult] = useState<TxResult | null>(null);
```

- [ ] **Step 2: Set result instead of toasting in `handleClaim`**

Replace:

```tsx
  const handleClaim = async () => {
    try {
      await executeAuto([
        { contractAddress: collectionAddress, entrypoint: "claim", calldata: [] },
      ]);
      toast.success("Credential claimed! Your proof of participation is on-chain.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Claim failed");
    }
  };
```

with:

```tsx
  const handleClaim = async () => {
    try {
      const hash = await executeAuto([
        { contractAddress: collectionAddress, entrypoint: "claim", calldata: [] },
      ]);
      setResult({
        status: "success",
        title: "Credential claimed!",
        description: "Your proof of participation is on-chain.",
        txHash: hash,
        name: "Credential",
      });
      mutate();
    } catch (err) {
      setResult({
        status: "error",
        title: "Claim failed",
        description: "Something went wrong while claiming.",
        error: err instanceof Error ? err.message : "Claim failed",
        onRetry: () => { setResult(null); void handleClaim(); },
      });
    }
  };
```

- [ ] **Step 3: Collapse early returns into a `content` node + render dialog at root**

Move the `handleClaim` definition above the branch logic (it must be declared before the `content` assignment that references it). Then replace the early-return chain (`if (!isConnected) … return …` through the final default `return <Button …>`) with:

```tsx
  let content: ReactNode;
  if (!isConnected) {
    content = <ConnectWallet />;
  } else if (isLoading) {
    content = (
      <Button variant="outline" size="sm" disabled className="w-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        Checking eligibility…
      </Button>
    );
  } else if (error) {
    content = (
      <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-1.5" onClick={() => mutate()}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    );
  } else if (claimStatus?.hasClaimed) {
    content = (
      <div className="flex items-center gap-1.5 text-sm text-green-500 font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Claimed{claimStatus.tokenId ? ` · #${claimStatus.tokenId}` : ""}
      </div>
    );
  } else if (claimStatus && !claimStatus.isEligible) {
    content = (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Ban className="h-3.5 w-3.5 shrink-0" />
        Not eligible
      </div>
    );
  } else {
    content = (
      <Button size="sm" className="w-full gap-1.5" onClick={handleClaim} disabled={isTxLoading}>
        {isTxLoading ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" />Claiming…</>
        ) : (
          <><Award className="h-3.5 w-3.5" />Claim credential</>
        )}
      </Button>
    );
  }

  return (
    <>
      {content}
      <TransactionResultDialog result={result} onClose={() => setResult(null)} />
    </>
  );
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. `toast` is no longer used in this file — remove `import { toast } from "sonner";`.

- [ ] **Step 5: Commit**

```bash
git add src/components/claim/pop-claim-button.tsx
git commit -m "feat: POP-claim success dialog (replaces toast)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Upgrade `approve-mint-sheet` success panel + drop redundant toast

**Files:**
- Modify: `src/components/portfolio/approve-mint-sheet.tsx`

This sheet already renders a bespoke inline success panel (the `done` branch). Swap it for `MarketplaceSuccessState`, fire confetti when `done` flips true, and remove the redundant `toast.success`.

- [ ] **Step 1: Add imports**

Add:

```tsx
import { useEffect } from "react";
import { MarketplaceSuccessState } from "@/components/marketplace/marketplace-dialog-primitives";
import { fireConfetti } from "@/lib/confetti";
import { EXPLORER_URL } from "@/lib/constants";
```

(Adjust the existing `import { useState } from "react";` to `import { useState, useEffect } from "react";` rather than adding a duplicate React import.)

- [ ] **Step 2: Capture the mint hash + remove the success toast**

In `handlePin`, change:

```tsx
      const mintResult = await executeTransaction(mintCalls);
      if (mintResult === null) throw new Error("Mint reverted");
```

to keep `mintResult` (it is the hash string) and store it for the dialog. After the existing `newAssetLink` state declaration (line ~54), add:

```tsx
  const [mintHash, setMintHash] = useState<string | null>(null);
```

Then in `handlePin`, right after the mint succeeds, set it:

```tsx
      const mintResult = await executeTransaction(mintCalls);
      if (mintResult === null) throw new Error("Mint reverted");
      setMintHash(mintResult);
```

And remove the redundant success toast line:

```tsx
      toast.success("Remix minted!", { description: "Buyer has been notified." });
```

(Leave the `toast.error(...)` in the catch block and the `setDone(true)` / `setNewAssetLink(...)` / `setTimeout(onSuccess…)` lines intact.)

Also reset `mintHash` in `handleOpenChange`'s close branch (alongside the other resets):

```tsx
      setMintHash(null);
```

- [ ] **Step 3: Fire confetti when done flips true**

Add this effect near the top of the component body (after the state declarations):

```tsx
  useEffect(() => {
    if (done) fireConfetti();
  }, [done]);
```

- [ ] **Step 4: Replace the bespoke `done` panel with `MarketplaceSuccessState`**

Replace the JSX block:

```tsx
          {done ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-semibold">Remix minted!</p>
              <p className="text-sm text-muted-foreground">The buyer will see "Complete Purchase" in their portfolio.</p>
              {newAssetLink && (
                <Button variant="outline" size="sm" asChild>
                  <a href={newAssetLink}>View new asset</a>
                </Button>
              )}
            </div>
          ) : (
```

with:

```tsx
          {done ? (
            <MarketplaceSuccessState
              name="Remix"
              title="Remix minted!"
              description={'The buyer will see "Complete Purchase" in their portfolio.'}
              txHash={mintHash}
              explorerUrl={EXPLORER_URL}
              onDone={() => handleOpenChange(false)}
              footer={
                newAssetLink ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={newAssetLink}>View new asset</a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. If `Check` from lucide-react is now unused, remove it from the lucide import.

- [ ] **Step 6: Commit**

```bash
git add src/components/portfolio/approve-mint-sheet.tsx
git commit -m "feat: approve-mint success state via shared primitive + confetti

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Inline success state in `transfer-ownership-dialog`

**Files:**
- Modify: `src/components/collection/transfer-ownership-dialog.tsx`

It already owns a `Dialog`. Add a `done` flag; on success render `MarketplaceSuccessState` in place of the form body, and remove the success toast.

- [ ] **Step 1: Add imports + done state**

Add:

```tsx
import { MarketplaceSuccessState } from "@/components/marketplace/marketplace-dialog-primitives";
import { EXPLORER_URL } from "@/lib/constants";
```

After `const [submitting, setSubmitting] = useState(false);` add:

```tsx
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [transferredTo, setTransferredTo] = useState<string>("");
```

- [ ] **Step 2: Capture hash + set done, drop the success toast**

In `handleTransfer`, replace:

```tsx
      await executeAuto([call]);
      toast.success("Collection ownership transferred", {
        description: `New owner: ${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`,
      });
      setOpen(false);
      setNewOwner("");
      onTransferred?.();
```

with:

```tsx
      const hash = await executeAuto([call]);
      setTxHash(hash);
      setTransferredTo(trimmed);
      setDone(true);
      onTransferred?.();
```

(Leave the `toast.error(...)` catch block intact.)

- [ ] **Step 3: Reset state when the dialog closes**

Change the `<Dialog open={open} onOpenChange={setOpen}>` to reset on close:

```tsx
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setDone(false); setNewOwner(""); setTxHash(null); setTransferredTo(""); }
      }}
    >
```

- [ ] **Step 4: Render the success state in the dialog body**

Wrap the existing `<DialogHeader>…</DialogHeader>`, form `<div>`, and `<DialogFooter>` so they only render when `!done`, and render `MarketplaceSuccessState` when `done`. Replace the `<DialogContent>` children:

```tsx
      <DialogContent>
        {done ? (
          <MarketplaceSuccessState
            name="Collection"
            title="Ownership transferred"
            description={`New owner: ${transferredTo.slice(0, 6)}…${transferredTo.slice(-4)}`}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            onDone={() => {
              setOpen(false);
              setDone(false);
              setNewOwner("");
              setTxHash(null);
              setTransferredTo("");
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Transfer collection ownership</DialogTitle>
              <DialogDescription>
                The new owner will control minting and future ownership transfers
                for this collection. Existing tokens are unaffected.
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
                spellCheck={false}
                autoComplete="off"
              />
              {trimmed && !isValid && (
                <p className="text-xs text-red-500">Not a valid Starknet address.</p>
              )}
              {wouldNoop && (
                <p className="text-xs text-amber-500">
                  This is already the current owner.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={!isValid || wouldNoop || submitting}
              >
                {submitting ? "Transferring…" : "Transfer"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. `toast` is still used by the error path — keep its import.

- [ ] **Step 6: Commit**

```bash
git add src/components/collection/transfer-ownership-dialog.tsx
git commit -m "feat: inline success state on collection ownership transfer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Remove the redundant transfer success toast

**Files:**
- Modify: `src/hooks/use-transfer.ts`

`transfer-dialog.tsx` already renders `MarketplaceSuccessState` inline from this hook's `txStatus`, so the hook's success toast double-notifies. Remove only the success toast; keep the error toast (the dialog has no inline error state).

- [ ] **Step 1: Delete the success toast**

Remove these lines (around line 107):

```tsx
        toast.success("Transfer complete!", {
          description: `Token #${input.tokenId} sent successfully.`,
        });
```

Leave `setTxHash(hash); setTxStatus("confirmed"); invalidate(); …` and the catch's `toast.error(...)` intact.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. `toast` is still used by `toast.error` — keep the import.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-transfer.ts
git commit -m "fix: drop duplicate transfer-complete toast (dialog already shows success)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Full build verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: clean (zero errors).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build completes with no errors. Do not filter the output through grep — read it in full.

- [ ] **Step 3: Manual browser smoke (record results, do not auto-pass)**

No test runner exists; verify each surface in the browser and note the outcome:
1. Collection Drop asset page → mint → success dialog with confetti + tx link; "Done" closes and the button shows "Minted · N".
2. POP credential asset page → claim → success dialog; "Done" closes and shows "Claimed".
3. Portfolio → incoming remix offer → Approve → mint+list → success state inside the sheet with confetti + "View new asset".
4. Collection settings → Transfer ownership → submit → inline success state in the dialog; no toast.
5. Asset → Transfer → confirm → inline success state only (no duplicate "Transfer complete!" toast).

- [ ] **Step 4: Final confirmation**

Confirm `tsc --noEmit` and `npm run build` both passed before declaring the work complete.

---

## Self-Review

- **Spec coverage:** Tasks 1–6 map 1:1 to the spec's component + 5 integrations; Task 7 covers the spec's Verification section. No spec requirement is unaddressed.
- **Placeholders:** none — every code step contains the literal code.
- **Type consistency:** `TxResult` and `TransactionResultDialog` defined in Task 1 are used with matching shapes in Tasks 2–3; `MarketplaceSuccessState` props used in Tasks 4–5 match the Reference signature; `executeAuto`/`executeTransaction` return-hash usage matches the hooks.
