# Privy + StarkZap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Privy (email/Google/Twitter social login) as a third independent wallet connection strategy alongside injected wallets and Cartridge, using StarkZap's `OnboardStrategy.Privy` with server-managed keys via Privy HSM.

**Architecture:** `@privy-io/react-auth` provides the auth layer (PrivyProvider + usePrivy) on the frontend. `@privy-io/node` handles wallet creation and signing on the server. StarkZap bridges the Privy identity to a deployed ArgentX v0.5.0 Starknet account. Auth tokens are passed as Bearer headers on both the wallet-creation route and the signing route (via StarkZap's `headers` factory).

**Tech Stack:** `@privy-io/react-auth`, `@privy-io/node`, `starkzap` (already installed), Next.js App Router API routes

**Spec:** `docs/superpowers/specs/2026-05-12-privy-starkzap-design.md`

---

## File Map

| Action | File |
|---|---|
| Create | `src/lib/privy-server.ts` |
| Create | `src/app/api/wallet/starknet/route.ts` |
| Create | `src/app/api/wallet/sign/route.ts` |
| Modify | `src/app/providers.tsx` |
| Modify | `src/contexts/starkzap-wallet-context.tsx` |
| Modify | `src/components/ConnectWallet.tsx` |

---

## Task 1: Install packages

**Files:** `package.json`

- [ ] **Step 1: Install the two Privy packages**

```bash
npm install @privy-io/react-auth @privy-io/node
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
npx tsc --noEmit
```

Expected: zero errors (new packages add their own types).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @privy-io/react-auth and @privy-io/node"
```

---

## Task 2: Privy server client

**Files:**
- Create: `src/lib/privy-server.ts`

This is a shared singleton — both API routes import it so the `PrivyClient` is not re-instantiated on every request.

- [ ] **Step 1: Create the file**

```typescript
// src/lib/privy-server.ts
import { PrivyClient } from "@privy-io/node";

export const privyServer = new PrivyClient({
  appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/privy-server.ts
git commit -m "feat: add Privy server client singleton"
```

---

## Task 3: Wallet creation API route

**Files:**
- Create: `src/app/api/wallet/starknet/route.ts`

This route receives a Privy access token, verifies it, and creates (or retrieves) the caller's Starknet wallet via Privy's HSM. The create call is idempotent — Privy returns the existing wallet if one already exists for the `userId`.

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/wallet/starknet/route.ts
import { NextRequest, NextResponse } from "next/server";
import { privyServer } from "@/lib/privy-server";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const claims = await privyServer.verifyAuthToken(token);
    const userId = claims.userId;

    const wallet = await privyServer.wallets().create({
      chain_type: "starknet",
      user_id: userId,
    });

    return NextResponse.json({
      id: wallet.id,
      address: wallet.address,
      publicKey: wallet.public_key,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `wallet.public_key` or `wallet.address` types are wrong, check the `@privy-io/node` types with `npx tsc --noEmit 2>&1` and adjust the field names to match what the SDK actually returns.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wallet/starknet/route.ts
git commit -m "feat: add /api/wallet/starknet — Privy Starknet wallet create/retrieve"
```

---

## Task 4: Signing API route

**Files:**
- Create: `src/app/api/wallet/sign/route.ts`

StarkZap calls this endpoint whenever it needs to produce a Starknet signature (for transactions, typed data, etc.). The request carries the Privy access token as a Bearer header (passed via StarkZap's `headers` factory, set up in Task 6). The route verifies the token, confirms the wallet belongs to that user, then delegates signing to Privy's HSM.

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/wallet/sign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { privyServer } from "@/lib/privy-server";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { walletId: string; hash: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const { walletId, hash } = body;
  if (!walletId || !hash) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const claims = await privyServer.verifyAuthToken(token);
    const userId = claims.userId;

    // Confirm the wallet belongs to the authenticated user
    const user = await privyServer.getUserById(userId);
    const ownsWallet = user.linkedAccounts.some(
      (acc) => acc.type === "wallet" && (acc as { id?: string }).id === walletId
    );
    if (!ownsWallet) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await privyServer.wallets().rawSign(walletId, {
      params: { hash },
    });

    return NextResponse.json({ signature: result.signature });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `linkedAccounts` fields differ from what the types say, use `console.log(JSON.stringify(user.linkedAccounts[0]))` in development to inspect the actual shape, then fix the ownership check.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wallet/sign/route.ts
git commit -m "feat: add /api/wallet/sign — Privy HSM signing endpoint"
```

---

## Task 5: Add PrivyProvider to providers.tsx

**Files:**
- Modify: `src/app/providers.tsx`

`PrivyProvider` is the auth layer. It wraps the rest of `Providers` so that `usePrivy()` is available inside `StarkZapWalletProvider`. Ready and Cartridge users never call `usePrivy()` — the provider being in the tree has zero effect on them.

- [ ] **Step 1: Add the import and config at the top of providers.tsx**

Add after the existing imports (around line 15, before the `Shell` function):

```typescript
import { PrivyProvider } from "@privy-io/react-auth";

const PRIVY_CONFIG = {
  loginMethods: ["email", "google", "twitter"] as const,
  embeddedWallets: { createOnLogin: "off" as const },
  appearance: { theme: "dark" as const },
};
```

- [ ] **Step 2: Wrap the existing Providers JSX with PrivyProvider**

The `Providers` function currently returns this (simplified):
```tsx
<ThemeProvider ...>
  <SWRConfig ...>
    <StarknetProvider>
      <StarkZapWalletProvider>
        ...
      </StarkZapWalletProvider>
    </StarknetProvider>
  </SWRConfig>
</ThemeProvider>
```

Update it to:
```tsx
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={PRIVY_CONFIG}
    >
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <SWRConfig
          value={{
            onError: (err: unknown) => {
              const msg = err instanceof Error ? err.message : "Something went wrong";
              if (
                msg.includes("401") || msg.includes("403") ||
                msg.includes("Missing") ||
                msg.includes("Failed to fetch") || msg.includes("Load failed") ||
                msg.includes("NetworkError") || msg.includes("network")
              ) return;
              toast.error(msg);
            },
          }}
        >
          <StarknetProvider>
            <StarkZapWalletProvider>
              <Aurora />
              <Shell>{children}</Shell>
              <CartDrawer />
              <NotificationSpotlight />
              <Toaster richColors position="bottom-right" />
            </StarkZapWalletProvider>
          </StarknetProvider>
        </SWRConfig>
      </ThemeProvider>
    </PrivyProvider>
  );
}
```

- [ ] **Step 3: Type-check and verify dev server starts**

```bash
npx tsc --noEmit && npm run dev
```

Expected: zero type errors, dev server starts without console errors. Stop the dev server (`Ctrl+C`) after confirming.

- [ ] **Step 4: Commit**

```bash
git add src/app/providers.tsx
git commit -m "feat: add PrivyProvider as auth layer in providers.tsx"
```

---

## Task 6: Extend StarkZapWalletProvider with Privy

**Files:**
- Modify: `src/contexts/starkzap-wallet-context.tsx`

Add `connectPrivy()`, `privyUser` state, auto-reconnect on mount, and `logout()` on disconnect. `connectPrivy` shows the Privy social login modal, then exchanges the resulting access token for a Starknet wallet via the API routes created in Tasks 3–4. The `headers` factory in `resolve` is called by StarkZap on every signing request, ensuring the access token is always fresh.

- [ ] **Step 1: Replace the full file**

```typescript
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { User } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import type { WalletInterface } from "starkzap";
import { getStarkZapSdk } from "@/lib/starkzap";
import {
  COLLECTION_721_CONTRACT,
  MARKETPLACE_721_CONTRACT,
  MARKETPLACE_1155_CONTRACT,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Cartridge session policies for Medialane contracts
// ---------------------------------------------------------------------------

const CARTRIDGE_POLICIES = [
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
  walletType: StarkZapWalletType | null;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  privyUser: User | null;
  connectCartridge: () => Promise<void>;
  connectPrivy: () => Promise<void>;
  disconnect: () => void;
}

const StarkZapWalletContext = createContext<StarkZapWalletCtx | undefined>(
  undefined
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function StarkZapWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [walletType, setWalletType] = useState<StarkZapWalletType | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privyUser, setPrivyUser] = useState<User | null>(null);

  const { login, logout, authenticated, getAccessToken, user } = usePrivy();

  // ---------------------------------------------------------------------------
  // Internal: initialise StarkZap wallet after Privy auth is established
  // ---------------------------------------------------------------------------

  const initPrivyWallet = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) throw new Error("No Privy access token");

    const res = await fetch("/api/wallet/starknet", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to create Privy Starknet wallet");
    const walletData = (await res.json()) as {
      id: string;
      address: string;
      publicKey: string;
    };

    const sdk = getStarkZapSdk();
    const result = await sdk.onboard({
      strategy: OnboardStrategy.Privy,
      accountPreset: "argentXV050",
      privy: {
        resolve: async () => ({
          walletId: walletData.id,
          publicKey: walletData.publicKey,
          serverUrl: "/api/wallet/sign",
          headers: async () => {
            const freshToken = await getAccessToken();
            return freshToken ? { Authorization: `Bearer ${freshToken}` } : {};
          },
        }),
      },
      deploy: "if_needed",
    });

    setWallet(result.wallet);
    setWalletType("privy");
    setAddress(result.wallet.address as unknown as string);
    setPrivyUser(user ?? null);
  }, [getAccessToken, user]);

  // ---------------------------------------------------------------------------
  // Connect Cartridge
  // ---------------------------------------------------------------------------

  const connectCartridge = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const sdk = getStarkZapSdk();
      const result = await sdk.onboard({
        strategy: OnboardStrategy.Cartridge,
        cartridge: {
          policies: CARTRIDGE_POLICIES,
        },
        deploy: "if_needed",
      });

      setWallet(result.wallet);
      setWalletType("cartridge");
      setAddress(result.wallet.address as unknown as string);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect Cartridge"
      );
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Connect Privy (user-initiated — shows the Privy login modal)
  // ---------------------------------------------------------------------------

  const connectPrivy = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      if (!authenticated) {
        await login();
      }
      await initPrivyWallet();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect with Privy"
      );
    } finally {
      setIsConnecting(false);
    }
  }, [authenticated, login, initPrivyWallet]);

  // ---------------------------------------------------------------------------
  // Auto-reconnect: restore Privy wallet on page reload if session is active
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (authenticated && !wallet && walletType !== "cartridge") {
      initPrivyWallet().catch((err) => {
        console.error("Privy auto-reconnect failed:", err);
      });
    }
    // intentionally omit wallet/walletType — only re-run when auth changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(() => {
    if (walletType === "privy") {
      logout().catch(console.error);
    }
    setWallet(null);
    setWalletType(null);
    setAddress(null);
    setError(null);
    setPrivyUser(null);
  }, [walletType, logout]);

  return (
    <StarkZapWalletContext.Provider
      value={{
        wallet,
        walletType,
        address,
        isConnecting,
        error,
        privyUser,
        connectCartridge,
        connectPrivy,
        disconnect,
      }}
    >
      {children}
    </StarkZapWalletContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const STARKZAP_DEFAULT_CTX: StarkZapWalletCtx = {
  wallet: null,
  walletType: null,
  address: null,
  isConnecting: false,
  error: null,
  privyUser: null,
  connectCartridge: async () => {},
  connectPrivy: async () => {},
  disconnect: () => {},
};

export function useStarkZapWallet(): StarkZapWalletCtx {
  const ctx = useContext(StarkZapWalletContext);
  return ctx ?? STARKZAP_DEFAULT_CTX;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors. If `user` from `usePrivy()` is typed differently than `User`, adjust the import — `@privy-io/react-auth` re-exports the `User` type.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/starkzap-wallet-context.tsx
git commit -m "feat: extend StarkZapWalletProvider with Privy connect + auto-reconnect"
```

---

## Task 7: Update ConnectWallet UI

**Files:**
- Modify: `src/components/ConnectWallet.tsx`

Add a "Social Login" section to the connect dialog and a Privy badge for the connected state. A single "Sign in with Email or Social" button triggers the Privy modal (which handles the email/Google/Twitter choice). Show the user's email or social display name in the account sheet when connected via Privy.

- [ ] **Step 1: Add Mail import to the lucide imports**

The existing imports line (around line 41) — add `Mail` to the destructured list:

```typescript
import {
  Wallet,
  LogOut,
  User,
  History,
  Settings,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Copy,
  Layers,
  BarChart3,
  PlusCircle,
  Box,
  Rocket,
  ArrowRightLeft,
  Gamepad2,
  Loader2,
  AlertCircle,
  Mail,
} from "lucide-react";
```

- [ ] **Step 2: Import connectPrivy and privyUser from useStarkZapWallet**

The existing destructure of `useStarkZapWallet()` (around line 119) — add the two new fields:

```typescript
const {
  address: szAddress,
  walletType: szType,
  isConnecting,
  error: szError,
  connectCartridge,
  connectPrivy,
  privyUser,
  disconnect: szDisconnect,
} = useStarkZapWallet();
```

- [ ] **Step 3: Update getWalletBadge to handle "privy"**

Replace the existing `getWalletBadge` function with:

```typescript
function getWalletBadge(
  walletType: "injected" | "cartridge" | "privy" | null
): WalletBadgeInfo | null {
  if (walletType === "cartridge") {
    return {
      label: "Cartridge",
      icon: <Gamepad2 className="h-3 w-3" />,
      className: "border-purple-500/30 text-purple-400 bg-purple-500/5",
      hint: "Auto-gasless",
    };
  }
  if (walletType === "privy") {
    return {
      label: "Social Login",
      icon: <Mail className="h-3 w-3" />,
      className: "border-blue-500/30 text-blue-400 bg-blue-500/5",
      hint: "Gasless",
    };
  }
  if (walletType === "injected") {
    return {
      label: "Browser Wallet",
      icon: <Wallet className="h-3 w-3" />,
      className: "border-emerald-500/20 text-emerald-400 bg-emerald-500/5",
    };
  }
  return null;
}
```

- [ ] **Step 4: Update activeWalletType in the component body**

The existing `activeWalletType` derivation (around line 134) casts to `"cartridge"`. Widen it:

```typescript
const activeWalletType = hasStarkZap
  ? (szType as "cartridge" | "privy")
  : injectedConnected
    ? ("injected" as const)
    : null;
```

- [ ] **Step 5: Add a Privy identity line in the account sheet header**

Inside the connected account sheet, after the address block (around line 276), add:

```tsx
{activeWalletType === "privy" && privyUser && (
  <p className="text-xs text-muted-foreground mt-0.5">
    {privyUser.email?.address ??
      privyUser.google?.name ??
      privyUser.twitter?.name ??
      "Social Account"}
  </p>
)}
```

- [ ] **Step 6: Add the Social Login section to the connect dialog**

In the not-connected dialog, after the Cartridge section (after the closing `</section>` of Cartridge, around line 467), add:

```tsx
<div className="border-t border-border/50" />

{/* ── Social Login (Privy) ─────────────────────── */}
<section>
  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
    Social Login
  </p>
  <p className="text-xs text-muted-foreground mb-2">
    Email · Google · Twitter — no seed phrase required
  </p>
  <Button
    variant="outline"
    className="w-full justify-start gap-3"
    onClick={async () => {
      setConnectDialogOpen(false);
      try {
        await connectPrivy();
      } catch {
        // error surfaced via szError
      }
    }}
    disabled={isConnecting}
  >
    <Mail className="h-4 w-4 shrink-0 text-blue-400" />
    <span>
      {isConnecting ? "Connecting…" : "Sign in with Email or Social"}
    </span>
    {isConnecting && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
  </Button>
</section>
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ConnectWallet.tsx
git commit -m "feat: add Social Login (Privy) to ConnectWallet dialog"
```

---

## Task 8: End-to-end verification

**Files:** none

- [ ] **Step 1: Run lint and type-check**

```bash
npm run lint && npx tsc --noEmit
```

Expected: zero errors, zero warnings.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Verify env vars are set**

Open `.env.local` and confirm these two values are present and non-empty:
```
NEXT_PUBLIC_PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
```

If either is missing, obtain them from the Privy dashboard (dashboard.privy.io → your app → Settings → App ID and App Secret).

- [ ] **Step 4: Test Social Login flow**

1. Open http://localhost:3000
2. Click the wallet icon → "Connect Wallet" dialog opens
3. Confirm three sections exist: Browser Wallets, Cartridge Controller, Social Login
4. Click "Sign in with Email or Social"
5. Privy modal appears with email/Google/Twitter options
6. Complete login with email OTP
7. Confirm the dialog closes and the wallet icon shows a green dot (connected)
8. Click wallet icon → account sheet shows address + "Social Login" badge + email address
9. Confirm `useWallet()` returns `{ address, isConnected: true }` (check via browser console: `window.__wallet` if exposed, or just confirm UI elements that require a wallet show correctly)

- [ ] **Step 5: Test transaction signing (if on testnet)**

If `NEXT_PUBLIC_STARKNET_NETWORK=sepolia`:
1. Navigate to `/marketplace` while connected via Privy
2. Attempt a listing or offer — this triggers SNIP-12 typed data signing
3. Confirm the sign request reaches `/api/wallet/sign` (check network tab)
4. Confirm a transaction hash is returned and `useTxTracker` picks it up

- [ ] **Step 6: Test disconnect + reconnect**

1. Open account sheet → Disconnect
2. Confirm wallet icon returns to disconnected state
3. Reload the page
4. Confirm the user is NOT auto-reconnected (Privy logout clears the session)
5. Connect again via Social Login
6. Reload the page
7. Confirm the wallet auto-reconnects without showing the login modal (session persistence)

- [ ] **Step 7: Test that Ready/Cartridge flows are unaffected**

1. Disconnect Privy wallet
2. Connect via Argent (Ready) injected wallet — confirm normal flow
3. Disconnect, then connect via Cartridge — confirm normal flow
4. Both should work exactly as before with no Privy involvement

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat: Privy social login integration complete — email/Google/Twitter onboarding via StarkZap"
```
