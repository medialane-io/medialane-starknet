# Wallet/Account Layer Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-render wallet "referee" (which silently lets a background Privy session outrank an actively-connected injected wallet) with a single, explicitly-written active-wallet slot — keeping StarkZap and starknet-react, deleting the four-hook/nested-provider tangle.

**Architecture:** One `WalletProvider` owns a single `ActiveWallet | null` slot. Only an explicit user `connect(type)` writes it. Two small adapters (injected, starkzap) each produce a normalized `ActiveWallet` with its own `execute`. `useWallet()` reads the slot. The legacy hooks (`useUnifiedWallet`, `useStarkZapWallet`, `useWalletSession`) become thin compatibility reads over the slot so ~70 consumer files stay untouched in this PR.

**Tech Stack:** Next.js 15 / React 19, `@starknet-react/core` v5 (injected + AVNU paymaster), `starkzap` v1 (Cartridge/Privy onboarding + execute), `@privy-io/react-auth` v3, `starknet` v8.

**Spec:** `docs/superpowers/specs/2026-06-07-wallet-layer-redesign-design.md`

---

## Testing reality

This repo has **no automated test suite for wallet/React-context flows**, and Privy + mainnet-deploy only fully exercise in production (per CLAUDE.md and the medialane-codebase skill: Privy/mainnet wallet paths are prod-only). So the per-task gate is **`npx tsc --noEmit` clean + `npm run build` passing**, not unit tests. End-to-end correctness is verified by the **manual matrix in Task 12**, which every reviewer must run before merge. This is a deliberate, documented deviation from TDD because the system under test is a third-party-wallet + on-chain integration with no local harness.

## File structure map

**New files**
- `src/lib/wallet-types.ts` — `WalletType`, `ActiveWallet`, `WALLET_STORAGE_KEY`.
- `src/lib/wallet-adapters.ts` — `makeInjectedExecute`, `makeStarkzapExecute` (build the normalized `execute`).
- `src/contexts/wallet-context.tsx` — `WalletProvider` (the single source of truth) + `useWalletContext`.

**Rewired (real changes)**
- `src/hooks/use-wallet.ts` — rich hook over the slot: `{ address, isConnected, isConnecting, walletType, connect, disconnect, execute }`.
- `src/hooks/use-unified-wallet.ts` — becomes an alias re-export of `useWallet` (same shape).
- `src/hooks/use-wallet-session.ts` — becomes a thin read of the slot (same `ActiveWalletSession` shape).
- `src/contexts/starkzap-wallet-context.tsx` — reduced to: own the StarkZap SDK onboarding actions + the active SZ `WalletInterface`; **no priority, no slot**. `useStarkZapWallet()` keeps its shape for `use-tx`, `use-siws-token`, `use-paymaster-transaction`.
- `src/contexts/privy-connector.tsx` — explicit connect + one-time deploy + light reconnect; **delete the silent auto-reconnect effect and the `!injectedConnected` race guard**.
- `src/hooks/use-paymaster-transaction.ts` — delete the `if (szWallet)` branch in `executeAuto`; `executeAuto` defers to the active slot's `execute`.
- `src/app/providers.tsx` — tree becomes `Starknet → StarkZap(SDK holder) → Wallet`; Privy mounted only when `ml_wallet === "privy"` or on the 3 mint/airdrop routes.
- `src/components/ConnectWallet.tsx` — connect buttons call `useWallet().connect(type)`.
- `src/components/nav-account-panel.tsx` — read identity + `disconnect()` from `useWallet()`.

**Deleted**
- `src/lib/wallet-session.ts` (referee state machine) — after its statuses are inlined where still needed.
- `src/components/wallet/privy-connect-dialog.tsx` (subsumed by `<ConnectWallet/>`).
- The `ml_privy_session` flag (replaced by `ml_wallet`).

