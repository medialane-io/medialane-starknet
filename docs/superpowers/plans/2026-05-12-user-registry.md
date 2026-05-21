# User Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the backend `User` model with wallet type and app source, add a frictionless `POST /v1/users/register` endpoint, wire a silent registration hook into medialane-dapp on wallet connect, and update medialane-io to pass wallet type on onboarding — giving us a verifiable cross-app user count for the Starknet Foundation grant.

**Architecture:** The backend gets additive schema changes (no PK migration — `walletAddress` stays as `@id`, `chain` is added as a non-key field with `STARKNET` default). The new `/v1/users/register` endpoint uses inline `apiKeyAuth` since the users router is mounted before the global apiKeyAuth middleware. The dapp fires registration silently via `useRegisterUser` called from `useWallet` whenever an address resolves. medialane-io updates its onboarding server action to POST walletType and appSource directly to the backend (bypassing the SDK to avoid a publish cycle).

**Tech Stack:** Prisma + PostgreSQL + Bun (backend), Hono (backend API), React hooks (dapp), Next.js Server Actions (medialane-io).

---

## File Map

| Action | File | Repo |
|---|---|---|
| Modify | `prisma/schema.prisma` | medialane-backend |
| Modify | `src/api/routes/users.ts` | medialane-backend |
| Create | `src/hooks/use-register-user.ts` | medialane-dapp |
| Modify | `src/hooks/use-wallet.ts` | medialane-dapp |
| Modify | `src/app/onboarding/_actions.ts` | medialane-io |

---

## Task 1: Backend — Prisma schema migration

**Files:**
- Modify: `medialane-backend/prisma/schema.prisma`

- [ ] **Step 1: Add enums and extend User model**

Open `medialane-backend/prisma/schema.prisma`. Add the two enums immediately before the `model User` block, and replace the `User` model:

```prisma
enum WalletType {
  ARGENT
  BRAAVOS
  CARTRIDGE
  PRIVY
  CHIPIPAY
  INJECTED
  UNKNOWN
}

enum AppSource {
  MEDIALANE_DAPP
  MEDIALANE_IO
  MEDIALANE_PORTAL
  MEDIALANE_SDK
}

model User {
  walletAddress String     @id
  chain         Chain      @default(STARKNET)
  walletType    WalletType @default(UNKNOWN)
  appSource     AppSource  @default(MEDIALANE_DAPP)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@index([chain])
  @@index([appSource])
  @@index([walletType])
  @@index([createdAt])
}
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/kalamaha/dev/medialane-backend
bunx prisma migrate dev --name add_wallet_type_app_source
```

Expected output:
```
✔ Generated Prisma Client
The following migration(s) have been created and applied from new schema changes:
migrations/20260512xxxxxx_add_wallet_type_app_source/migration.sql
```

- [ ] **Step 3: Verify generated client has new fields**

```bash
grep -A 10 "model User" node_modules/.prisma/client/index.d.ts | head -15
```

Expected: `walletType`, `appSource`, `chain` fields visible.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-backend
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: extend User model with chain, walletType, appSource"
```

---

## Task 2: Backend — API endpoint changes

**Files:**
- Modify: `medialane-backend/src/api/routes/users.ts`

Context: `users.ts` is mounted at `/v1/users` BEFORE the global `apiKeyAuth` middleware (see `server.ts` line 54 vs 62). This means routes in this file are NOT automatically protected by the global API key check. The existing `/me` routes use `identityAuth` inline. New routes that need `apiKeyAuth` must apply it inline the same way.

- [ ] **Step 1: Replace users.ts with extended version**

```typescript
import { Hono } from "hono";
import prisma from "../../db/client.js";
import { identityAuth } from "../middleware/identityAuth.js";
import { apiKeyAuth } from "../middleware/apiKeyAuth.js";
import type { AppEnv } from "../../types/hono.js";
import type { WalletType, AppSource, Chain } from "@prisma/client";

const users = new Hono<AppEnv>();

