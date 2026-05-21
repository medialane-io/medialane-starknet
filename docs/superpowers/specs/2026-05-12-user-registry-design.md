# User Registry Design

**Goal:** Extend the existing `User` model into a real cross-app registry that tracks wallet type and app source, add a frictionless registration endpoint, wire silent auto-registration in medialane-dapp on wallet connect, and add a user count endpoint for Starknet Foundation grant reporting.

**Architecture:** The `User` table becomes the canonical identity registry across all Medialane apps. Registration is silent and automatic — no user action required. Auth for registration uses the tenant API key (low-stakes, no signature pop-up). Profile enrichment (username, email) remains opt-in and continues to use SIWS. medialane-io's existing Clerk JWT path is untouched — we only add wallet type to the request body. The rewards system (`UserScore`, `UserBadge`, `PointEvent`) stays address-keyed and is linked to `User` by convention; no FK migration needed.

**Tech Stack:** Prisma + PostgreSQL (backend), Hono (backend API), React hook (dapp), `useWallet` + `MEDIALANE_API_KEY` (dapp registration).

---

## Current State

- `User` model: `walletAddress String @id` + timestamps only. No chain, no wallet type, no app source.
- `POST /v1/users/me`: exists, uses `identityAuth` (Clerk JWT or SIWS). Works for both apps today.
- `identityAuth`: already supports SIWS alongside Clerk JWT — no Clerk dependency needed on the backend.
- Rewards system: keyed by plain `address` string with no FK to `User`. Stays as-is.

---

## Schema Changes (`medialane-backend/prisma/schema.prisma`)

Add two enums:

```prisma
enum WalletType {
  ARGENT
  BRAAVOS
  CARTRIDGE
  PRIVY
  CHIPIPAY
  INJECTED   // unknown injected wallet
  UNKNOWN
}

enum AppSource {
  MEDIALANE_DAPP
  MEDIALANE_IO
  MEDIALANE_PORTAL
  MEDIALANE_SDK
}
```

Extend `User` model — change PK to compound to support multichain, add tracking fields:

```prisma
model User {
  walletAddress String
  chain         Chain      @default(STARKNET)
  walletType    WalletType @default(UNKNOWN)
  appSource     AppSource  @default(MEDIALANE_DAPP)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@id([chain, walletAddress])
  @@index([appSource])
  @@index([walletType])
  @@index([createdAt])
}
```

---

## API Changes (`medialane-backend/src/api/routes/users.ts`)

### `POST /v1/users/register` — new endpoint

Frictionless registration. Auth: tenant API key (`apiKeyAuth`). Address provided in body. Idempotent upsert — safe to call on every connect.

```typescript
// POST /v1/users/register
// Body: { walletAddress: string, walletType?: WalletType, appSource?: AppSource, chain?: Chain }
// Auth: x-api-key (tenant API key)
// appSource is provided by the caller — dapp sends "MEDIALANE_DAPP", medialane-io sends "MEDIALANE_IO"
// Defaults to "MEDIALANE_DAPP" if omitted
```

Response: `{ walletAddress, chain, walletType, appSource, createdAt }`.

### `POST /v1/users/me` — extend existing

Keep `identityAuth`. Add optional `walletType` and `appSource` to request body and store them on upsert. Backward-compatible — existing callers without these fields continue to work.

### `GET /v1/users/count` — new endpoint

Returns total registered user count, optionally filtered by `chain`, `appSource`, `walletType`, date range. Auth: tenant API key. Used for grant reporting.

```typescript
// GET /v1/users/count?appSource=MEDIALANE_DAPP&chain=STARKNET&since=2026-01-01
// Response: { count: number, filters: {...} }
```

---

## medialane-dapp Changes

### `src/hooks/use-register-user.ts` — new hook

Silent, fire-and-forget. Calls `POST /v1/users/register` when a wallet address resolves. Debounced per address per session (sessionStorage key `ml_registered_{address}`) — never fires twice for the same address in the same browser session.

```typescript
// useRegisterUser(address: string | null, walletType: WalletType | null)
// - Returns nothing, fires silently
// - On address change: if not registered this session, POST /v1/users/register
// - Uses MEDIALANE_API_KEY + MEDIALANE_BACKEND_URL from constants
// - Errors are silently swallowed — never block the user
```

### `src/hooks/use-wallet.ts` — extend

Expose `walletType` alongside `address` and `isConnected` — read from `useUnifiedWallet().walletType`. Import `useRegisterUser` and call it with the resolved address and wallet type. Since `useWallet` is already the normalized identity hook used everywhere, this is the single integration point. The `walletType` addition is additive and non-breaking — existing consumers that destructure only `{ address, isConnected }` are unaffected.

### Wallet type mapping

```typescript
// StarkZap walletType → WalletType enum
"cartridge" → "CARTRIDGE"
"privy"     → "PRIVY"
// Injected via starknet-react connector name
"argentX"   → "ARGENT"
"braavos"   → "BRAAVOS"
// Unknown injected
default     → "INJECTED"
```

---

## medialane-io Changes

In the existing server-side call to `POST /v1/users/me` (after ChipiPay wallet creation), add `walletType: "CHIPIPAY"` and `appSource: "MEDIALANE_IO"` to the request body. **No frontend changes. No Clerk flow changes. Zero breakage.**

---

## Data Flow

```
User connects wallet in medialane-dapp
  → useWallet() resolves address + walletType
  → useRegisterUser() fires (if not already registered this session)
  → POST /v1/users/register (API key auth)
  → User row upserted: address + chain + walletType + appSource="MEDIALANE_DAPP"

User signs up via Clerk + ChipiPay in medialane-io
  → ChipiPay wallet created, address known
  → medialane-io server calls POST /v1/users/me (Clerk JWT + body.walletType="CHIPIPAY")
  → User row upserted: address + chain + walletType="CHIPIPAY" + appSource="MEDIALANE_IO"

Starknet Foundation grant check
  → GET /v1/users/count?chain=STARKNET&since=2026-01-01
  → { count: 4821, filters: { chain: "STARKNET", since: "2026-01-01" } }
```

---

## File Map

| Action | File |
|---|---|
| Modify | `medialane-backend/prisma/schema.prisma` |
| Modify | `medialane-backend/src/api/routes/users.ts` |
| Create | `medialane-dapp/src/hooks/use-register-user.ts` |
| Modify | `medialane-dapp/src/hooks/use-wallet.ts` |
| Modify | `medialane-io` — server-side ChipiPay wallet creation call |

---

## Error Handling

- Registration failures are silently swallowed in the dapp — never surface to the user.
- Duplicate registrations (same address, same chain) are handled by Prisma upsert — idempotent.
- `walletType` unknown → stored as `UNKNOWN`, upgraded on next connect if type becomes known.
- medialane-io backward compat: if `walletType` missing from body, stored as `UNKNOWN`.