> **Note on `useUnifiedWallet`/`useStarkZapWallet`:** the spec's end-state deletes them. To keep this prod-down fix safe and reviewable, this plan keeps them as **compatibility reads** and defers the consumer codemod + final deletion to a follow-up (Task 13, optional). The referee *logic* is deleted now; only the names survive as thin reads.

---

## Task 1: Core types

**Files:**
- Create: `src/lib/wallet-types.ts`

- [ ] **Step 1: Write the types**

```ts
import type { Call } from "starknet";

export type WalletType = "argent" | "braavos" | "injected" | "cartridge" | "privy";

/** The single active wallet. Built once at connect time; routing is structural. */
export interface ActiveWallet {
  type: WalletType;
  address: string;
  /** Normalized execution → returns the tx hash after on-chain confirmation. */
  execute: (calls: Call[]) => Promise<string>;
}

/** localStorage key recording the one wallet the user last explicitly chose. */
export const WALLET_STORAGE_KEY = "ml_wallet";

export type PersistedWalletType = "argent" | "braavos" | "cartridge" | "privy";

export function readPersistedWallet(): PersistedWalletType | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(WALLET_STORAGE_KEY);
  return v === "argent" || v === "braavos" || v === "cartridge" || v === "privy" ? v : null;
}

export function writePersistedWallet(type: PersistedWalletType): void {
  if (typeof window !== "undefined") window.localStorage.setItem(WALLET_STORAGE_KEY, type);
}

export function clearPersistedWallet(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
    window.localStorage.removeItem("ml_privy_session"); // retire the old flag
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wallet-types.ts
git commit -m "feat(wallet): ActiveWallet types + ml_wallet persistence helpers"
```

---

## Task 2: Execution adapters

These reuse the **existing, proven** execution semantics: injected → `account.execute` through the AVNU paymaster + `waitForReceipt`; starkzap → `wallet.execute(calls)` + `tx.wait()`. We move `waitForReceipt` into its **own module** so the adapter and the hook share one copy WITHOUT a circular import (`wallet-context → wallet-adapters → use-paymaster-transaction → wallet-context` would otherwise form a cycle).

**Files:**
- Create: `src/lib/wait-for-receipt.ts`
- Create: `src/lib/wallet-adapters.ts`
- Modify: `src/hooks/use-paymaster-transaction.ts` (import `waitForReceipt` from the new module instead of declaring it)

- [ ] **Step 1: Extract `waitForReceipt` into its own module**

Create `src/lib/wait-for-receipt.ts` and move the existing `waitForReceipt` function from `use-paymaster-transaction.ts` into it verbatim, exported, keeping its `starknetProvider` import:

```ts
import { starknetProvider } from "@/lib/starknet";

/** Wait for on-chain finality and detect reverts. (Moved from use-paymaster-transaction.) */
export async function waitForReceipt(hash: string): Promise<
  | { ok: true; polledOk?: boolean }
  | { ok: false; reason: string }
> {
  try {
    const receipt = await starknetProvider.waitForTransaction(hash, { retryInterval: 3000 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = receipt as any;
    const executionStatus: string | undefined = r?.execution_status ?? r?.status;
    const isReverted =
      executionStatus === "REVERTED" ||
      executionStatus === "REJECTED" ||
      Boolean(r?.revert_reason);
    if (isReverted) {
      const reason: string =
        r?.revert_reason ?? `Transaction reverted (${executionStatus ?? "unknown"})`;
      return { ok: false, reason };
    }
    return { ok: true, polledOk: true };
  } catch (waitErr) {
    console.warn("[waitForReceipt] receipt polling failed", {
      hash,
      err: waitErr instanceof Error ? waitErr.message : String(waitErr),
    });
    return { ok: true, polledOk: false };
  }
}
```

Then in `src/hooks/use-paymaster-transaction.ts`, delete the local `waitForReceipt` declaration and add `import { waitForReceipt } from "@/lib/wait-for-receipt";` (the `starknetProvider` import may now be unused there — remove it if so).

- [ ] **Step 2: Write the adapters**

