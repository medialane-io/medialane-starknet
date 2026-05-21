# Privy Onboarding with Automatic Account Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken Privy login flow so a user can connect with email/Google, get a Starknet account deployed automatically (sponsored by AVNU), and see clear progress + errors throughout.

**Architecture:** Collapse the broken two-step deploy in `PrivyBridge` into a single `sdk.onboard({ deploy: "if_needed", feeMode: "sponsored" })` call per StarkZap docs. Gate the connect flow on Privy's `ready` field to fix the silent dead-button. Add new in-flight session states for "preparing wallet" and "deploying account" so a globally-mounted progress dialog can render a stepper. Surface session errors as toasts so failures stop being invisible.

**Tech Stack:** Next.js App Router, React 19, TypeScript, StarkZap SDK, `@privy-io/react-auth`, sonner toasts, shadcn/ui Dialog.

**Reference spec:** `docs/superpowers/specs/2026-05-14-privy-onboarding-auto-deploy-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/wallet-session.ts` | (modify) Add `preparing-wallet` and `deploying-account` statuses + helpers |
| `src/contexts/privy-bridge.tsx` | (modify) Single-step `onboard`, gate on Privy `ready`, emit new in-flight states |
| `src/contexts/starkzap-wallet-context.tsx` | (modify) Expose new in-flight setters to the bridge; add error-toast effect |
| `src/components/wallet/privy-connect-dialog.tsx` | (create) Progress stepper modal + retry |
| `src/app/providers.tsx` | (modify) Mount `<PrivyConnectDialog />` globally |

No tests are added — this repo has no test suite (`CLAUDE.md`). Verification is manual + `npx tsc --noEmit` + `npm run lint`.

---

## Task 1: Extend wallet-session statuses

**Files:**
- Modify: `src/lib/wallet-session.ts`

- [ ] **Step 1: Add new statuses and helpers**

Replace the contents of `src/lib/wallet-session.ts` with:

```ts
export type WalletSessionType = "injected" | "cartridge" | "privy";

export type WalletSessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "authenticating"
  | "preparing-wallet"
  | "deploying-account"
  | "ready"
  | "error";

export interface WalletSession {
  status: WalletSessionStatus;
  walletType: WalletSessionType | null;
  address: string | null;
  error: string | null;
}

export const IDLE_WALLET_SESSION: WalletSession = {
  status: "idle",
  walletType: null,
  address: null,
  error: null,
};

export function walletConnecting(walletType: WalletSessionType): WalletSession {
  return { status: "connecting", walletType, address: null, error: null };
}

export function walletConnected(walletType: WalletSessionType, address: string): WalletSession {
  return { status: "connected", walletType, address, error: null };
}

export function walletAuthenticating(
  walletType: WalletSessionType,
  address: string | null = null,
): WalletSession {
  return { status: "authenticating", walletType, address, error: null };
}

export function walletPreparingWallet(walletType: WalletSessionType): WalletSession {
  return { status: "preparing-wallet", walletType, address: null, error: null };
}

export function walletDeployingAccount(
  walletType: WalletSessionType,
  address: string | null = null,
): WalletSession {
  return { status: "deploying-account", walletType, address, error: null };
}

export function walletReady(walletType: WalletSessionType, address: string): WalletSession {
  return { status: "ready", walletType, address, error: null };
}

export function walletError(walletType: WalletSessionType | null, error: string): WalletSession {
  return { status: "error", walletType, address: null, error };
}

export function isWalletSessionActive(session: WalletSession): boolean {
  return session.status === "connected" || session.status === "ready";
}

export function isWalletSessionBusy(session: WalletSession): boolean {
  return (
    session.status === "connecting" ||
    session.status === "authenticating" ||
    session.status === "preparing-wallet" ||
    session.status === "deploying-account"
  );
}

export function isPrivyConnectInFlight(session: WalletSession): boolean {
  if (session.walletType !== "privy") return false;
  return (
    session.status === "authenticating" ||
    session.status === "preparing-wallet" ||
    session.status === "deploying-account"
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean (no new errors). Existing call sites of `isWalletSessionBusy` and the existing helpers are unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wallet-session.ts
git commit -m "feat(wallet-session): add preparing-wallet and deploying-account statuses"
```

