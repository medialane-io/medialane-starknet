# Connect-Panel Redesign + Privy Collapse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a uniform 2×2 grid of wallet cards in the nav panel and remove the cross-context Privy bridge so a single provider owns the Privy connect flow.

**Architecture:** Part 1 rewrites only the disconnected-state branch of `nav-account-panel.tsx`. Part 2 renames `privy-bridge.tsx` → `privy-connector.tsx`, switches it from consuming a second context to consuming props passed by `StarkZapWalletProvider`, and changes `providers.tsx` to pass the connector down as a prop instead of mounting it as a sibling. The wallet-session type and `useWallet()` are untouched, so `<UserRegistration />` continues to fire silently.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `@privy-io/react-auth`, StarkZap SDK, shadcn/ui, Tailwind, lucide-react.

**Reference spec:** `docs/superpowers/specs/2026-05-14-connect-panel-redesign-and-privy-collapse.md`

---

## File Structure

| File | Change |
|------|--------|
| `src/components/nav-account-panel.tsx` | Modify — rewrite disconnected-state branch as 2×2 card grid |
| `src/contexts/starkzap-wallet-context.tsx` | Modify — remove second context; export `PrivyConnectorProps` for the connector |
| `src/contexts/privy-bridge.tsx` | Delete |
| `src/contexts/privy-connector.tsx` | Create — same connect flow, consumes props instead of context |
| `src/app/providers.tsx` | Modify — load `privy-connector` instead of `privy-bridge`; pass it as a prop to the provider |
| `src/components/wallet/privy-connect-dialog.tsx` | Unchanged |
| `src/lib/wallet-session.ts` | Unchanged |

No tests are added — repo has no test suite (`CLAUDE.md`). Verification is manual + `npx tsc --noEmit` + `npm run lint` + `npm run build`.

---

## Part 1 — Connect-wallet panel redesign

### Task 1: Rewrite the disconnected-state branch as a 2×2 card grid

**Files:**
- Modify: `src/components/nav-account-panel.tsx` (lines 77-128)

- [ ] **Step 1: Replace the disconnected-state JSX**

Open `src/components/nav-account-panel.tsx`. The connected-state branch (lines 59-75) stays as-is. Replace the entire `return (...)` block that starts at the comment `// disconnected state` (currently the `return (` on line 77) with this:

```tsx
  type CardOption = {
    key: string;
    label: string;
    icon: React.ReactNode;
    recommended?: boolean;
    onClick: () => void;
    isLoading: boolean;
  };

  const argent = connectors.find((c) => c.id === "argentX");
  const braavos = connectors.find((c) => c.id === "braavos");

  const cards: CardOption[] = [
    {
      key: "privy",
      label: "Email or social",
      icon: <Mail className="h-5 w-5" />,
      recommended: true,
      onClick: () => void connectStarkZap("privy"),
      isLoading: isConnecting && !connectingId,
    },
    {
      key: "argent",
      label: argent ? getConnectorDisplayName(argent.id, argent.name) : "Ready",
      icon: <Wallet className="h-5 w-5" />,
      onClick: () => argent && void connectInjected(argent),
      isLoading: connectingId === "argentX",
    },
    {
      key: "braavos",
      label: braavos ? getConnectorDisplayName(braavos.id, braavos.name) : "Braavos",
      icon: <Wallet className="h-5 w-5" />,
      onClick: () => braavos && void connectInjected(braavos),
      isLoading: connectingId === "braavos",
    },
    {
      key: "cartridge",
      label: "Cartridge",
      icon: <Gamepad2 className="h-5 w-5" />,
      onClick: () => void connectStarkZap("cartridge"),
      isLoading: false,
    },
  ];

  const anyBusy = isConnecting || connectingId !== null;

  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            disabled={anyBusy && !card.isLoading}
            className={`relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-border/50 bg-muted/30 px-3 text-xs font-medium transition-colors hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60 ${
              card.isLoading ? "ring-1 ring-primary/40" : ""
            }`}
          >
            {card.recommended && (
              <span className="absolute right-2 top-2 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                Recommended
              </span>
            )}
            <span className="text-foreground/80">
              {card.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : card.icon}
            </span>
            <span className="text-foreground">{card.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update imports**

At the top of the same file, the lucide-react import currently reads:

```ts
import { Gamepad2, LogOut, Mail, User, Wallet } from "lucide-react";
```

Add `Loader2`:

```ts
import { Gamepad2, Loader2, LogOut, Mail, User, Wallet } from "lucide-react";
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no new errors. (Pre-existing `<img>` warnings in `asset-preview-*` are unrelated.)

