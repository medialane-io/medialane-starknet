# Privy + StarkZap Integration Design

**Date:** 2026-05-12  
**Status:** Approved

## Goal

Add Privy as a third, independent wallet connection strategy alongside injected wallets (Ready, Braavos, Xtend) and Cartridge Controller. Users can sign up and interact with Medialane using email, Google, or Twitter — no seed phrase, no browser extension required. This gives the team a parallel onboarding channel to compare against the chipipay + clerk approach used on the main consumer app.

## Wallet Strategy Overview

Three independent strategies, unified by `useUnifiedWallet`:

| Strategy | Package | Who manages keys |
|---|---|---|
| Injected (Ready, Braavos, Xtend) | `@starknet-react/core` | User (self-custody) |
| Cartridge Controller | `starkzap` | Cartridge (session keys) |
| Privy (email / Google / Twitter) | `starkzap` + `@privy-io/react-auth` + `@privy-io/node` | Privy HSM (server-managed) |

No strategy depends on another. Adding Privy does not affect users connected via injected wallets or Cartridge.

## Packages

```bash
npm install @privy-io/react-auth @privy-io/node
```

- `@privy-io/react-auth` — frontend: Privy auth modal, social login, `usePrivy()` hook, session persistence
- `@privy-io/node` — server only: wallet creation and signing via Privy's HSM infrastructure

## Environment Variables

Already documented in CLAUDE.md. Values required in `.env.local`:

```
NEXT_PUBLIC_PRIVY_APP_ID   # public — used by PrivyProvider on the client
PRIVY_APP_SECRET           # server only — never exposed to client
```

## Architecture

### Provider Tree (`src/app/providers.tsx`)

`PrivyProvider` is added as the outermost wrapper — it is the auth layer and has no dependency on or coupling with the wallet or chain providers below it. Privy session state is available anywhere in the tree but is only consumed by `StarkZapWalletProvider` when a user explicitly chooses the Privy connection path.

```tsx
<PrivyProvider appId={NEXT_PUBLIC_PRIVY_APP_ID} config={privyConfig}>
  <SWRConfig ...>
    <StarknetProvider>           // injected wallets — unchanged
      <StarkZapWalletProvider>   // cartridge + privy — extended
        {children}
      </StarkZapWalletProvider>
    </StarknetProvider>
  </SWRConfig>
</PrivyProvider>
```

`PrivyProvider` config:
- `loginMethods: ["email", "google", "twitter"]`
- Embedded EVM wallets: disabled (Starknet accounts are managed by StarkZap)
- `appearance`: aligned with Medialane dark theme

### `StarkZapWalletProvider` (`src/contexts/starkzap-wallet-context.tsx`)

Extended with Privy support alongside the existing Cartridge implementation.

**Type change:**
```ts
export type StarkZapWalletType = "cartridge" | "privy";
```

**New state:**
- `privyUser: PrivyUser | null` — exposes email/social identity for UI (badge, account sheet)

**New method: `connectPrivy()`**
1. Call `usePrivy().login()` — Privy shows its social login modal
2. On success, call `usePrivy().getAccessToken()` to get a short-lived JWT
3. POST `/api/wallet/starknet` with `Authorization: Bearer <token>` → receive `{ id, address, publicKey }`
4. Call `sdk.onboard({ strategy: OnboardStrategy.Privy, accountPreset: accountPresets.argentXV050, privy: { resolve: async () => ({ walletId: id, publicKey, serverUrl: "/api/wallet/sign" }) }, deploy: "if_needed" })`
5. Set wallet, walletType, address, privyUser in state

**Auto-reconnect on mount:**  
If `usePrivy().authenticated` is true on mount and no StarkZap wallet is active, silently re-run steps 2–5 to restore the session without user interaction.

**Disconnect:**  
Calls `usePrivy().logout()` and clears all StarkZap wallet state.

### API Routes (server-side)

Both routes use `@privy-io/node` and verify the caller's Privy auth token before acting. This ensures only the authenticated user can access or sign with their wallet.

**`POST /api/wallet/starknet`**

- Header: `Authorization: Bearer <privy-access-token>`
- Verifies token with `privy.verifyAuthToken(token)` → extracts `userId`
- Calls `privy.wallets().create({ chain_type: "starknet", user_id: userId })` — idempotent, returns existing wallet if already created
- Returns `{ id, address, publicKey }`

**`POST /api/wallet/sign`**

- Body: `{ walletId: string, hash: string }`
- Header: `Authorization: Bearer <privy-access-token>`
- Verifies token → confirms the requesting user owns `walletId`
- Calls `privy.wallets().rawSign({ walletId, hash })`
- Returns `{ signature }`

### `ConnectWallet.tsx` (`src/components/ConnectWallet.tsx`)

New "Social Login" section in the connect dialog, below the existing Cartridge section:

- Email, Google, and Twitter buttons (rendered from Privy's `loginMethods` config)
- `isConnecting` spinner shared with Cartridge loading state
- Error display from `szError` (existing pattern)

Connected Privy users get a distinct badge in the account sheet showing their login method (email address or social provider name).

`getWalletBadge` extended to handle `"privy"` type.

### `useUnifiedWallet.ts` (`src/hooks/use-unified-wallet.ts`)

No changes required. `"privy"` is already in `UnifiedWalletType`. `executeAuto` via the AVNU paymaster works identically for Privy wallets — the Starknet account address is the same regardless of how it was created.

## Data Flow: Privy Connect

```
User clicks "Sign in with Google"
  → usePrivy().login() → Privy modal → Google OAuth
  → Privy issues JWT (access token)
  → POST /api/wallet/starknet (Bearer token)
    → privy.verifyAuthToken() → userId
    → privy.wallets().create({ chain_type: "starknet", user_id })
    → { id, address, publicKey }
  → sdk.onboard(OnboardStrategy.Privy, resolve → { walletId, publicKey, serverUrl })
    → StarkZap deploys ArgentX v0.5.0 account if needed (AVNU sponsored)
  → wallet state set in StarkZapWalletProvider
  → useUnifiedWallet sees szWallet → address, isConnected, execute available
```

## Data Flow: Transaction Signing

```
executeAuto(calls)
  → AVNU paymaster wraps calls
  → StarkZap needs signature
  → calls serverUrl: POST /api/wallet/sign { walletId, hash }
    → privy.verifyAuthToken() → confirms ownership
    → privy.wallets().rawSign({ walletId, hash })
    → { signature }
  → StarkZap submits tx
  → returns txHash → useTxTracker
```

## Session Persistence

`@privy-io/react-auth` handles persistence automatically — the user remains authenticated across page reloads and browser restarts. On mount, `StarkZapWalletProvider` checks `usePrivy().authenticated` and silently restores the wallet session without showing any UI.

## Backend Note (medialane-backend)

Privy wallets produce a real Starknet address. The dapp sends this address via `x-wallet-address` headers as it does today — the backend is already provider-agnostic. Future analytics across onboarding channels (injected vs Cartridge vs Privy) can be enabled by adding a `provider` field to user records on the backend.

## What Does Not Change

- `useWallet()` — unchanged, works for all wallet types
- `useUnifiedWallet()` — no code changes
- `usePaymasterTransaction` / `executeAuto` — no changes, Privy wallets are fully compatible
- Injected wallet connect flow — unchanged
- Cartridge connect flow — unchanged
- All existing hooks and marketplace flows — unchanged