```ts
"use client";

import type { Account, Call } from "starknet";
import type { WalletInterface } from "starkzap";
import { waitForReceipt } from "@/lib/wait-for-receipt";

/**
 * Injected (Argent/Braavos): execute through the AVNU paymaster that
 * StarknetConfig wraps around account.execute, then confirm on-chain.
 * Mirrors the non-StarkZap branch of the old executeAuto.
 */
export function makeInjectedExecute(account: Account) {
  return async (calls: Call[]): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await account.execute(calls as any);
    const hash: string = response.transaction_hash;
    const result = await waitForReceipt(hash);
    if (!result.ok) throw new Error(result.reason);
    return hash;
  };
}

/**
 * StarkZap (Cartridge/Privy): the SDK handles gas via its configured
 * sponsorship; it waits internally. Mirrors the szWallet branch of the
 * old executeAuto (no feeMode arg — sponsorship is set on the SDK).
 */
export function makeStarkzapExecute(wallet: WalletInterface) {
  return async (calls: Call[]): Promise<string> => {
    const tx = await wallet.execute(calls);
    await tx.wait();
    return tx.hash;
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wait-for-receipt.ts src/lib/wallet-adapters.ts src/hooks/use-paymaster-transaction.ts
git commit -m "feat(wallet): injected + starkzap execute adapters (shared waitForReceipt module)"
```

---

## Task 3: Slim `StarkZapWalletProvider` to an onboarding/holder (no priority)

The provider keeps owning StarkZap onboarding (Cartridge/Privy) and the resulting `WalletInterface`, plus the connect/disconnect actions and the PrivyConnector mount. We **remove nothing that `use-tx`/`use-siws-token`/`use-paymaster` read** (`wallet`, `walletType`, `address`, `connectCartridge`, `connectPrivy`, `disconnect`, `privyUser`, `session`, `isConnecting`, `error`). No referee lives here — it never compared against injected, so this file already has no priority logic; the change is only that `disconnect()` now also clears `ml_wallet`, and connect actions persist `ml_wallet`.

**Files:**
- Modify: `src/contexts/starkzap-wallet-context.tsx`

- [ ] **Step 1: Persist `ml_wallet` on Cartridge connect**

In `connectCartridge`, immediately after `setSession(walletReady("cartridge", ...))` on success, add:

```ts
import { writePersistedWallet, clearPersistedWallet } from "@/lib/wallet-types";
// ...inside connectCartridge success:
writePersistedWallet("cartridge");
```

- [ ] **Step 2: Persist `ml_wallet` on Privy connect**

In `connectPrivy`, replace `localStorage.setItem("ml_privy_session", "1");` with:

```ts
writePersistedWallet("privy");
```

- [ ] **Step 3: Clear `ml_wallet` on disconnect**

In `disconnect`, replace the `if (walletType === "privy") { localStorage.removeItem("ml_privy_session"); }` block with:

```ts
clearPersistedWallet();
```

(unconditional — covers cartridge and privy).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/starkzap-wallet-context.tsx src/lib/wallet-types.ts
git commit -m "refactor(wallet): StarkZap context persists ml_wallet, clears on disconnect"
```

---

## Task 4: `WalletProvider` — the single active-wallet slot

This is the heart. It composes injected (starknet-react) + StarkZap (the slimmed context) into one slot. **Rule: the slot is `null` unless a wallet is connected, and its identity is driven by `ml_wallet` for SZ types and by the injected connection otherwise. Only `connect(type)` (user action) changes `ml_wallet`.**

**Files:**
- Create: `src/contexts/wallet-context.tsx`

- [ ] **Step 1: Write the provider**

```tsx
"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import type { Call } from "starknet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { makeInjectedExecute, makeStarkzapExecute } from "@/lib/wallet-adapters";
import {
  clearPersistedWallet,
  type ActiveWallet,
  type WalletType,
} from "@/lib/wallet-types";