const VALID_WALLET_TYPES = new Set<WalletType>([
  "ARGENT", "BRAAVOS", "CARTRIDGE", "PRIVY", "CHIPIPAY", "INJECTED", "UNKNOWN",
]);
const VALID_APP_SOURCES = new Set<AppSource>([
  "MEDIALANE_DAPP", "MEDIALANE_IO", "MEDIALANE_PORTAL", "MEDIALANE_SDK",
]);
const VALID_CHAINS = new Set<Chain>(["STARKNET", "ETHEREUM", "SOLANA", "BITCOIN"]);

/**
 * POST /v1/users/register
 * Frictionless registration — authenticated by tenant API key.
 * Address provided in body. Idempotent upsert.
 * Called by medialane-dapp after wallet connects (no user signature needed).
 */
users.post("/register", async (c, next) => apiKeyAuth(c, next), async (c) => {
  const body = await c.req.json<{
    walletAddress?: string;
    walletType?: string;
    appSource?: string;
    chain?: string;
  }>();

  if (!body.walletAddress || typeof body.walletAddress !== "string") {
    return c.json({ error: "walletAddress is required" }, 400);
  }

  const walletType: WalletType =
    body.walletType && VALID_WALLET_TYPES.has(body.walletType as WalletType)
      ? (body.walletType as WalletType)
      : "UNKNOWN";

  const appSource: AppSource =
    body.appSource && VALID_APP_SOURCES.has(body.appSource as AppSource)
      ? (body.appSource as AppSource)
      : "MEDIALANE_DAPP";

  const chain: Chain =
    body.chain && VALID_CHAINS.has(body.chain as Chain)
      ? (body.chain as Chain)
      : "STARKNET";

  const user = await prisma.user.upsert({
    where: { walletAddress: body.walletAddress },
    create: { walletAddress: body.walletAddress, chain, walletType, appSource },
    update: { walletType, appSource },
  });

  return c.json({
    walletAddress: user.walletAddress,
    chain: user.chain,
    walletType: user.walletType,
    appSource: user.appSource,
    createdAt: user.createdAt,
  });
});

/**
 * POST /v1/users/me
 * Upsert the authenticated user's wallet address.
 * Accepts optional walletType and appSource in body.
 * Works with both Clerk JWT (medialane-io) and SIWS token (medialane-dapp).
 */
users.post("/me", async (c, next) => identityAuth(c, next), async (c) => {
  const walletAddress = c.get("walletAddress") as string;

  const body = await c.req.json<{
    walletType?: string;
    appSource?: string;
  }>().catch(() => ({}));

  const walletType: WalletType =
    body.walletType && VALID_WALLET_TYPES.has(body.walletType as WalletType)
      ? (body.walletType as WalletType)
      : "UNKNOWN";

  const appSource: AppSource =
    body.appSource && VALID_APP_SOURCES.has(body.appSource as AppSource)
      ? (body.appSource as AppSource)
      : "MEDIALANE_DAPP";

  const user = await prisma.user.upsert({
    where: { walletAddress },
    create: { walletAddress, walletType, appSource },
    update: { walletType, appSource },
  });

  return c.json({ walletAddress: user.walletAddress });
});

/**
 * GET /v1/users/me
 * Return the authenticated user's stored record.
 * Returns 404 if not registered yet.
 */
users.get("/me", async (c, next) => identityAuth(c, next), async (c) => {
  const walletAddress = c.get("walletAddress") as string;
  const user = await prisma.user.findUnique({ where: { walletAddress } });
  if (!user) return c.json({ error: "User not found" }, 404);
  return c.json({ walletAddress: user.walletAddress });
});

/**
 * GET /v1/users/count
 * Returns registered user count. Supports filters: chain, appSource, walletType, since (ISO date).
 * Auth: tenant API key. Used for Starknet Foundation grant reporting.
 */
users.get("/count", async (c, next) => apiKeyAuth(c, next), async (c) => {
  const { chain, appSource, walletType, since } = c.req.query();

  const where: Record<string, unknown> = {};
  if (chain && VALID_CHAINS.has(chain as Chain)) where.chain = chain;
  if (appSource && VALID_APP_SOURCES.has(appSource as AppSource)) where.appSource = appSource;
  if (walletType && VALID_WALLET_TYPES.has(walletType as WalletType)) where.walletType = walletType;
  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) where.createdAt = { gte: sinceDate };
  }

  const count = await prisma.user.count({ where });
  return c.json({ count, filters: { chain, appSource, walletType, since } });
});

