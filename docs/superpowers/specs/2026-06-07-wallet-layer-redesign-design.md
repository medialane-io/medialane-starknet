# Wallet/Account Layer Redesign

**Date:** 2026-06-07
**Status:** Design — pending approval
**Owner:** wallet/account layer (medialane-dapp)

## Problem

Users who have a Privy (social/email) session *and* an injected wallet
(Argent/Braavos) in the same browser find the dapp silently executing as the
Privy account while they believe they are using their injected wallet. Core
flows (offers, mint, trade) fail because the Privy account is not the one they
funded/approved with. This breaks user trust.

### Root cause (audited)

The dapp runs **two independent account systems** — `@starknet-react/core`
(injected) and `starkzap` (Cartridge + Privy) — and a hand-written **referee**
decides which is "active" on every render:

- `use-wallet-session.ts` returns a StarkZap session *before it even checks the
  injected wallet* (hard-coded "StarkZap wins"). So any active StarkZap session
  outranks an actively-connected injected wallet for identity.
- `use-paymaster-transaction.ts` `executeAuto` runs `if (szWallet) { szWallet.execute(...) }`
  *first* — so every transaction executes from the StarkZap (Privy) account
  whenever a StarkZap wallet object exists, regardless of what the user connected.
- `app/providers.tsx` auto-mounts + activates the Privy stack on **every route**
  whenever `localStorage.ml_privy_session` exists, and `privy-connector.tsx`
  **silently auto-reconnects** whenever Privy is authenticated. The
  `!injectedConnected` guard is racy: on reload, starknet-react's injected
  auto-connect is async, so Privy frequently wins the race, populates `szWallet`
  in the background, and the referee then makes it the active account.

The referee logic is where every one of these bugs lives. The active wallet is
**computed** from two systems instead of being a single value the user set.

This is *not* a StarkZap problem. StarkZap is the modern wallet SDK the platform
relies on for Cartridge, Privy, swaps, DeFi, and Creator Coins, and it works
correctly when used as intended. The defect is the over-wrapping: **4 nested
providers + 4 overlapping wallet hooks + a buggy referee** to do a simple job.

## Goals

1. Privy and injected are two distinct accounts that **never mix**.
2. Exactly one active wallet at a time, set **only by an explicit user action**.
   No code path may change the active wallet in the background.
3. Restore-on-reload restores **only** the one wallet the user last chose — no
   racing, no silent Privy takeover.
4. Privy account is **deployed once** at first sign-in (eager), so users never
   hit "account not deployed" when they first touch a contract; later sign-ins
   are a light reconnect with no redeploy.
5. Net **deletion** of code and concepts — fewer hooks, fewer providers, less
   nesting. Keep StarkZap. Keep starknet-react. Add no new wallet kind, no
   Clerk/ChipiPay (those belong to medialane-io).

## Non-goals

- Removing or replacing StarkZap.
- Adding an account-switcher UI (one active at a time supersedes).
- Touching marketplace/contract read code (it keeps using starknet-react
  `useProvider`/`useContract` directly).
- Restricting Privy to specific routes (rejected — Privy stays app-wide).

## Architecture

### The single idea: one stored "active wallet" slot

Replace the per-render referee with one stored value owned by a single provider:

```ts
type WalletType = "argent" | "braavos" | "cartridge" | "privy";

interface ActiveWallet {
  type: WalletType;
  address: string;
  // normalized execution — the slot already knows how to execute
  execute: (calls: Call[]) => Promise<string>;
}
```

There is no priority logic because there is no contest: one slot, written only
on explicit user action. This makes "two distinct accounts, never mixed" true by
construction.

### Component boundaries

- **`WalletProvider`** (`src/contexts/wallet-context.tsx`) — owns the
  `ActiveWallet | null` slot, the `connect(type)` / `disconnect()` actions,
  `localStorage["ml_wallet"]` persistence, and the restore-on-reload logic.
  Holds the StarkZap SDK reference for Cartridge/Privy onboarding. This is the
  single source of truth.
- **injected adapter** — given a starknet-react `account`, produces an
  `ActiveWallet` whose `execute` calls `account.execute` through the AVNU
  paymaster (sponsored, with silent fallback to user-paid).