- [ ] **Step 4: Verify visually**

Run: `npm run dev`
Open `http://localhost:3000`. Open the nav command menu. The disconnected-state panel should show a 2×2 grid: Privy (top-left, with "Recommended" pill), Ready (top-right), Braavos (bottom-left), Cartridge (bottom-right). All four cards visually identical apart from the Privy pill.

Click any wallet — its card should show a spinner and a thin primary ring while the connect is in flight.

- [ ] **Step 5: Commit**

```bash
git add src/components/nav-account-panel.tsx
git commit -m "feat(nav): redesign connect panel as uniform 2x2 wallet card grid"
```

---

## Part 2 — Collapse Privy bridge into the wallet provider

### Task 2: Create `privy-connector.tsx` with prop-driven interface

**Files:**
- Create: `src/contexts/privy-connector.tsx`

- [ ] **Step 1: Write the new connector**

Create `src/contexts/privy-connector.tsx`:

```tsx
"use client";

/**
 * PrivyConnector — runs the Privy onboarding flow.
 * Rendered by StarkZapWalletProvider only when providers.tsx has loaded
 * the lazy Privy bundle. Communicates with its parent via props (no
 * second context — that pattern caused a silent-mount regression).
 */

import { useCallback, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import type { WalletInterface } from "starkzap";
import type { User } from "@privy-io/react-auth";
import { getStarkZapSdk, isStarkZapSponsorshipEnabled } from "@/lib/starkzap";
import type { WalletSession } from "@/lib/wallet-session";
import {
  IDLE_WALLET_SESSION,
  walletAuthenticating,
  walletDeployingAccount,
  walletError,
  walletPreparingWallet,
  walletReady,
} from "@/lib/wallet-session";

export interface PrivyConnectorProps {
  pendingConnect: boolean;
  clearPending: () => void;
  walletType: "cartridge" | "privy" | null;
  setSession: (next: WalletSession) => void;
  setWallet: (w: WalletInterface | null) => void;
  setPrivyUser: (u: User | null) => void;
}

export function PrivyConnector({
  pendingConnect,
  clearPending,
  walletType,
  setSession,
  setWallet,
  setPrivyUser,
}: PrivyConnectorProps) {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();

  const runOnboarding = useCallback(async (silent = false) => {
    setSession(walletPreparingWallet("privy"));

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

    setSession(walletDeployingAccount("privy", walletData.address));

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

    setWallet(result.wallet);
    setSession(walletReady("privy", result.wallet.address as unknown as string));
    setPrivyUser(user ?? null);
  }, [getAccessToken, setSession, setWallet, setPrivyUser, user]);

  // Explicit connect — gated on Privy `ready` so login() isn't called before init.
  useEffect(() => {
    if (!pendingConnect) return;
    if (!ready) {
      console.log("[Privy] pending connect but SDK not ready yet — waiting");
      return;
    }
    console.log("[Privy] SDK ready, starting connect flow. authenticated=", authenticated);
    clearPending();
    setSession(walletAuthenticating("privy"));

    const run = async () => {
      if (!authenticated) {
        console.log("[Privy] calling login()");
        await login();
        console.log("[Privy] login() resolved");
      } else {
        console.log("[Privy] already authenticated, skipping login()");
      }
      await runOnboarding();
    };

    run().catch((err) => {
      console.error("[Privy] connect flow failed:", err);
      setWallet(null);
      setSession(walletError("privy", err instanceof Error ? err.message : "Failed to connect with Privy"));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pendingConnect]);

  // Auto-reconnect on page reload — gated on `ready`.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated || walletType === "cartridge") return;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("ml_privy_session")) return;

    runOnboarding(true).catch((err) => {
      console.error("[Privy] auto-reconnect failed:", err);
      setSession(walletError("privy", err instanceof Error ? err.message : "Privy auto-reconnect failed"));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  // Sync logout when Privy session ends externally.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && walletType === "privy") {
      logout().catch(() => {});
      setWallet(null);
      setSession(IDLE_WALLET_SESSION);
      setPrivyUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("ml_privy_session");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  return null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/privy-connector.tsx
git commit -m "feat(wallet): add PrivyConnector with prop-driven interface"
```

---

### Task 3: Refactor `StarkZapWalletProvider` to use the connector via props

**Files:**
- Modify: `src/contexts/starkzap-wallet-context.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/contexts/starkzap-wallet-context.tsx` with:

```tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import type { WalletInterface } from "starkzap";
import { toast } from "sonner";
import { getStarkZapSdk } from "@/lib/starkzap";
import type { PrivyConnectorProps } from "./privy-connector";
import {
  IDLE_WALLET_SESSION,
  isWalletSessionBusy,
  walletConnecting,
  walletError,
  walletReady,
  walletAuthenticating,
  type WalletSession,
} from "@/lib/wallet-session";
import {
  COLLECTION_721_CONTRACT,
  MARKETPLACE_721_CONTRACT,
  MARKETPLACE_1155_CONTRACT,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Cartridge session policies for Medialane contracts
// ---------------------------------------------------------------------------

export const CARTRIDGE_POLICIES = [
  { target: COLLECTION_721_CONTRACT, method: "mint" },
  { target: COLLECTION_721_CONTRACT, method: "create_collection" },
  { target: COLLECTION_721_CONTRACT, method: "burn" },
  { target: COLLECTION_721_CONTRACT, method: "transfer_token" },
  { target: MARKETPLACE_721_CONTRACT, method: "register_order" },
  { target: MARKETPLACE_721_CONTRACT, method: "fulfill_order" },
  { target: MARKETPLACE_721_CONTRACT, method: "cancel_order" },
  { target: MARKETPLACE_1155_CONTRACT, method: "register_order" },
  { target: MARKETPLACE_1155_CONTRACT, method: "fulfill_order" },
  { target: MARKETPLACE_1155_CONTRACT, method: "cancel_order" },
] as { target: string; method: string }[];

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export type StarkZapWalletType = "cartridge" | "privy";

export interface StarkZapWalletCtx {
  wallet: WalletInterface | null;
  session: WalletSession;
  walletType: StarkZapWalletType | null;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  privyUser: User | null;
  connectCartridge: () => Promise<void>;
  connectPrivy: () => Promise<void>;
  disconnect: () => void;
}

const StarkZapWalletContext = createContext<StarkZapWalletCtx | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider — owns Privy onboarding state directly; renders an injected
// PrivyConnector component (lazy-loaded by providers.tsx) when available.
// ---------------------------------------------------------------------------

interface ProviderProps {
  children: React.ReactNode;
  onRequestPrivy: () => void;
  PrivyConnector?: React.ComponentType<PrivyConnectorProps> | null;
}

export function StarkZapWalletProvider({
  children,
  onRequestPrivy,
  PrivyConnector,
}: ProviderProps) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [session, setSession] = useState<WalletSession>(IDLE_WALLET_SESSION);
  const [privyUser, setPrivyUser] = useState<User | null>(null);
  const [pendingPrivyConnect, setPendingPrivyConnect] = useState(false);
  const walletType = session.walletType === "cartridge" || session.walletType === "privy"
    ? session.walletType
    : null;
  const address = session.address;
  const isConnecting = isWalletSessionBusy(session);
  const error = session.error;

  const connectCartridge = useCallback(async () => {
    setSession(walletConnecting("cartridge"));
    try {
      const sdk = getStarkZapSdk();
      const result = await sdk.onboard({
        strategy: OnboardStrategy.Cartridge,
        cartridge: { policies: CARTRIDGE_POLICIES },
        deploy: "if_needed",
      });
      setWallet(result.wallet);
      setSession(walletReady("cartridge", result.wallet.address as unknown as string));
    } catch (err) {
      setWallet(null);
      setSession(walletError("cartridge", err instanceof Error ? err.message : "Failed to connect Cartridge"));
    }
  }, []);

  const connectPrivy = useCallback(async () => {
    localStorage.setItem("ml_privy_session", "1");
    setSession(walletAuthenticating("privy"));
    onRequestPrivy();
    setPendingPrivyConnect(true);
  }, [onRequestPrivy]);

  const disconnect = useCallback(() => {
    if (walletType === "privy") {
      localStorage.removeItem("ml_privy_session");
    }
    setWallet(null);
    setSession(IDLE_WALLET_SESSION);
    setPrivyUser(null);
  }, [walletType]);

  // Surface session errors as toasts (Privy-only — Cartridge errors are
  // already shown inline in nav-account-panel).
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

  const clearPending = useCallback(() => setPendingPrivyConnect(false), []);

  return (
    <StarkZapWalletContext.Provider
      value={{ wallet, session, walletType, address, isConnecting, error, privyUser, connectCartridge, connectPrivy, disconnect }}
    >
      {PrivyConnector ? (
        <PrivyConnector
          pendingConnect={pendingPrivyConnect}
          clearPending={clearPending}
          walletType={walletType}
          setSession={setSession}
          setWallet={setWallet}
          setPrivyUser={setPrivyUser}
        />
      ) : null}
      {children}
    </StarkZapWalletContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

const STARKZAP_DEFAULT_CTX: StarkZapWalletCtx = {
  wallet: null, session: IDLE_WALLET_SESSION, walletType: null, address: null,
  isConnecting: false, error: null, privyUser: null,
  connectCartridge: async () => {},
  connectPrivy: async () => {},
  disconnect: () => {},
};

export function useStarkZapWallet(): StarkZapWalletCtx {
  return useContext(StarkZapWalletContext) ?? STARKZAP_DEFAULT_CTX;
}
```