export default users;
```

- [ ] **Step 2: Type-check the backend**

```bash
cd /Users/kalamaha/dev/medialane-backend
bunx tsc --noEmit 2>&1 | grep "users.ts"
```

Expected: no output (no errors in users.ts).

- [ ] **Step 3: Run the backend and test the new endpoint**

```bash
cd /Users/kalamaha/dev/medialane-backend
bun run dev &
sleep 3
# Test /register
curl -s -X POST http://localhost:3001/v1/users/register \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_LOCAL_API_KEY" \
  -d '{"walletAddress":"0x123abc","walletType":"PRIVY","appSource":"MEDIALANE_DAPP"}' | jq .
# Test /count
curl -s "http://localhost:3001/v1/users/count?chain=STARKNET" \
  -H "x-api-key: YOUR_LOCAL_API_KEY" | jq .
```

Expected for /register: `{ "walletAddress": "0x123abc", "chain": "STARKNET", "walletType": "PRIVY", ... }`
Expected for /count: `{ "count": 1, "filters": { "chain": "STARKNET", ... } }`

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-backend
git add src/api/routes/users.ts
git commit -m "feat: add /v1/users/register endpoint and /v1/users/count for grant reporting"
```

---

## Task 3: medialane-dapp — useRegisterUser hook

**Files:**
- Create: `medialane-dapp/src/hooks/use-register-user.ts`
- Modify: `medialane-dapp/src/hooks/use-wallet.ts`

Context: `useUnifiedWallet().walletType` returns `"injected" | "cartridge" | "privy" | null`. We map these to the backend enum. `MEDIALANE_BACKEND_URL` and `MEDIALANE_API_KEY` are in `src/lib/constants.ts`.

- [ ] **Step 1: Create use-register-user.ts**

Create `medialane-dapp/src/hooks/use-register-user.ts`:

```typescript
"use client";

import { useEffect } from "react";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

type BackendWalletType =
  | "ARGENT" | "BRAAVOS" | "CARTRIDGE" | "PRIVY" | "INJECTED" | "UNKNOWN";

function toBackendWalletType(
  walletType: "injected" | "cartridge" | "privy" | null
): BackendWalletType {
  if (walletType === "cartridge") return "CARTRIDGE";
  if (walletType === "privy") return "PRIVY";
  if (walletType === "injected") return "INJECTED";
  return "UNKNOWN";
}

const SESSION_KEY_PREFIX = "ml_registered_";

/**
 * Silently registers a wallet address with the Medialane backend.
 * Fires once per address per browser session — never adds user-visible friction.
 * Errors are swallowed — registration must never block the user.
 */
export function useRegisterUser(
  address: string | null,
  walletType: "injected" | "cartridge" | "privy" | null
) {
  useEffect(() => {
    if (!address || !MEDIALANE_API_KEY) return;

    const sessionKey = `${SESSION_KEY_PREFIX}${address}`;
    if (sessionStorage.getItem(sessionKey)) return;

    const backendWalletType = toBackendWalletType(walletType);

    fetch(`${MEDIALANE_BACKEND_URL}/v1/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MEDIALANE_API_KEY,
      },
      body: JSON.stringify({
        walletAddress: address,
        walletType: backendWalletType,
        appSource: "MEDIALANE_DAPP",
        chain: "STARKNET",
      }),
    })
      .then(() => sessionStorage.setItem(sessionKey, "1"))
      .catch(() => {
        // non-fatal: registration failure never surfaces to the user
      });
  }, [address, walletType]);
}
```

- [ ] **Step 2: Extend use-wallet.ts to expose walletType and fire registration**

Replace `medialane-dapp/src/hooks/use-wallet.ts` with:

```typescript
"use client";

import { useUnifiedWallet } from "./use-unified-wallet";
import { useRegisterUser } from "./use-register-user";

/**
 * Normalized wallet hook — single interface across all wallet types.
 * Use this when a component only needs to know WHO the user is.
 * Also silently registers the user with the Medialane backend on connect.
 *
 * For signing, session keys, paymaster, or execution — use the
 * platform-specific hooks (useUnifiedWallet, usePaymasterTransaction, etc.).
 */