---

## Task 2: Expose in-flight state setters on the StarkZap bridge

**Files:**
- Modify: `src/contexts/starkzap-wallet-context.tsx`

- [ ] **Step 1: Add new bridge methods**

In `src/contexts/starkzap-wallet-context.tsx`, update the imports near the top so they include the new helpers:

```ts
import {
  IDLE_WALLET_SESSION,
  isWalletSessionBusy,
  walletConnecting,
  walletError,
  walletReady,
  walletAuthenticating,
  walletPreparingWallet,
  walletDeployingAccount,
  type WalletSession,
} from "@/lib/wallet-session";
```

Then extend `StarkZapPrivyBridge` with two new callbacks:

```ts
export interface StarkZapPrivyBridge {
  pendingPrivyConnect: boolean;
  clearPendingPrivyConnect: () => void;
  onPrivyConnecting: () => void;
  onPrivyPreparingWallet: () => void;
  onPrivyDeployingAccount: (address: string) => void;
  onPrivyConnected: (wallet: WalletInterface, address: string, user: User | null) => void;
  onPrivyError: (msg: string) => void;
  onPrivyDisconnect: () => void;
  walletType: StarkZapWalletType | null;
}
```

Then wire those callbacks in the `bridge` object inside `StarkZapWalletProvider`:

```ts
const bridge: StarkZapPrivyBridge = {
  pendingPrivyConnect,
  clearPendingPrivyConnect: () => setPendingPrivyConnect(false),
  onPrivyConnecting: () => { setSession(walletAuthenticating("privy")); },
  onPrivyPreparingWallet: () => { setSession(walletPreparingWallet("privy")); },
  onPrivyDeployingAccount: (addr) => { setSession(walletDeployingAccount("privy", addr)); },
  onPrivyConnected: (w, addr, u) => {
    setWallet(w);
    setSession(walletReady("privy", addr));
    setPrivyUser(u);
  },
  onPrivyError: (msg) => {
    setWallet(null);
    setSession(walletError("privy", msg));
  },
  onPrivyDisconnect: () => {
    setWallet(null);
    setSession(IDLE_WALLET_SESSION);
    setPrivyUser(null);
    localStorage.removeItem("ml_privy_session");
  },
  walletType,
};
```

- [ ] **Step 2: Add error-toast effect**

Still in `src/contexts/starkzap-wallet-context.tsx`, add an import at the top:

```ts
import { useEffect, useRef } from "react";
import { toast } from "sonner";
```

(Merge `useEffect` and `useRef` with the existing React import — change the existing import line `import React, { createContext, useCallback, useContext, useState } from "react";` to also include `useEffect, useRef`.)

Then inside `StarkZapWalletProvider`, just above the `return`, add:

```ts
const lastShownError = useRef<string | null>(null);
useEffect(() => {
  if (session.walletType !== "privy") return;
  if (session.status !== "error") {
    lastShownError.current = null;
    return;
  }
  if (!session.error || session.error === lastShownError.current) return;
  lastShownError.current = session.error;
  toast.error(session.error, { id: "privy-connect-error" });
}, [session.status, session.walletType, session.error]);
```

- [ ] **Step 3: Update the default context export**