Key differences from the old file:
- `StarkZapPrivyBridgeContext`, `useStarkZapPrivyBridge`, and the `StarkZapPrivyBridge` type are gone.
- The provider now takes `PrivyConnector` as a prop and renders it itself when present.
- All `onPrivy*` callbacks are replaced by direct `setSession`/`setWallet` calls inside `PrivyConnector` (which receives them as props).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in `src/app/providers.tsx` (it still references the deleted bridge file — fixed in Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/contexts/starkzap-wallet-context.tsx
git commit -m "refactor(wallet): drop second context, render PrivyConnector from provider"
```

---

### Task 4: Delete `privy-bridge.tsx`

**Files:**
- Delete: `src/contexts/privy-bridge.tsx`

- [ ] **Step 1: Delete the file**

```bash
git rm src/contexts/privy-bridge.tsx
```

- [ ] **Step 2: Confirm no remaining references**

Run: `grep -rn "privy-bridge\|useStarkZapPrivyBridge\|StarkZapPrivyBridge" src/`
Expected output: only `src/app/providers.tsx` still references `privy-bridge` (fixed in Task 5). No file should reference `useStarkZapPrivyBridge` or `StarkZapPrivyBridge`.

- [ ] **Step 3: Commit (with Task 5)**

Don't commit yet — combine with Task 5 since the build is broken until providers.tsx is updated.

---

### Task 5: Update `providers.tsx` to load and pass the connector

**Files:**
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Replace the lazy-loader and provider wiring**

In `src/app/providers.tsx`, replace the section from `// PrivyProvider and PrivyBridge are dynamically imported` through the end of `loadPrivyStack` (currently lines 83-116) with:

```tsx
// PrivyProvider and PrivyConnector are dynamically imported so they are
// never bundled or executed for users who don't use Privy.
//
// PrivyConnector renders inside StarkZapWalletProvider (passed in as a prop)
// so it has access to the provider's setters. PrivyProvider wraps the whole
// tree so usePrivy() inside PrivyConnector resolves.
import type { PrivyConnectorProps } from "@/contexts/privy-connector";

let PrivyStack: React.ComponentType<{ children: React.ReactNode }> | null = null;
let PrivyConnectorComponent: React.ComponentType<PrivyConnectorProps> | null = null;

async function loadPrivyStack() {
  if (PrivyStack && PrivyConnectorComponent) return;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set — Privy onboarding cannot start.");
  }
  const [{ PrivyProvider }, connectorMod] = await Promise.all([
    import("@privy-io/react-auth"),
    import("@/contexts/privy-connector"),
  ]);
  PrivyConnectorComponent = connectorMod.PrivyConnector;
  const PRIVY_CONFIG = {
    loginMethods: ["email", "google", "twitter"] as Array<"email" | "google" | "twitter">,
    appearance: { theme: "dark" as const },
  };
  function PrivyStackInner({ children }: { children: React.ReactNode }) {
    return (
      <PrivyProvider appId={appId!} config={PRIVY_CONFIG}>
        {children}
      </PrivyProvider>
    );
  }
  PrivyStack = PrivyStackInner;
}
```

Then update the state hooks in `Providers` (currently lines 122-131) — replace the block:

```tsx
  const [privyActive, setPrivyActive] = useState(false);
  const [PrivyWrapper, setPrivyWrapper] = useState<React.ComponentType<{ children: React.ReactNode }> | null>(null);
  const [PrivyBridgeMount, setPrivyBridgeMount] = useState<React.ComponentType | null>(null);

  const activatePrivy = () => {
    setPrivyWrapper(() => PrivyStack);
    setPrivyBridgeMount(() => PrivyBridgeComponent);
    setPrivyActive(true);
  };
```

with:

```tsx
  const [privyActive, setPrivyActive] = useState(false);
  const [PrivyWrapper, setPrivyWrapper] = useState<React.ComponentType<{ children: React.ReactNode }> | null>(null);
  const [PrivyConnectorMount, setPrivyConnectorMount] = useState<React.ComponentType<PrivyConnectorProps> | null>(null);

  const activatePrivy = () => {
    setPrivyWrapper(() => PrivyStack);
    setPrivyConnectorMount(() => PrivyConnectorComponent);
    setPrivyActive(true);
  };
```

Then update the provider mount block (currently lines 170-171) — replace:

```tsx
          <StarkZapWalletProvider onRequestPrivy={handleRequestPrivy}>
            {PrivyBridgeMount ? <PrivyBridgeMount /> : null}
```

with:

```tsx
          <StarkZapWalletProvider onRequestPrivy={handleRequestPrivy} PrivyConnector={PrivyConnectorMount}>
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint 2>&1 | grep -E "(providers|starkzap|privy)" | head -20`
Expected: TypeScript clean. Lint may surface no new warnings.

- [ ] **Step 3: Build sanity**

Run: `npm run build`
Expected: builds cleanly.

- [ ] **Step 4: Commit (combined with Task 4 deletion)**

```bash
git add -A src/app/providers.tsx src/contexts/privy-bridge.tsx
git commit -m "refactor(privy): replace bridge with prop-driven connector

PrivyBridge consumed a second context that had to be mounted in a
specific order; getting it wrong failed silently. Replace it with
PrivyConnector that takes setSession/setWallet/setPrivyUser as props
from StarkZapWalletProvider, and render the connector from inside the
provider instead of as a sibling. Removes StarkZapPrivyBridgeContext
and useStarkZapPrivyBridge entirely."
```

---

## Task 6: End-to-end verification

**Files:** none

- [ ] **Step 1: Build + type-check + lint**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: clean.

- [ ] **Step 2: Start dev server and verify the new panel**

Run: `npm run dev`

Open the dapp. Open the nav menu. Confirm:
- Disconnected state shows the 2×2 grid with Privy/Ready/Braavos/Cartridge.
- Privy card has the "Recommended" pill.
- Hover lifts the card background subtly.
- Clicking Privy shows ring + spinner on that card while connecting.

- [ ] **Step 3: Verify Privy end-to-end**

From a fresh browser profile (no `ml_privy_session`), click Privy. Confirm:
- Nav menu closes.
- Privy modal opens (email/Google/Twitter).
- After auth, the `PrivyConnectDialog` appears with **Preparing wallet** → **Deploying account** → **Ready**.
- Nav account panel shows the connected Privy address.

- [ ] **Step 4: Verify backend registration**

Either:
- Inspect `localStorage` for `ml_registered_{address}` — must be set to `"1"`.
- OR query the backend `users` table directly and confirm a row exists with the new address, `walletType=PRIVY`, `appSource=MEDIALANE_DAPP`.

(This proves `<UserRegistration />` still fires; the refactor preserves the registration trigger as required by spec success criterion #4.)

- [ ] **Step 5: Verify auto-reconnect**

Reload the page. The nav should silently reconnect to the same Privy address without showing the connect dialog (or only flash through it briefly).

- [ ] **Step 6: Verify injected wallet still works**

Disconnect. Connect Ready (or Braavos). Confirm the ring/spinner shows on that card during the connect.

- [ ] **Step 7: Update memory**

Update `/Users/kalamaha/.claude/projects/-Users-kalamaha-dev-medialane-dapp/memory/arch_wallet_onboarding.md` to remove the `StarkZapPrivyBridge` references and note the new prop-driven `PrivyConnector` pattern. Keep the wallet-types section as-is.

- [ ] **Step 8: Push to production (only when manual verification passes)**

```bash
git push origin main
```

---

## Self-review notes

- Spec Part 1 (uniform 2×2 grid) → Task 1.
- Spec Part 1 ("Recommended" pill on Privy) → Task 1 step 1.
- Spec Part 1 (subtitle removed per latest spec amendment) → Task 1 reflects icon + label only.
- Spec Part 2 (collapse bridge into provider) → Tasks 2–5.
- Spec Part 2 (delete `privy-bridge.tsx`) → Task 4.
- Spec Part 2 (remove `StarkZapPrivyBridgeContext` / `useStarkZapPrivyBridge`) → Task 3.
- Spec Part 2 (keep lazy-loading behavior) → Task 5 preserves the `loadPrivyStack` pattern.
- Spec cross-cutting (UserRegistration still fires) → Task 6 step 4.
- Spec success criterion #4 (Privy address registered with `walletType=PRIVY`) → Task 6 step 4.
- Spec success criterion #5 (auto-reconnect on reload) → Task 6 step 5.
- Spec success criteria #6, #7 (bridge file/types removed) → Tasks 3, 4.
- Type consistency: `PrivyConnectorProps` shape is defined in Task 2 and referenced in Tasks 3 and 5 — names match (`pendingConnect`, `clearPending`, `walletType`, `setSession`, `setWallet`, `setPrivyUser`).