interface WalletContextValue {
  active: ActiveWallet | null;
  isConnecting: boolean;
  error: string | null;
  connect: (type: WalletType, connector?: Connector) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Injected (Argent/Braavos) via starknet-react. autoConnect (set in
  // StarknetProvider) restores the last injected connector on reload — safe
  // now that Privy no longer auto-mounts to race it.
  const {
    account: injectedAccount,
    address: injectedAddress,
    isConnected: injectedConnectedRaw,
    connector: injectedConnector,
    status: injectedStatus,
  } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect: injectedDisconnect } = useDisconnect();
  const injectedConnected = injectedConnectedRaw ?? false;

  // StarkZap (Cartridge/Privy) — onboarding + the active WalletInterface.
  const {
    wallet: szWallet,
    walletType: szType,
    address: szAddress,
    isConnecting: szConnecting,
    error: szError,
    connectCartridge,
    connectPrivy,
    disconnect: szDisconnect,
  } = useStarkZapWallet();

  const injectedType: WalletType = useMemo(() => {
    const id = injectedConnector?.id?.toLowerCase();
    if (id === "argentx" || id === "argent") return "argent";
    if (id === "braavos") return "braavos";
    return "injected";
  }, [injectedConnector]);

  // The slot. StarkZap wins ONLY because the user explicitly chose it (its
  // session is set exclusively by connectCartridge/connectPrivy + persisted
  // ml_wallet); there is no background path that sets szWallet anymore.
  const active: ActiveWallet | null = useMemo(() => {
    if (szWallet && szAddress && (szType === "cartridge" || szType === "privy")) {
      return { type: szType, address: szAddress, execute: makeStarkzapExecute(szWallet) };
    }
    if (injectedConnected && injectedAddress && injectedAccount) {
      return {
        type: injectedType,
        address: injectedAddress,
        execute: makeInjectedExecute(injectedAccount),
      };
    }
    return null;
  }, [szWallet, szAddress, szType, injectedConnected, injectedAddress, injectedAccount, injectedType]);

  const isConnecting =
    szConnecting ||
    injectedStatus === "connecting" ||
    injectedStatus === "reconnecting";

  const connect = useCallback(
    async (type: WalletType, connector?: Connector) => {
      if (type === "cartridge") {
        await connectCartridge();
        return;
      }
      if (type === "privy") {
        await connectPrivy();
        return;
      }
      // injected: explicit pick supersedes any StarkZap session.
      if (!connector) throw new Error("Injected connect requires a connector");
      await connectAsync({ connector });
      // Retire any active/stale StarkZap session so it can't outrank or
      // silently restore over the wallet the user just picked.
      szDisconnect(); // also clears ml_wallet
      // Persist the injected choice as the restore target.
      const { writePersistedWallet } = await import("@/lib/wallet-types");
      writePersistedWallet(injectedType === "injected" ? "argent" : injectedType);
    },
    [connectCartridge, connectPrivy, connectAsync, szDisconnect, injectedType],
  );

  const disconnect = useCallback(() => {
    if (active?.type === "cartridge" || active?.type === "privy") {
      szDisconnect();
    } else {
      injectedDisconnect();
    }
    clearPersistedWallet();
  }, [active, szDisconnect, injectedDisconnect]);