Update `STARKZAP_DEFAULT_CTX` is unchanged (it doesn't include bridge methods). No edit needed there.

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. If `PrivyBridge` complains about missing `onPrivyPreparingWallet` / `onPrivyDeployingAccount` calls, that's fine — Task 3 wires them.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/starkzap-wallet-context.tsx
git commit -m "feat(wallet): expose preparing/deploying bridge hooks and toast Privy errors"
```

---

## Task 3: Single-step deploy + `ready` gate in PrivyBridge

**Files:**
- Modify: `src/contexts/privy-bridge.tsx`

- [ ] **Step 1: Replace the bridge implementation**

Replace the full contents of `src/contexts/privy-bridge.tsx` with:

```tsx
"use client";

/**
 * PrivyBridge — rendered only when PrivyProvider is active.
 * Contains all usePrivy() calls so the rest of the app has zero Privy dependency.
 */

import { useCallback, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import { getStarkZapSdk, isStarkZapSponsorshipEnabled } from "@/lib/starkzap";
import { useStarkZapPrivyBridge } from "./starkzap-wallet-context";

export function PrivyBridge() {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();
  const bridge = useStarkZapPrivyBridge();

  const initPrivyWallet = useCallback(async (silent = false) => {
    if (!bridge) return;

    bridge.onPrivyPreparingWallet();

    const token = await getAccessToken();
    if (!token) {
      if (silent) return;
      throw new Error("No Privy access token");
    }

    const res = await fetch("/api/wallet/starknet", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to create Privy Starknet wallet");
    const walletData = (await res.json()) as { id: string; address: string; publicKey: string };

    if (!isStarkZapSponsorshipEnabled()) {
      throw new Error("Privy onboarding requires AVNU paymaster sponsorship to deploy the Starknet account.");
    }

    bridge.onPrivyDeployingAccount(walletData.address);

    const sdk = getStarkZapSdk();
    const privyResolve = async () => ({
      walletId: walletData.id,
      publicKey: walletData.publicKey,
      serverUrl: `${window.location.origin}/api/wallet/sign`,
      headers: async (): Promise<Record<string, string>> => {
        const freshToken = await getAccessToken();
        if (!freshToken) return {};
        return { Authorization: `Bearer ${freshToken}` };
      },
    });

    const result = await sdk.onboard({
      strategy: OnboardStrategy.Privy,
      accountPreset: "argentXV050",
      feeMode: "sponsored",
      privy: { resolve: privyResolve },
      deploy: "if_needed",
    });

    bridge.onPrivyConnected(
      result.wallet,
      result.wallet.address as unknown as string,
      user ?? null,
    );
  }, [bridge, getAccessToken, user]);

  // Explicit connect — gated on Privy `ready` so login() isn't called before init.
  useEffect(() => {
    if (!bridge?.pendingPrivyConnect) return;
    if (!ready) return;
    bridge.clearPendingPrivyConnect();
    bridge.onPrivyConnecting();

    const run = async () => {
      if (!authenticated) await login();
      await initPrivyWallet();
    };

    run().catch((err) => {
      bridge.onPrivyError(err instanceof Error ? err.message : "Failed to connect with Privy");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, bridge?.pendingPrivyConnect]);

  // Auto-reconnect on page reload — also gated on `ready`.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated || bridge?.walletType === "cartridge") return;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("ml_privy_session")) return;

    initPrivyWallet(true).catch((err) => {
      console.error("Privy auto-reconnect failed:", err);
      bridge?.onPrivyError(err instanceof Error ? err.message : "Privy auto-reconnect failed");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  // Sync logout when Privy session ends externally.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && bridge?.walletType === "privy") {
      logout().catch(() => {});
      bridge.onPrivyDisconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  return null;
}
```

Key changes versus the old file:
- `ready` is destructured from `usePrivy()` and gates all three effects.
- The two-step `deploy: "never"` + `ensureReady` is replaced by a single `sdk.onboard({ deploy: "if_needed", feeMode: "sponsored" })`.
- `onPrivyPreparingWallet` is signalled before the `/api/wallet/starknet` fetch.
- `onPrivyDeployingAccount(address)` is signalled before the `sdk.onboard` call (we know the address by that point).
- Auto-reconnect errors now also flow through `onPrivyError` so they surface.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/privy-bridge.tsx
git commit -m "fix(privy): single-step deploy and gate connect flow on Privy ready"
```

---

## Task 4: Build the Privy connect progress dialog

**Files:**
- Create: `src/components/wallet/privy-connect-dialog.tsx`

- [ ] **Step 1: Create the dialog**

Create `src/components/wallet/privy-connect-dialog.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { isPrivyConnectInFlight } from "@/lib/wallet-session";

type Phase = "authenticating" | "preparing-wallet" | "deploying-account" | "ready";

const STEPS: { key: Phase; label: string; description: string }[] = [
  { key: "authenticating", label: "Authenticating", description: "Sign in with email or social" },
  { key: "preparing-wallet", label: "Preparing wallet", description: "Creating your Starknet keys" },
  { key: "deploying-account", label: "Deploying account", description: "Sponsored by AVNU — no gas to pay" },
  { key: "ready", label: "Ready", description: "You're connected" },
];

function phaseIndex(status: string): number {
  switch (status) {
    case "authenticating": return 0;
    case "preparing-wallet": return 1;
    case "deploying-account": return 2;
    case "ready": return 3;
    default: return -1;
  }
}

export function PrivyConnectDialog() {
  const { session, connectPrivy } = useStarkZapWallet();
  const [open, setOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Open when a Privy connect is in flight; keep open briefly on ready; close otherwise.
  useEffect(() => {
    if (isPrivyConnectInFlight(session)) {
      setOpen(true);
      return;
    }
    if (session.walletType === "privy" && session.status === "ready") {
      setOpen(true);
      const t = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(t);
    }
    if (session.walletType === "privy" && session.status === "error") {
      setOpen(true);
      return;
    }
    setOpen(false);
  }, [session.status, session.walletType]);

  const isError = session.walletType === "privy" && session.status === "error";
  const currentIndex = phaseIndex(session.status);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await connectPrivy();
    } finally {
      setIsRetrying(false);
    }
  };

  // Only allow manual close when in a terminal state (error or ready) so the
  // user can't dismiss mid-deploy.
  const allowClose = isError || session.status === "ready" || session.status === "idle";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !allowClose) return;
        setOpen(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isError ? "Connection failed" : session.status === "ready" ? "You're in" : "Connecting your wallet"}
          </DialogTitle>
          <DialogDescription>
            {isError
              ? (session.error ?? "Something went wrong while connecting.")
              : "We'll create and deploy your Starknet account. Gas is sponsored — you don't need to pay."}
          </DialogDescription>
        </DialogHeader>

        {!isError && (
          <ol className="space-y-3 py-2">
            {STEPS.map((step, idx) => {
              const isDone = currentIndex > idx || session.status === "ready" && idx === STEPS.length - 1;
              const isActive = currentIndex === idx;
              return (
                <li key={step.key} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : isActive
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  </span>
                  <div>
                    <div className={`text-sm font-medium ${isActive ? "text-foreground" : isDone ? "text-foreground" : "text-muted-foreground"}`}>
                      {step.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {isError && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <span className="text-destructive-foreground/90">{session.error ?? "Unknown error"}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
              <Button onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? "Retrying…" : "Try again"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. If `@/components/ui/button` is missing, list shadcn ui components with `ls src/components/ui` and replace the import + `<Button>` usage with a plain styled `<button>` matching project Tailwind tokens.

- [ ] **Step 3: Commit**

```bash
git add src/components/wallet/privy-connect-dialog.tsx
git commit -m "feat(wallet): add PrivyConnectDialog with progress stepper and retry"
```

---

## Task 5: Mount the dialog globally

**Files:**
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Import and mount the dialog**

Open `src/app/providers.tsx`. Add the import near the other component imports (after `import { NotificationSpotlight } from "@/components/shared/notification-spotlight";`):

```ts
import { PrivyConnectDialog } from "@/components/wallet/privy-connect-dialog";
```

Then inside the JSX returned from `Providers`, locate the line:

```tsx
<NotificationSpotlight />
```

Insert `<PrivyConnectDialog />` immediately after it, so the relevant block reads:

```tsx
<CartDrawer />
<NotificationSpotlight />
<PrivyConnectDialog />
<Toaster
  richColors
  ...
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/providers.tsx
git commit -m "feat(providers): mount PrivyConnectDialog globally"
```

---

## Task 6: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Build sanity**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean.

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

Open `http://localhost:3000` in a fresh browser profile (so no `ml_privy_session` is cached).

- [ ] **Step 3: Verify Privy login opens**

1. Open the nav command menu, click **Privy**.
2. Within ~1s the `PrivyConnectDialog` should appear with step **Authenticating** active.
3. Privy's own login modal should overlay it — log in with email or Google.

Expected: Privy modal opens. If it doesn't, open the browser console and copy the error — it should now also appear as a sonner toast.

- [ ] **Step 4: Verify deploy runs**

After Privy login completes:
1. Dialog advances to **Preparing wallet** while `/api/wallet/starknet` is called.
2. Dialog advances to **Deploying account** while `sdk.onboard({ deploy: "if_needed" })` is in flight.
3. Dialog reaches **Ready** and closes after ~1.2s.

Expected: the nav account panel now shows a connected Privy address.

- [ ] **Step 5: Verify the account is on-chain**

Open Voyager (or whatever `NEXT_PUBLIC_EXPLORER_URL` resolves to) and look up the connected address.

Expected: contract is deployed (class hash visible).

- [ ] **Step 6: Verify auto-reconnect**

1. Refresh the page.
2. Without any user action, the bridge should reconnect.

Expected: the nav shows the same connected address. The dialog should briefly flash through **Preparing wallet** → **Deploying account** (which will be a no-op deploy since the account already exists) → **Ready**.

- [ ] **Step 7: Verify error surfacing**

Temporarily break the flow to confirm errors surface — e.g. in DevTools network panel, block `/api/wallet/starknet`. Click Privy again from a logged-out state.

Expected:
- A red toast appears with the failure message.
- The dialog shows the **Connection failed** state with the same message and a **Try again** button.
- Clicking **Try again** re-runs `connectPrivy()` (after un-blocking the route, the retry should succeed).

- [ ] **Step 8: Update memory**

If verification passes, update `/Users/kalamaha/.claude/projects/-Users-kalamaha-dev-medialane-dapp/memory/arch_wallet_onboarding.md` to reflect the new single-step pattern (replace the `getClassHashAt(pending)` snippet with the consolidated `sdk.onboard({ deploy: "if_needed", feeMode: "sponsored" })` call and note that the SDK now drives the deployed/undeployed distinction internally). Keep the wallet-types section as-is.

- [ ] **Step 9: Final commit (only if memory was updated)**

If memory was updated, no git commit is needed (memory lives outside the repo). If any source file required a small fix during verification, commit it separately with a clear message before considering the plan complete.

---

## Self-review notes

- Spec section A (single-step deploy) → Task 3.
- Spec section B (`ready` gate) → Task 3.
- Spec section C (error toasts) → Task 2 step 2.
- Spec section D (progress dialog) → Tasks 1, 2, 4, 5.
- Spec section E (lazy-load race) → no code change required; handled implicitly by Task 3.
- Spec success criteria → verified in Task 6.
- All `deploy` and `feeMode` values used (`"if_needed"`, `"sponsored"`) match StarkZap docs.
- Bridge method names are consistent across Tasks 2 and 3 (`onPrivyPreparingWallet`, `onPrivyDeployingAccount`).
- Status string values are consistent across Tasks 1 (definition), 2 (setters), 3 (calls), 4 (`phaseIndex`).