- **starkzap adapter** — given a StarkZap `WalletInterface`, produces an
  `ActiveWallet` whose `execute` calls `wallet.execute(calls, { feeMode: "sponsored" })`
  then `tx.wait()`.
- **`useWallet()`** (`src/hooks/use-wallet.ts`) — thin read of the slot:
  `{ address, isConnected, isConnecting, walletType, connect, disconnect, execute }`.
  This is the only wallet hook components use.

### Provider tree (before → after)

```
Before: ThemeProvider → (lazy) PrivyProvider → StarknetProvider
        → StarkZapWalletProvider → PrivyConnector
After:  ThemeProvider → StarknetProvider → WalletProvider
        (PrivyProvider mounted by WalletProvider only when needed)
```

`StarknetProvider` stays outer (the app's contract reads + AVNU paymaster live
there). `WalletProvider` is inner so the injected adapter can read
starknet-react's `account`.

## Behaviors

### Connect

`connect(type)` performs the explicit user action:
- `argent` / `braavos` → connect that starknet-react connector; on success wrap
  its `account` via the injected adapter and write the slot.
- `cartridge` → `sdk.onboard({ strategy: Cartridge, cartridge: { policies } })`;
  wrap the resulting wallet via the starkzap adapter; write the slot.
- `privy` → mount Privy if not mounted, run Privy login, then the one-time
  deploy pipeline (below); wrap via starkzap adapter; write the slot.

Writing the slot clears any previous wallet (disconnect the superseded one) and
sets `localStorage["ml_wallet"] = type`.

### Reconnect on reload

`WalletProvider` reads `localStorage["ml_wallet"]` once on mount and restores
**only** that branch:
- `argent`/`braavos` → reconnect that specific connector (not a blanket
  autoConnect that races with Privy).
- `cartridge` → silent `sdk.onboard({ strategy: Cartridge })` session resume.
- `privy` → only if Privy is still authenticated → light reconnect (§deploy). If
  Privy auth expired → clear `ml_wallet`, land disconnected (no half-state).

Privy is mounted only when `ml_wallet === "privy"` or the user clicks the Privy
option — never globally on every route.

### Execution routing

`activeWallet.execute(calls)` is built at connect time by the owning adapter, so
routing is structural, not a runtime `if`:
- injected → `account.execute` via AVNU paymaster (sponsored → silent fallback
  to user-paid).
- starkzap → `wallet.execute(calls, { feeMode: "sponsored" })` + `tx.wait()`.

Both return a tx hash. `waitForReceipt` confirmation/revert handling is retained.
`usePaymasterTransaction`'s alt-token `executeGasless` (used by swap/coin flows)
is retained; only the `if (szWallet)` priority branch is removed. **No execute
call sites change** — `useWallet().execute(calls)` keeps the same signature and
feeds `useTxTracker` as before.

### One-time Privy deploy

First-ever Privy connect: create the Starknet wallet (server route
`/api/wallet/starknet`) → `sdk.onboard({ strategy: Privy, deploy: "if_needed" })`,
which eagerly deploys on mainnet. Set `ml_wallet = "privy"`.

Every later reconnect: `wallet.ensureReady({ deploy: "if_needed" })` — a no-op
once deployed — so no redeploy churn and no "account not deployed" on first
contract interaction.

## Files

### Deleted
- `src/hooks/use-wallet-session.ts` (referee)
- `src/hooks/use-unified-wallet.ts` (second referee)
- `src/lib/wallet-session.ts` (referee state machine)
- `src/components/wallet/privy-connect-dialog.tsx` (subsumed by `<ConnectWallet/>`)
- The global `ml_privy_session` auto-mount in `app/providers.tsx`
- The silent auto-reconnect effect in `privy-connector.tsx`
- The `if (szWallet)` priority branch in `use-paymaster-transaction.ts`

### Added
- `src/contexts/wallet-context.tsx` — `WalletProvider` + slot + adapters wiring
- `src/lib/wallet-adapters.ts` — `injectedAdapter`, `starkzapAdapter` →
  `ActiveWallet`