export function useWallet() {
  const { address, isConnected, walletType } = useUnifiedWallet();

  useRegisterUser(address ?? null, walletType);

  return {
    address: address ?? null,
    isConnected,
    walletType,
  };
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/kalamaha/dev/medialane-dapp
npx tsc --noEmit 2>&1 | grep -E "use-wallet|use-register-user"
```

Expected: no output.

- [ ] **Step 4: Verify registration fires in the browser**

```bash
npm run dev
```

Open the dapp in a browser, connect a wallet, then open DevTools → Network → filter for `/v1/users/register`. You should see a POST request fire within a second of connection with status 200.

Open Application → Session Storage and confirm `ml_registered_0x...` key is set. Disconnect and reconnect — verify the POST does NOT fire again (sessionStorage gate).

- [ ] **Step 5: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add src/hooks/use-register-user.ts src/hooks/use-wallet.ts
git commit -m "feat: silent user registration on wallet connect via useRegisterUser"
```

---

## Task 4: medialane-io — update onboarding action

**Files:**
- Modify: `medialane-io/src/app/onboarding/_actions.ts`

Context: `completeOnboarding` is a Next.js Server Action called after ChipiPay creates the wallet. It currently calls `getMedialaneClient().api.upsertMyWallet(token)` which sends no body. We replace that call with a direct fetch that includes `walletType: "CHIPIPAY"` and `appSource: "MEDIALANE_IO"`. This doesn't touch the Clerk flow or ChipiPay at all.

- [ ] **Step 1: Update _actions.ts**

```typescript
"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";

interface WalletData {
  publicKey: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL || "http://localhost:3001";

export async function completeOnboarding(walletData: WalletData) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const client = await clerkClient();
    await client.users.updateUser(userId, {
      publicMetadata: {
        walletCreated: true,
        publicKey: walletData.publicKey,
      },
    });

    // Register wallet in Medialane user registry. Fire-and-forget.
    try {
      const token = await getToken({
        template: process.env.NEXT_PUBLIC_CLERK_TEMPLATE_NAME || "chipipay",
      });
      if (token) {
        await fetch(`${BACKEND_URL}/v1/users/me`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            walletType: "CHIPIPAY",
            appSource: "MEDIALANE_IO",
          }),
        });
      }
    } catch {
      // non-fatal: wallet address is still in Clerk publicMetadata
    }

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to complete onboarding" };
  }
}
```

Note: this now calls `POST /v1/users/me` directly with the Clerk JWT in the Authorization header (same as before, via `identityAuth`) and adds the walletType + appSource in the body. The backend reads the wallet address from the Clerk JWT via `identityAuth` (unchanged behavior) and now also stores walletType and appSource.

- [ ] **Step 2: Type-check medialane-io**

```bash
cd /Users/kalamaha/dev/medialane-io
npx tsc --noEmit 2>&1 | grep "_actions"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /Users/kalamaha/dev/medialane-io
git add src/app/onboarding/_actions.ts
git commit -m "feat: pass walletType=CHIPIPAY and appSource=MEDIALANE_IO on onboarding"
```

---

## Task 5: Deploy and verify

- [ ] **Step 1: Push medialane-backend to production**

```bash
cd /Users/kalamaha/dev/medialane-backend
git push origin main
```

Confirm Railway (or your deployment platform) runs the migration automatically on deploy. If not, run manually via the platform's shell:
```bash
bunx prisma migrate deploy
```

- [ ] **Step 2: Push medialane-dapp to production**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git push origin main
```

- [ ] **Step 3: Push medialane-io to production**

```bash
cd /Users/kalamaha/dev/medialane-io
git push origin main
```

- [ ] **Step 4: Verify user count endpoint**

```bash
curl -s "https://api.medialane.io/v1/users/count?chain=STARKNET" \
  -H "x-api-key: $MEDIALANE_API_KEY" | jq .
```

Expected: `{ "count": <n>, "filters": { "chain": "STARKNET", ... } }`

- [ ] **Step 5: Verify registration from dapp**

Connect a wallet on `dapp.medialane.io`. Check the count endpoint again — count should have increased by 1.

- [ ] **Step 6: Verify medialane-io registration**

Complete onboarding on `medialane.io`. Check the count endpoint — count should have increased by 1 with `appSource=MEDIALANE_IO`.