  const value = useMemo<WalletContextValue>(
    () => ({ active, isConnecting, error: szError, connect, disconnect }),
    [active, isConnecting, szError, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    return {
      active: null,
      isConnecting: false,
      error: null,
      connect: async () => {},
      disconnect: () => {},
    };
  }
  return ctx;
}
```

> **Note on injected persist:** `writePersistedWallet` only accepts `argent|braavos|cartridge|privy`. The `injectedType === "injected"` fallback maps unknown injected ids to `"argent"` purely as a restore hint; starknet-react's own `autoConnect` is what actually reconnects the specific extension, so the exact value is non-critical.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/wallet-context.tsx
git commit -m "feat(wallet): WalletProvider — single explicitly-written active-wallet slot"
```

---

## Task 5: `useWallet()` over the slot

**Files:**
- Modify: `src/hooks/use-wallet.ts`

- [ ] **Step 1: Rewrite the hook**

```ts
"use client";

import type { Call } from "starknet";
import type { Connector } from "@starknet-react/core";
import { useWalletContext } from "@/contexts/wallet-context";
import type { WalletType } from "@/lib/wallet-types";

/**
 * The single wallet hook. Reads the one active-wallet slot owned by
 * WalletProvider. Use this everywhere — identity AND execution.
 */
export function useWallet() {
  const { active, isConnecting, error, connect, disconnect } = useWalletContext();

  const execute = async (calls: Call[]): Promise<string> => {
    if (!active) throw new Error("Wallet not connected");
    return active.execute(calls);
  };

  return {
    address: active?.address ?? null,
    isConnected: active !== null,
    isConnecting,
    walletType: (active?.type ?? null) as WalletType | null,
    error,
    connect: (type: WalletType, connector?: Connector) => connect(type, connector),
    disconnect,
    execute,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors ONLY in files that relied on the old return shape (none expected — old shape was `{address,isConnected,isConnecting,walletType}`, a subset). Fix any that appear.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-wallet.ts
git commit -m "feat(wallet): useWallet() reads the single slot (identity + execute + connect)"
```

---

## Task 6: Compatibility reads — `useUnifiedWallet` + `useWalletSession`

Keep the names/shapes so ~25 files stay untouched; delete their referee bodies.

**Files:**
- Modify: `src/hooks/use-unified-wallet.ts`
- Modify: `src/hooks/use-wallet-session.ts`

- [ ] **Step 1: `useUnifiedWallet` → alias over `useWallet`**

Replace the entire body of `src/hooks/use-unified-wallet.ts` with:

```ts
"use client";

import type { Call } from "starknet";
import { useWallet } from "@/hooks/use-wallet";

export type UnifiedWalletType =
  | "argent" | "braavos" | "injected" | "cartridge" | "privy" | null;

export interface UnifiedWallet {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  walletType: UnifiedWalletType;
  execute: (calls: Call[]) => Promise<string>;
  disconnect: () => void;
}

/** @deprecated Use useWallet(). Kept as a compatibility alias. */
export function useUnifiedWallet(): UnifiedWallet {
  const { address, isConnected, isConnecting, walletType, execute, disconnect } = useWallet();
  return {
    address: address ?? undefined,
    isConnected,
    isConnecting,
    walletType: walletType as UnifiedWalletType,
    execute,
    disconnect,
  };
}
```

- [ ] **Step 2: `useWalletSession` → read of the slot**

Replace the entire body of `src/hooks/use-wallet-session.ts` with a slot read that preserves the `ActiveWalletSession` shape its consumers (`ConnectWallet`, `nav-account-panel`) use:

```ts
"use client";

import { useWallet } from "@/hooks/use-wallet";

export type WalletSessionType =
  | "argent" | "braavos" | "injected" | "cartridge" | "privy";

export interface ActiveWalletSession {
  address: string | null;
  walletType: WalletSessionType | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useWalletSession(): ActiveWalletSession {
  const { address, walletType, isConnected, isConnecting, error } = useWallet();
  return {
    address,
    walletType: walletType as WalletSessionType | null,
    isConnected,
    isConnecting,
    error: error ?? null,
  };
}
```

> The old `WalletSession`/`session` object (state machine) is no longer surfaced here. Task 9 removes the one `nav-account-panel` use of `session`; `ConnectWallet` only reads `error`/`walletType`/`isConnecting` (Task 8). `src/lib/wallet-session.ts` is deleted in Task 11 after these.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only where `session` (the removed field) is read — handled in Tasks 8/9. Note them; don't fix unrelated files yet.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-unified-wallet.ts src/hooks/use-wallet-session.ts
git commit -m "refactor(wallet): unified-wallet + wallet-session become thin slot reads"
```

---

## Task 7: `executeAuto` defers to the slot (delete the szWallet priority branch)

`executeAuto` must no longer decide routing — the slot does. Feature hooks (`usePaymasterMinting`, etc.) that call `executeAuto` keep working because it now delegates to the active wallet. `executeGasless`/`executeSponsored`/`executeTraditional` are retained for swap/advanced flows.

**Files:**
- Modify: `src/hooks/use-paymaster-transaction.ts`

- [ ] **Step 1: Replace the `executeAuto` body**

Replace the whole `executeAuto` `useCallback` (the block starting `const executeAuto = useCallback(` through its dependency array) with:

```ts
  const executeAuto = useCallback(
    async (calls: Call[]): Promise<string | null> => {
      if (!active) {
        setError("Wallet not connected");
        return null;
      }
      setIsLoading(true);
      setError(null);
      try {
        return await active.execute(calls);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [active],
  );
```

- [ ] **Step 2: Wire `active` in**

At the top of `usePaymasterTransaction`, add:

```ts
import { useWalletContext } from "@/contexts/wallet-context";
// ...inside the hook, near the other hooks:
const { active } = useWalletContext();
```

Remove the now-unused `const { wallet: szWallet } = useStarkZapWallet();` line **only if** nothing else in the file references `szWallet` (the gasless/sponsored/traditional paths use the injected `account`, not `szWallet`, so it should be removable).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-paymaster-transaction.ts
git commit -m "refactor(wallet): executeAuto routes through the active slot, drop szWallet branch"
```

---

## Task 8: Rewire `<ConnectWallet />` to `connect(type)`

**Files:**
- Modify: `src/components/ConnectWallet.tsx`

- [ ] **Step 1: Source actions from `useWallet`**

Add `const { connect, disconnect, walletType: activeWalletType, address, isConnected, isConnecting: sessionConnecting } = useWallet();` and stop importing `useStarkZapWallet` for connect actions. Keep `useWalletSession` only if still used for `error`; otherwise read `error` from `useWallet()`.

- [ ] **Step 2: Injected buttons**

In `handleConnectorClick`, replace the body that called `connectAsync` + `szDisconnect()` + `localStorage.removeItem("ml_privy_session")` with:

```ts
const handleConnectorClick = async (connector: Connector) => {
  setConnectDialogOpen(false);
  setInjectedConnectingId(connector.id);
  try {
    const type = connector.id.toLowerCase() === "braavos" ? "braavos" : "argent";
    await connect(type, connector);
  } catch (err) {
    console.error("Failed to connect wallet", err);
    const message = err instanceof Error ? err.message : "Wallet connection failed";
    if (/user rejected|user aborted|aborted|rejected/i.test(message)) {
      toast.info("Wallet connection cancelled");
    } else {
      toast.error("Wallet connection failed", { description: message });
    }
    setConnectDialogOpen(true);
  } finally {
    setInjectedConnectingId(null);
  }
};
```

- [ ] **Step 3: Cartridge + Privy buttons**

Replace `handleCartridgeConnect`'s `await connectCartridge();` with `await connect("cartridge");`. In the Social Login button's `onClick`, replace `await connectPrivy();` with `await connect("privy");`.

- [ ] **Step 4: Disconnect**

Replace `handleDisconnect`'s body with `disconnect(); setOpen(false);`.

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ConnectWallet.tsx
git commit -m "refactor(wallet): ConnectWallet drives useWallet().connect/disconnect"
```

---

## Task 9: Rewire `nav-account-panel`

**Files:**
- Modify: `src/components/nav-account-panel.tsx`

- [ ] **Step 1: Replace wallet reads**

Source `{ address, isConnected, walletType, disconnect, isConnecting }` from `useWallet()`. Remove imports of `useUnifiedWallet`, `useWalletSession`, `useStarkZapWallet`. If the panel showed `privyUser` details, read it from `useStarkZapWallet().privyUser` (that field is retained) — keep that single import only if needed for the email/social label.

- [ ] **Step 2: Remove any `session`-object usage**

If the file read `session.status`/`session.error` from `useWalletSession`, replace with `isConnecting` / `error` from `useWallet()`.

- [ ] **Step 3: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/nav-account-panel.tsx
git commit -m "refactor(wallet): nav-account-panel reads the single useWallet()"
```

---

## Task 10: Privy connector — explicit connect + one-time deploy, no silent reconnect

**Files:**
- Modify: `src/contexts/privy-connector.tsx`

- [ ] **Step 1: Delete the silent auto-reconnect**

In the "Step 2: once authenticated, run the onboarding pipeline" effect, remove the `isAutoReconnect` path entirely. The effect should run onboarding **only** when `needsOnboard` is true (explicit connect). Replace the effect's gate logic with:

```ts
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (onboardingRef.current) return;
    if (walletType === "cartridge") return;
    if (!needsOnboard) return; // explicit connect only — no silent reconnect

    onboardingRef.current = true;
    setNeedsOnboard(false);

    runOnboarding(false)
      .catch((err) => {
        console.error("[Privy] onboarding failed:", err);
        setWallet(null);
        setSession(walletError("privy", getFriendlyWalletError(err).message));
      })
      .finally(() => {
        onboardingRef.current = false;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, needsOnboard]);
```

Remove the now-unused `injectedConnected` (`useAccount`) import/var and the `ml_privy_session` localStorage read.

- [ ] **Step 2: Make deploy idempotent on reconnect**

In `runOnboarding`, the existing `sdk.onboard({ strategy: Privy, deploy: "if_needed" })` already deploys only if needed — keep it. This satisfies "eager deploy once, no-op after." No change needed beyond Step 1.

- [ ] **Step 3: Reconnect-on-reload for Privy lives in providers (Task 11)**

When `ml_wallet === "privy"`, providers.tsx mounts Privy and triggers an explicit reconnect by setting `pendingPrivyConnect` once Privy is `ready && authenticated`. Add a small effect:

```ts
  // Page-reload restore: if Privy is the persisted wallet and the session is
  // still authenticated, run onboarding once (explicit-equivalent, not silent).
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (onboardingRef.current || needsOnboard) return;
    if (walletType === "privy") return; // already active
    const persisted = typeof window !== "undefined"
      ? window.localStorage.getItem("ml_wallet") : null;
    if (persisted !== "privy") return;
    setNeedsOnboard(true); // re-uses the explicit pipeline above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);
```

This restores **only** Privy and only when it is the persisted choice — never over an injected pick (if the user later picks injected, `connect()` cleared `ml_wallet`, so `persisted !== "privy"`).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/contexts/privy-connector.tsx
git commit -m "fix(wallet): Privy connects explicitly + restores only when persisted, no silent reconnect"
```

---

## Task 11: Providers tree — add WalletProvider, gate Privy mount on ml_wallet

**Files:**
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Nest WalletProvider inside StarkZap**

Import `WalletProvider` and wrap the children: inside `<StarkZapWalletProvider ...>`, wrap the existing subtree (`<Aurora/>`, `<UserRegistration/>`, shell, etc.) in `<WalletProvider>…</WalletProvider>`.

- [ ] **Step 2: Gate the global Privy auto-mount on `ml_wallet`**

Replace the first `useEffect` (the one reading `localStorage.getItem("ml_privy_session")`) with:

```ts
  useEffect(() => {
    if (localStorage.getItem("ml_wallet") === "privy") {
      loadPrivyStack().then(activatePrivy).catch((err) => {
        console.error("[Privy] restore load failed:", err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

The mint-landing pre-mount effect (`/br/`, `/mint`) stays unchanged — those routes still pre-load Privy for the funnel.

- [ ] **Step 3: Remove `privy-connect-dialog` mount**

Delete the `<PrivyConnectDialog />` line and its import (subsumed by `<ConnectWallet/>`).

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/providers.tsx
git commit -m "refactor(wallet): mount WalletProvider; Privy auto-mounts only when ml_wallet=privy"
```

---

## Task 12: Delete dead code + final type/build gate

**Files:**
- Delete: `src/lib/wallet-session.ts`
- Delete: `src/components/wallet/privy-connect-dialog.tsx`

- [ ] **Step 1: Confirm no live imports remain**

Run: `grep -rn "wallet-session\"\|privy-connect-dialog\|ml_privy_session" src/`
Expected: only matches inside the files being deleted (and none in `starkzap-wallet-context.tsx`/`privy-connector.tsx` after Tasks 3/10). If `starkzap-wallet-context.tsx` still imports `walletReady`/`walletError`/etc. from `wallet-session`, **keep `wallet-session.ts`** (those status builders are still used by the StarkZap context/PrivyConnector) — in that case do NOT delete it; only delete `privy-connect-dialog.tsx`. Decide based on grep output.

- [ ] **Step 2: Delete the files that are truly orphaned**

```bash
git rm src/components/wallet/privy-connect-dialog.tsx
# Only if Step 1 showed no remaining importers:
# git rm src/lib/wallet-session.ts
```

- [ ] **Step 3: Full gate**

Run: `npx tsc --noEmit && npm run build`
Expected: both pass clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(wallet): remove privy-connect-dialog + dead session referee"
```

---

## Task 13 (manual verification gate — REQUIRED before merge)

No code; run the matrix and record results in the PR description. **Do not merge until every row passes.** Use a browser with both an injected extension (Braavos/Ready) installed and a Privy-capable email.

- [ ] **Injected only:** connect Braavos → `useWallet().walletType === "braavos"`, address is the Braavos address. Mint / list / buy / make-offer each execute from Braavos (check the explorer tx sender).
- [ ] **Privy only:** fresh browser, connect via Email → account deploys once (check explorer), address is the Privy address. Mint executes from Privy.
- [ ] **The mixing repro (the bug):** connect Privy, THEN connect Braavos → `walletType === "braavos"`; execute a tx → sender is Braavos, NOT Privy. Then reload → only Braavos restores (Privy not mounted). Then reverse: disconnect, connect Braavos, then connect Privy → active is Privy.
- [ ] **Reload persistence:** for each of argent/braavos/cartridge/privy: connect, reload → the same wallet restores, no flicker to a different one, no second wallet appears.
- [ ] **Disconnect:** disconnect clears the slot and `ml_wallet`; reload stays disconnected.
- [ ] **Funnel:** `/br/mint` and `/airdrop` — Privy inline login still works; GenesisMint mints from the Privy account.
- [ ] **Cartridge:** connect Cartridge → marketplace register_order/fulfill_order still execute (policies intact).
- [ ] **Swap/Creator Coin:** `/swap` and a coin page buy still execute (these use `useUnifiedWallet`/`useSwap` — confirm the alias works).

---

## Self-review notes (already applied)

- **Spec coverage:** single-slot (Task 4), explicit-only writes (Task 4 `connect` + Task 8/9 UI), restore-only-chosen (Task 10 §3 + Task 11 §2), structural execute routing (Tasks 2/7), one-time eager Privy deploy (Task 10 §2), deletions (Tasks 6/12), StarkZap kept (Task 3 slim, not removed). All covered.
- **Type consistency:** `ActiveWallet`/`WalletType` (Task 1) used identically in Tasks 2/4/5; `execute(calls): Promise<string>` consistent across adapters, slot, and `useWallet`. `useUnifiedWallet`/`useWalletSession` shapes preserved (Task 6).
- **Deviation flagged:** `useUnifiedWallet`/`useStarkZapWallet` kept as compatibility reads (not deleted as the spec's end-state says) to keep the prod-down fix small; consumer codemod + deletion deferred to an optional follow-up. The referee *logic* is deleted now.