### Changed
- `src/hooks/use-wallet.ts` — thin read of the slot, gains `connect`/`disconnect`/`execute`
- `src/contexts/starkzap-wallet-context.tsx` — reduced to a thin SDK/wallet
  holder used by the starkzap adapter (Cartridge/Privy onboarding), no priority
- `src/contexts/privy-connector.tsx` — explicit connect + light reconnect only
  (no silent auto-reconnect, no `!injectedConnected` race guard)
- `src/app/providers.tsx` — 2-level tree; Privy mounted only on demand
- `src/components/ConnectWallet.tsx` — calls `useWallet().connect(type)`
- `src/components/nav-account-panel.tsx`, `airdrop/*`, `br/mint/*` — consume the
  single `useWallet()` (connect/disconnect/execute) instead of the old chain

### Migration note
`useUnifiedWallet()` consumers move to `useWallet()` (now the superset). A grep
sweep of `useUnifiedWallet`, `useWalletSession`, `useStarkZapWallet` call sites
is part of the plan; each maps to a `useWallet()` field.

## Error handling

- All connect/reconnect errors route through `getFriendlyWalletError`
  (`src/lib/wallet-error.ts`): transient RPC → "Network busy — try again";
  raw RPC blobs stay console-only.
- StarkZap stays pinned to the reliable RPC (`DEFAULT_RPC_URL`); it cannot fail
  over (documented constraint). Unchanged.
- Privy auth-expired on reload → clear `ml_wallet`, disconnected state, no toast
  spam.

## Verification

No automated wallet tests exist and Privy/mainnet-deploy only fully exercise in
prod, so verification is staged:
1. `npx tsc --noEmit` clean; `npm run build` passes.
2. Manual matrix (documented in the plan): injected-only, Privy-only,
   both-present, reload for each, disconnect/switch, mint + list + buy + offer
   per wallet type, and the `/br/mint` + `/airdrop` Privy funnel.
3. The mixing repro: connect Privy, then connect Braavos → execute must run as
   Braavos; reload → only Braavos restores; and the reverse.

## Risks

- Reconnecting a specific injected connector (not blanket autoConnect) must
  match starknet-react v5 / starknetkit APIs — confirm during planning.
- The custom-but-thin starkzap/injected adapters must preserve `waitForReceipt`
  semantics so reverts aren't reported as success.
- Lazy Privy mount timing on `/br/mint` (paid-ads funnel) must still render the
  inline login fast — keep the route pre-mount for the 3 mint/airdrop routes.

## Shipped + post-deploy follow-ups (2026-06-07)

Implemented per the plan and shipped to prod (`main`), then hardened from live
testing (no local wallet harness — prod is the verification loop):

- `af1bb3f`–`86f1f08` — the redesign: `ActiveWallet` types, adapters,
  `WalletProvider` slot, `useWallet()`, compat shims, `executeAuto` via slot,
  ConnectWallet/nav rewire, Privy explicit-connect, providers tree + `ml_wallet`
  gating, dead-code removal.
- `95aadcb` — **slot identity from `connected+address`, not the `account` object**
  (asset page read "disconnected" for a live injected wallet; `account` hydrates
  async). Account resolved lazily at `execute()`.
- `d039e43` — **marketplace resolves `szWallet ?? account`** (StarkZap users can
  trade; no `account!` crash; injected path byte-identical).
- `6cbfd7d` — **connector: silent re-verify before disconnect** on empty
  `accountsChanged` (extensions fire spurious empties during panel/lock UI).
- `276a714` — **retried injected reconnect** in `WalletProvider` (~6s of
  `connector.ready()` polling). Root cause proven via console: starknet-react
  `autoConnect` is a one-shot and loses the race vs async `window.starknet_*`
  injection on fresh loads. THIS was the real "disconnect on navigation" cause;
  the earlier connector fix targeted a path that wasn't firing.
- `e8ae5bc` — deleted the orphaned `src/wallet/*` unified-store leftovers +
  `/wallet-debug` (a duplicate `WalletProvider`/`useWallet` footgun).

**Method note:** the disconnect bug was only solved once we added `[ML-WALLET]`
console diagnostics and read the actual event sequence from prod — three
code-reasoning guesses before that were wrong. For unreproducible multi-component
timing bugs, instrument first.
