# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npx tsc --noEmit # Type-check (zero-error target)
```

No test suite is configured. TypeScript build errors are intentionally ignored (`typescript.ignoreBuildErrors: true` in `next.config.ts`), but `npx tsc --noEmit` should stay clean.

## Architecture Overview

Medialane is a Next.js (App Router) dapp on **Starknet** with two primary features:

1. **Creator Launchpad** (`/launchpad`, `/create`) — mint and manage tokenized IP assets (IP Coins, Collection Drops, etc.)
2. **NFT Marketplace** (`/marketplace`) — list, buy, make offers, and auction IP NFTs

The app is deployed at [medialane.io](https://medialane.io) on Starknet Mainnet.

## Key Environment Variables

> **Mainnet-only.** Medialane runs on Starknet mainnet exclusively — there is no
> network/Sepolia axis. Any testnet path was purged; never reintroduce one.
>
> **Protocol contract addresses are NOT env vars.** Marketplace, collection, POP,
> Drop, comments and creator-coin addresses (+ class hashes, start blocks) come
> from `@medialane/sdk`'s chain-named constants (`STARKNET_MARKETPLACE_721_CONTRACT`,
> `STARKNET_COLLECTION_1155_CONTRACT`, `STARKNET_NFTCOMMENTS_CONTRACT`, …) — the
> single source, derived from `chains.ts`. No `NEXT_PUBLIC_*_CONTRACT(_MAINNET)`
> overrides (deleted 2026-06-25). Only genuinely app-specific, non-protocol
> contracts (mint/airdrop campaigns) keep an env var.

```
# Starknet RPC — two role-based, SERVER-ONLY vars (browser uses the /api/rpc proxy).
# Defined once in src/lib/constants.ts (RPC_MAIN_URL / RPC_FALLBACK_URL / RPC_PROXY_PATH).
STARKNET_RPC_URL                      # MAIN (primary): the keyed provider URL (Alchemy today, any provider tomorrow). SERVER-ONLY — never NEXT_PUBLIC_ (a NEXT_PUBLIC_ keyed URL is inlined into the browser bundle = the 2026-06-23 key leak). The /api/rpc proxy forwards to it.
STARKNET_RPC_FALLBACK_URL             # FALLBACK: keyless public node (lava). OPTIONAL — the code hardcodes https://rpc.starknet.lava.build as the default, so a missing/empty env can never break the build.

# (Protocol contract addresses come from @medialane/sdk — see the note above. No env vars.)

# Medialane Backend API (indexed on-chain data — used for all reads)
NEXT_PUBLIC_MEDIALANE_BACKEND_URL     # Backend base URL (default: http://localhost:3001) — public, used to construct URLs
MEDIALANE_API_KEY                     # Server-only API key. The BFF proxy at
                                      # /api/proxy/v1/[...path] injects this on
                                      # outbound requests. NEVER set
                                      # NEXT_PUBLIC_MEDIALANE_API_KEY (would
                                      # ship the key in the browser bundle).

# IPFS
NEXT_PUBLIC_PINATA_GATEWAY            # Pinata IPFS gateway URL (one name; was NEXT_PUBLIC_GATEWAY_URL, collapsed 2026-06-25)
PINATA_JWT                            # Server-side Pinata JWT (for uploads)

# Explorer
NEXT_PUBLIC_EXPLORER_URL              # Block explorer (default: voyager.online)

# Privy (social/email wallet — server-side secret must never be exposed to client)
NEXT_PUBLIC_PRIVY_APP_ID              # Privy app ID (public)
PRIVY_APP_SECRET                      # Privy app secret (server only)

# AVNU Paymaster (gasless/sponsored transactions)
NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY    # AVNU API key — all tx types sponsored when present
```

## Wallet System

The app supports three wallet connection strategies, unified by a single
active-wallet slot (`WalletProvider` + `useWallet()`):

1. **Argent / Braavos** — injected browser wallets via `starknetkit` + `@starknet-react/core`
2. **Cartridge Controller** — session-key gaming wallet via StarkZap SDK (`OnboardStrategy.Cartridge`). Auto-gasless, policies scoped via `CARTRIDGE_POLICIES` in `src/contexts/starkzap-wallet-context.tsx`.
   - **Static targets are exhaustively whitelisted** as of PRs #20 + #24 (2026-05-26): MIP registry, ERC-1155 factory, marketplace ×2, POP factory, Drop factory, NFTComments, three airdrop mint contracts. Whenever a new (target, method) is invoked on a static-address contract, **add it to `CARTRIDGE_POLICIES`** — Cartridge session-keys reject any call outside the list.
   - **Per-instance contracts are a structural gap**: per-collection NFT contracts (transfers, approves, mint_item), per-pop event contracts (claim), per-drop contracts (manage actions) all have dynamic addresses the static list cannot cover. Cartridge users hit "additional approval needed" prompts mid-flow for these. Three follow-up paths possible: route through registry wrappers (e.g. MIP `transfer_token`), add a runtime UX nudge, or use Cartridge SDK wildcard support if available.
   - **Audit methodology**: `grep -rEo 'entrypoint:\s*"[a-zA-Z_]+"' src/ | awk -F'"' '{print $2}' | sort -u` lists every called entrypoint. Diff against `CARTRIDGE_POLICIES`. Anything called on a static-address contract but not in the list is a silent-failure bug.
   - **Cartridge needs its own RPC config — never the app's Lava pin** (`getCartridgeStarkZapSdk()` in `src/lib/starkzap.ts`, fixed 2026-07-02). `@cartridge/controller`'s chain-detector only recognizes RPC URLs whose *path* contains `starknet`/`mainnet` (its own hosted-RPC convention, `https://api.cartridge.gg/x/starknet/mainnet`) — our reliable Lava endpoint (`https://rpc.starknet.lava.build`, root path, no such segment) throws `Chain ... not supported` the instant `connectCartridge()` forwards it in. This broke Cartridge connect entirely for ~4 weeks (since the `ddb6484` Lava-pin fix) before being caught — the raw RPC URL leaked into a user-facing error banner and was shared on the public Starknet Telegram. Fixed with a **second, Cartridge-only StarkZap SDK instance** on StarkZap's `network: "mainnet"` preset (which resolves to Cartridge's hosted RPC); the main Lava-pinned singleton (`getStarkZapSdk()`) is untouched and still used for every other read/write. If StarkZap ever exposes a per-call rpcUrl override on `connectCartridge()`, this dual-instance workaround can collapse back to one.
3. **Privy** — email/social login via StarkZap SDK (`OnboardStrategy.Privy`). Keys managed server-side; no seed phrase required. Requires the two Privy API routes.
   - **`login()` failures must be caught** (fixed 2026-07-02, `privy-connector.tsx`): a blocked OAuth popup (Brave/Safari block by default) throws or rejects with zero visible UI change — previously unhandled, leaving the wallet button stuck as a permanently-disabled spinner ("authenticating" session state that never resolves). Now caught with a friendly "pop-up blocked" message plus a 45s timeout backstop.

**Architecture — one active-wallet slot (redesigned 2026-06-07; spec:
`docs/superpowers/specs/2026-06-07-wallet-layer-redesign-design.md`).** A single
`WalletProvider` (`src/contexts/wallet-context.tsx`) owns one `ActiveWallet | null`
slot, written **ONLY by an explicit user `connect(type)`**. There is NO priority
referee — one slot, last-explicit-choice-wins by construction, so a background
session cannot outrank the wallet the user is actually using. (This replaced the
old `useWalletSession`/`useUnifiedWallet` "StarkZap > injected" priority that
silently let a stale Privy session hijack an actively-connected injected wallet —
the 2026-06-07 "Privy hijack" incident.)

**`useWallet()` is the single hook** (`src/hooks/use-wallet.ts`): reads the slot →
`{ address, isConnected, isConnecting, walletType, error, connect, disconnect,
execute }`. Use it everywhere — identity AND execution. `connect(type, connector?)`
is the only thing that writes the slot. `useUnifiedWallet()` and `useWalletSession()`
are kept as **thin compatibility shims** over `useWallet()` (same shapes) so legacy
call sites keep working; new code uses `useWallet()`.

**Identity is decoupled from the account object.** The slot exists whenever
`injectedConnected && injectedAddress` — NEVER gated on starknet-react's `account`
object, which can be momentarily `undefined` while connected (hydrates async,
differs per page). The account is resolved lazily at `execute()` time. Coupling
identity to `account` made the asset page read "disconnected" for an
actively-connected wallet (fixed `95aadcb`).

**Persistence + reconnect.** One key `localStorage["ml_wallet"]`
(`argent|braavos|cartridge|privy`, replaces the old `ml_privy_session`) records the
user's last explicit choice; only that wallet restores on reload.
- **Injected**: `WalletProvider` owns a **retried** reconnect (~6s of
  `connector.ready()` polling, keyed on `ml_wallet`). starknet-react's built-in
  `autoConnect` is a single one-shot on mount and loses the race against async
  `window.starknet_*` extension injection on fresh loads — never relied on alone
  (fixed `276a714`).
- **Cartridge**: silent `sdk.onboard({ strategy: Cartridge })` resume.
- **Privy**: restores ONLY when `ml_wallet === "privy"` and Privy is still
  authenticated — there is **NO silent background auto-reconnect** (the old one
  hijacked injected wallets). Privy is lazy-mounted only when `ml_wallet === "privy"`
  or on `/mint`,`/airdrop`,`/br/*`. First-ever connect eagerly deploys the mainnet
  account (`deploy: "if_needed"`); later sign-ins are a light rehydrate.

**Connector hardening** (`src/lib/starknet-connectors.ts`): on an empty
`accountsChanged` the injected connector silently re-verifies (`wallet_getPermissions`
+ silent `wallet_requestAccounts`) **before** emitting `disconnect` — extensions
fire spurious empty `accountsChanged` during panel refresh / lock UI, and treating
that as a hard disconnect dropped live sessions.

**Provider tree** (`src/app/providers.tsx`):
```
ThemeProvider
  └─ (lazy) PrivyProvider     ← only when ml_wallet=privy or on mint/airdrop/br routes
       └─ StarknetProvider     ← src/components/starknet-provider.tsx
            └─ StarkZapWalletProvider  ← src/contexts/starkzap-wallet-context.tsx (Cartridge/Privy onboarding + active WalletInterface)
                 └─ WalletProvider     ← src/contexts/wallet-context.tsx (the active-wallet slot)
```
`WalletProvider` is innermost so its injected adapter can read starknet-react's
`useAccount()` and its StarkZap adapter the StarkZap context.

**Key files**:
- `src/contexts/wallet-context.tsx` — `WalletProvider` (the slot) + `useWalletContext()`
- `src/hooks/use-wallet.ts` — `useWallet()`, the single public hook
- `src/lib/wallet-types.ts` — `ActiveWallet`/`WalletType` + `ml_wallet` persistence helpers
- `src/lib/wallet-adapters.ts` — `makeInjectedExecute` / `makeStarkzapExecute`
- `src/lib/wait-for-receipt.ts` — shared on-chain confirmation + revert detection
- `src/contexts/starkzap-wallet-context.tsx` — StarkZap SDK onboarding + `useStarkZapWallet()` (Cartridge/Privy)
- `src/lib/starkzap.ts` — SDK singleton (`getStarkZapSdk()`), token presets, staking config
- `src/hooks/use-unified-wallet.ts`, `src/hooks/use-wallet-session.ts` — compat shims over `useWallet()`
- `src/app/api/wallet/{starknet,sign}/route.ts` — Privy server wallet get-or-create + raw signing

**StarkZap stays.** It is the modern, valued Starknet SDK powering Cartridge, Privy,
swaps, DeFi, and Creator Coins. Fix wallet bugs by **removing complexity** (referees,
redundant hooks, auto-reconnect machinery), NOT by removing/replacing the SDK.
Clerk + ChipiPay belong to **medialane-io**, not this dapp.

**Compat note**: StarkZap bundles starknet v9 internally; the app uses v8 via
starknet-react. They coexist — share primitives (addresses, tx hashes, typed-data
signatures as `string`/`string[]`) only; never mix Account objects across stacks.

### Connect dialog — `<ConnectWallet />` is the single entry point (2026-05-27)

Every page and component that prompts the user to connect renders the shared `<ConnectWallet />` from `src/components/ConnectWallet.tsx`. It contains the four-card picker (Ready / Braavos / Cartridge / Email or Social) and handles both StarkZap (Cartridge / Privy) and injected (Ready / Braavos) connectors internally.

- **Do NOT use `starknetkit`'s `useStarknetkitConnectModal`**. That path was removed across the launchpad pages, drop / pop mint flows, claim gate, and genesis mint. It silently auto-selected one wallet when only one connector was "available" — which masked extension-id rebrands (e.g. Ready X exposing `wallet.id = "ready"` instead of `"argentX"`) by falling through to Braavos with no picker.
- **Pattern for "connect or block" UI**: render `<ConnectWallet label="Connect wallet" />` in the not-connected branch. For inline guards mid-flow (form submits, mint handlers), use `toast.error("Connect your wallet first")` and return — the persistent `<ConnectWallet />` button is still on the page.
- **Ready / Argent connector** (`src/lib/starknet-connectors.ts`): `idResolvedReady()` constructs an `IdResolvedInjectedConnector("argentX", …, ["ready"])` — the alias list lets it discover extensions that expose under either id. The connector's external `id` stays `"argentX"` so backend `WalletType` attribution doesn't drift across the rebrand.
- **Missing-extension UX** (fixed 2026-07-02): both connectors are always configured regardless of which extensions are actually installed, so clicking one with nothing installed was a guaranteed `ConnectorNotFoundError`. `ConnectWallet.tsx` now checks `connector.available()` (synchronous) at render time and shows an "Install {name}" link instead of a doomed button.
- **Connect failures must reopen the dialog.** `handleCartridgeConnect`/the Privy button used to close the dialog immediately and let the error land only in session state — with the dialog already closed, the user never saw it (reported as "the button does nothing, zero feedback"). A `useEffect` on `sessionError` now reopens the dialog whenever a connect attempt fails, so the (friendly) error banner is actually visible.
- **`getFriendlyWalletError` (`src/lib/wallet-error.ts`) must never leak a raw endpoint.** `looksTechnical()` flags any message containing `http(s)://` regardless of length — added 2026-07-02 after a raw `Chain https://rpc.starknet.lava.build/ not supported` message reached a user and got shared on the public Starknet Telegram. The final fallback message was also rewritten from a dead-end "Something went wrong" to an actionable one ("try again... try a different wallet or refresh the page").

### Onboarding — `/v1/users/register` via the BFF proxy (2026-05-27 incident note)

`src/hooks/use-register-user.ts` runs on every wallet connect; it POSTs to `/api/proxy/v1/users/register` via the SDK so the BFF can inject the server-side `MEDIALANE_API_KEY`. **The hook must NOT guard on `MEDIALANE_API_KEY`** — that constant is intentionally an empty string in the browser (the key only exists server-side, per `src/lib/constants.ts:60-62`). A `!MEDIALANE_API_KEY` check there silently kills onboarding (was the cause of zero Wallet rows from 2026-05-24 → 2026-05-27 in prod). Same anti-pattern in any other client hook is a regression target — grep for `!MEDIALANE_API_KEY` and `!process.env.NEXT_PUBLIC_` in browser code paths when auditing.

### BFF proxy method/path allowlist (added 2026-05-27)

`src/app/api/proxy/v1/[...path]/route.ts` enforces an explicit allowlist on POST / PATCH / DELETE — `GET /v1/*` stays wildcard. The proxy injects the server-only tenant `MEDIALANE_API_KEY`; the allowlist keeps that key from being reachable on routes the dapp doesn't actually use. When adding any new mutating route call from the dapp, add the matching `(method, regex)` pair to `ALLOWED_ROUTES`. A missed entry surfaces as `[/api/proxy] blocked by allowlist` in Vercel logs (silent for the user, loud for ops).

## Starknet Integration Patterns

**ERC-1155 editions mint (2026-06-10, SDK ≥0.34.0 / contract v0.3.0).** Collections deploy from the v0.3.0 ownerless factory (`0x0083543c…`) and assign edition ids **on-chain**, sequential from 1: the mint page (`/launchpad/nfteditions/[contract]/mint`) calls `mint_edition(to, value, uri)` and reads the assigned id from the tx's `IPMinted` event (`keys = [selector, id_low, id_high, recipient]`). Never reintroduce client-generated token ids or a `mint_item` path here. **Medialane does not support legacy protocol versions**: pre-v0.3.0 (v0.2.0 `mint_item`) collections were reclassified `external-erc1155` (read-only external provenance) on the 2026-06-10 cutover; the version-gate + `mint_item` fallback was removed from this page. (`mint_item` is still a live selector for the genesis/launch/BR mints and the remix flows, which target other contracts — don't confuse the two.)

**Contract ABIs** come from `@medialane/sdk` (currently 0.38.0). Import `IPMarketplaceABI`, `Medialane1155ABI`, `IPCollectionABI`, `IPNftABI`, `POPFactoryABI`, `POPCollectionABI`, `DropFactoryABI`, `DropCollectionABI`, `IPCollection1155FactoryABI`, `IPCollection1155ABI` from the SDK. Each ABI lives in its own file under `src/abis/` in the SDK (split in v0.19.0); the public import path is unchanged via `abis/index.ts` barrel. The only local ABI that remains in this repo's `src/abis/` is `user_settings.ts` — everything contract-related lives in the SDK as the single source of truth.

**Marketplace order flow** (in `src/hooks/use-marketplace.ts`) — **redesigned venues, SDK 0.26.0** (client-signing migration, 2026-05-31):
- Order params use the new schema: single `amount` (no start/end), plus `marketplace`, `royalty_max_bps` (live EIP-2981 via `royalty_info`), and `counter` (`get_counter()`, replaces the removed nonce). Salt is a **wide 248-bit** value (sole order-hash uniqueness source).
- Typed data is delegated to the SDK builders via `src/utils/marketplace-utils.ts` (`getOrderParametersTypedData`→`buildOrderTypedData` v4, `get1155OrderParametersTypedData`→`build1155OrderTypedData` v3, cancellation builders). **There is no fulfillment builder — fulfilment is UNSIGNED.**
- Listings: sign → ERC721 `approve` + `register_order` multicall
- Offers: sign → ERC20 `approve` + `register_order` multicall
- Buying a listing / accepting an offer: **unsigned** — `fulfill_order(orderHash[, quantity])`, no `signMessage`; approve + (fee) executed atomically via the paymaster
- Cancellations: signed `{ order_hash, offerer }` (no nonce) → `cancel_order`
- Execution stays on dapp's AVNU paymaster (`executeAuto`) + creators-fund fee splice.
- **Signer/executor resolution** (2026-06-12, supersedes `d039e43`): the StarkZap wallet is
  **gated on the active-wallet slot** before any `szWallet ?? account` fallback —
  `const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;`
  (applied in `use-marketplace`, `use-tx`, `use-siws-token`, `use-launch-coin`). A bare
  `szWallet ?? account` priority let a lingering Cartridge/Privy session sign/execute for a
  different wallet than the one the user explicitly connected (and in `use-launch-coin` even
  split signer vs owner across rails). Cartridge/Privy users still list/buy/offer normally, and
  a momentarily-`undefined` injected `account` surfaces a retryable error instead of crashing.
  **Any new hook that resolves a signer/executor must use this slot-gated pattern.**

**Checkout totals — always via `orderTotal()` (`src/lib/checkout.ts`).** `order.consideration.startAmount` is the price **per edition** for ERC-1155 (the listing form labels it "Price per edition"); `fulfill_order` charges `price × quantity`. `orderTotal(order, quantity)` is the single source of truth for the ERC-20 amount to approve — never divide by `offer.startAmount`. `checkoutCart` takes a typed `CheckoutItem[]`; both call sites (`purchase-dialog`, `counter-offers-table`) build items through `orderTotal`. A prior bug under-approved ERC-1155 multi-buys by dividing by the edition count → `ERC20: insufficient allowance`.

**Event/provenance queries** (`src/hooks/use-events.ts`): `useAssetProvenanceEvents` fetches transfer/mint history from the Medialane backend API (`client.api.getTokenHistory()`). Lower-level `useAssetTransferEvents` / `useMyTransferEvents` still use starknet-react `useEvents` for real-time transfer monitoring.

**Constants** (`src/lib/constants.ts`): contract addresses, supported tokens (USDC, USDT, ETH, STRK with decimals), and `AVNU_PAYMASTER_CONFIG`.

## Platform fee — creators fund (added 2026-05-20)

Configurable platform fee (default **1%**) on marketplace + launchpad
settlement, routed to a single creators-fund address. Defined once in
`@medialane/sdk` (`buildFeeCall`); the dapp resolves config via `src/lib/fee.ts`
(`dappFeeConfig`, env: `NEXT_PUBLIC_FEE_FUND_ADDRESS`,
`NEXT_PUBLIC_FEE_MARKETPLACE_BPS`/`_LAUNCHPAD_BPS`, `NEXT_PUBLIC_FEE_ENABLED`)
and splices the fee `Call` into `use-marketplace.ts` checkout and the
drop-mint button. Fee is platform-layer only — never on-chain (`00 §12`).
**Fail-safe:** no fund address ⇒ no fee. The dapp executes atomically
(`account.execute` via AVNU), so a failed buy reverts the fee too.

**Buyer must disclose price + fee, not just price** (fixed 2026-07-02). `checkoutCart()`
bundles the fee as a *separate* ERC-20 `transfer()` call in the same multicall as
`fulfill_order` — the buyer's wallet needs `price + fee` in raw balance, not just
`price` (the marketplace's own escrow only pulls `price` via the approved allowance).
`PurchaseDialog` used to show only the raw listing price, so a wallet funded to
exactly that amount always failed the wallet's own pre-flight simulation before the
user could even confirm (surfaced as Ready/Argent's "Transaction failure predicted /
Argent multicall failed", reported on a live 4 STRK listing). `PurchaseDialog.tsx`
now renders a `PriceBreakdown` (item price / platform fee / total due) so buyers see
and fund the real required total. **Any other buy-side surface that calls
`checkoutCart`** (e.g. `counter-offers-table.tsx`'s accept-offer flow — though there
the fee is paid by the *seller* out of the just-received proceeds, in the same atomic
call, not pre-funded — verify the ordering (`fulfillCalls` before `feeCalls`) is
preserved before touching that sequence) should disclose the same breakdown if it
shows a price to a wallet that has to pre-fund it.

## RPC resilience (added 2026-06-03)

Alchemy's Starknet endpoint intermittently 503s (`-32001 "Unable to complete
request"`, ~1 in 6 calls). All Starknet RPC fails over from the keyed **MAIN**
(`RPC_MAIN_URL`) to the keyless public **FALLBACK** (`RPC_FALLBACK_URL`, lava) via
`@medialane/sdk`'s `createFailoverFetch`. The two roles are the single source in
`src/lib/constants.ts`; never re-copy that policy or hardcode a provider list
(the SDK's `PUBLIC_RPC_FALLBACKS` was removed here — it listed dead Starknet
endpoints, blastapi/nethermind).

**🔑 Browser RPC goes through the same-origin `/api/rpc` proxy
(`src/app/api/rpc/route.ts`), NOT a keyed URL.** MAIN stays the PRIMARY upstream,
but its key lives only in the server-only `STARKNET_RPC_URL`; the proxy forwards
to it and rotates to the FALLBACK server-side. The client providers (#1–#3) point
at the proxy (`RPC_PROXY_PATH=/api/rpc`) via `RPC_PRIMARY_URL` (`lib/starknet.ts`).
**Never put a keyed provider URL in a `NEXT_PUBLIC_` var — it is inlined into the
client bundle** (the 2026-06-23 key leak; both io and the dapp shipped the key in
the browser this way).
The proxy is unauthenticated (no Clerk here) but guarded by a same-origin check +
method allowlist.

**⚠️ The dapp has FOUR RpcProviders — when a read fails, find which one the
failing call uses** (the first three are documented in full at the top of
`src/lib/starknet.ts`):
1. `starknetProvider` singleton (`src/lib/starknet.ts`) — direct `Contract`
   calls + `waitForTransaction` in **non-hook** contexts (launchpad
   drop/pop/editions, transfer-ownership, `use-tx`, `use-paymaster-transaction`),
   plus `use-coin-price` (Creator Coin Ekubo price read).
2. **starknet-react's** provider (`components/starknet-provider.tsx`) — every
   `useProvider()`/`useContract()` call, i.e. the whole marketplace flow
   (`use-marketplace.ts`: `get_counter`, `royalty_info`, approvals).
3. The SDK client's `getProvider` (`@medialane/sdk` ≥ 0.28.0) — SDK-routed ops.
4. **StarkZap's internal provider** (`lib/starkzap.ts`) — all wallet ops
   (Privy/Cartridge connect, deploy, balances, staking). StarkZap bundles its
   own starknet v9 and its `SDKConfig` exposes **no `baseFetch`/provider hook**,
   so it **cannot use `failoverFetch`** — it's pinned to a single `rpcUrl`.

Providers #1–#3 share one failover policy (#1 + #2 import `failoverFetch` from
`lib/starknet`; #3 is internal to the SDK). **Never construct a bare
`new RpcProvider({ nodeUrl })` without `baseFetch`.** The patch that fixed
listings (`ab0f7e0`) was wiring `failoverFetch` into #2 — patching only #1 left
the marketplace flow broken.

**#4 (StarkZap) cannot fail over** — so it must be pinned to the *reliable*
endpoint, NOT the capped Alchemy primary. It's set to `DEFAULT_RPC_URL` (Lava,
spec 0.8.1) in `lib/starkzap.ts`. Giving it `NEXT_PUBLIC_RPC_URL` (Alchemy) made
its `starknet_chainId` chain-match check hit the intermittent `-32001` with
nothing to fall back to → "Connection failed" on wallet connect (fixed
`ddb6484`). All wallet-connect errors now route through `getFriendlyWalletError`
(`lib/wallet-error.ts`) at the set sites (`privy-connector.tsx`,
`starkzap-wallet-context.tsx`): users see "Network busy — try again", the raw
RPC blob is `console.error`-only.

`StarknetConfig` is given a tuned `QueryClient` (`refetchOnWindowFocus: false`,
bounded retries, 10s `staleTime`) so tab focus doesn't fire read bursts.

**User-facing errors:** `getFriendlyWalletError` (`src/lib/wallet-error.ts`) maps
transient RPC failures → "Network busy, try again", insufficient-balance → a
hint, and raw RPC blobs → a generic message. The raw error is logged to the
console by `use-marketplace`'s catch — never surface it in the UI.

Full incident + architecture: `medialane-core/docs/specs/2026-06-03-rpc-resilience-failover.md`.

## AVNU Paymaster (Gasless Transactions)

Medialane absorbs gas costs for users via AVNU; the 1% platform fee (above) is
charged on top of the trade.

**Core hook**: `usePaymasterTransaction` (`src/hooks/use-paymaster-transaction.ts`)
- `executeAuto(calls)` — **primary path**: tries sponsored gas first, silently falls back to `account.execute()` if AVNU rejects. Use this everywhere.
- `executeSponsored(calls)` — explicit sponsored path (requires API key)
- `executeGasless(calls, gasToken, maxAmount)` — user pays with alt token (USDC/USDT/etc.)
- `executeTraditional(calls)` — normal ETH/STRK gas

All four methods **await on-chain confirmation** via `waitForReceipt(hash)` before returning (PR #18, 2026-05-25). A revert returns `null` (or throws, for `executeAuto`) with `error` set. RPC polling failure returns the hash optimistically with a console warning. Same correctness invariant as `useTx` (fixed in PR #17). `use-marketplace.ts` has its own pipeline and was already correct.

**Feature hooks**:
- `usePaymasterMinting` — `mint(recipient, tokenURI)` calls `executeAuto` internally
- `usePaymasterMarketplace` — re-exports `usePaymasterTransaction` for marketplace calls

**Rule**: always use `executeAuto` in new UI flows. Only use the explicit variants for advanced/override scenarios.

## StarkZap Feature Hooks

- `useTxTracker(txHash)` — real-time tx monitoring (status, explorerUrl, isConfirmed)
- `useTokenBalance(tokenKey, address)` — ERC20 balance for STRK/ETH/USDC/USDT
- `useAllTokenBalances(address)` — all four balances in parallel
- `useStaking(validatorAddress)` — STRK delegation: stake, exitIntent, exitPool, claimRewards

## Data Flow

1. **IPFS/Pinata**: file uploads are SIWS-gated and go **straight to Pinata via signed URLs** — `/api/pinata/signed-url` accepts `{ kind: "image" | "document" }` (default image 10 MB; document 20 MB, pdf/doc/docx/txt/md/rtf/odt). Vercel 413s request bodies over ~4.5 MB, so never proxy file bytes through a route. Client helpers: `uploadFileToIpfs(file, token, kind)` / `uploadJsonToIpfs` (`src/lib/ipfs-upload-client.ts`), `makeUploadDocument(getValidToken)` (`src/lib/upload-document.ts` — the `IPTypeFields.uploadDocument` callback), and `uploadFailureToast` (`src/lib/upload-error.ts` — rejection-aware error messaging; a declined SIWS signature must say so, never a generic "upload failed"). Failed uploads must clear the image preview. Metadata JSON goes through `/api/pinata/json` (small bodies — direct proxy is fine).
   - **IP-type document upload (2026-06-12)**: Documents/Patents/Publications/Software types attach the work itself as the `"Document File"` trait (immutable IPFS copy — Berne Convention proof of authorship). Config = `docUpload` on the shared `IP_TEMPLATES` (`@medialane/ui`); rendered by `IPTypeDisplay` as a View-document card; the asset pages' template-key derivation includes `docUpload.traitType` (hides the raw trait + enables `hasTemplateData`).
2. **Indexed data (primary read path)**: `getMedialaneClient()` from `src/lib/medialane-client.ts` wraps the Medialane backend REST API (`NEXT_PUBLIC_MEDIALANE_BACKEND_URL`). Use `client.api.*` for tokens, collections, orders, activities, and provenance. Available methods: `getOrders`, `getActiveOrdersForToken`, `getOrdersByUser`, `getToken`, `getTokensByOwner`, `getTokenHistory`, `getCollections`, `getCollection`, `getCollectionTokens`, `getCollectionsByOwner`, `getActivities`, `getActivitiesByAddress`.
3. **On-chain reads (writes + approvals only)**: Direct RPC calls are reserved for: approval checks (`get_approved`, `is_approved_for_all`), nonce reads, and transaction execution. Never scan events or enumerate tokens on-chain — use the backend API instead.
4. **Zustand stores**: Used for mint state (`src/hooks/use-mint.ts`).
5. **User profiles**: Stored/fetched via `src/services/user_settings.ts` (off-chain).

## Directory Structure

- `src/app/` — App Router pages/layouts. Key routes: `/marketplace`, `/launchpad`, `/create`, `/asset`, `/collections`, `/creator`, `/portfolio`, `/provenance`, `/licensing`, `/airdrop`, `/mint`
  - `/airdrop` (added 2026-05-20) — Creator's Airdrop **info** page (rewards, tiers, distribution phases, rules); uses `GenesisMint`. `/mint` is the separate, generic current-mint-event page. Two distinct pages — same airdrop content for now, intended to diverge. Do not couple them.
  - `/br/mint` (Portuguese airdrop landing, 2026-05-28 trim) — paid-ads entry point. Hero only above the fold (no badge, short headline "Participe do Airdrop", trust strip above the form, `PrivyInlineLogin` when not connected, `GenesisMint` when connected). All detail sections collapsed behind a single `<details>` "Saiba mais sobre a campanha". Match this shape on any new locale-specific landing — adding inline sections kills conversion. Google Ads conversion `gtag` fires on mount; do not remove. Header keeps a hidden `<ConnectWallet />` ref so `PrivyInlineLogin`'s "outras formas de entrar" link can open the wallet picker.
  - `/` — Homepage (`src/components/home/`): hero slider, activity ticker, trending collections, new-on-marketplace, `CreatorAirdropBanner`, and the Launchpad `AirdropSection` service cards. At parity with medialane.io as of 2026-05-22. Kept deliberately lean for load speed — community/activity feeds live on the discover page, not the homepage.
  - `src/app/api/wallet/` — Privy signing endpoints (server-side)
- `src/components/` — All UI components. `src/components/ui/` contains shadcn/ui base components
  - `src/components/providers.tsx` — PrivyProvider + StarkZapWalletProvider
- `src/contexts/` — React contexts (StarkZap wallet context)
- `src/hooks/` — React hooks for contract interaction, data fetching, and state
  - `src/hooks/contracts/` — Low-level contract hooks
  - `src/hooks/use-unified-wallet.ts` — unified wallet interface
  - `src/hooks/use-paymaster-transaction.ts` — core paymaster hook
  - `src/hooks/use-paymaster-minting.ts` — sponsored minting
  - `src/hooks/use-paymaster-marketplace.ts` — sponsored marketplace ops
  - `src/hooks/use-tx-tracker.ts` — real-time transaction monitoring
  - `src/hooks/use-token-balance.ts` — ERC20 balance reads
  - `src/hooks/use-staking.ts` — STRK delegation staking
- `src/lib/` — Shared utilities, types, and constants
  - `src/lib/types.ts` — Core types: `NFT`, `Collection`, `Asset`, `DisplayAsset`, `UserProfile`, `IPType`
  - `src/lib/constants.ts` — Contract addresses, supported tokens, block numbers, AVNU config
  - `src/lib/starkzap.ts` — StarkZap SDK singleton and token presets
- `src/abis/` — Starknet contract ABI files
- `src/services/` — Service layer: Pinata config, licensing service
- `src/types/` — Shared TypeScript types (paymaster, etc.)
- `src/utils/` — Helper functions (SEO, marketplace utils, IPFS, starknet address utils, paymaster utils)
- `src/actions/` — Next.js Server Actions

## Collection Metadata Resolution

Collections are resolved via `base_uri` on-chain. The dapp reads `base_uri` from the registry contract and resolves the metadata JSON from IPFS — no backend calls.

### Strategy (in `src/hooks/use-collection-new.ts`)
- If `base_uri` is empty → no collection image available (legacy collections created before 2026-03-16)
- If `base_uri` ends with `/` (directory style) → tries sub-paths in order: `collection`, `collection.json`, `contract`, `0`. This covers OpenSea, Manifold, and Medialane conventions.
- If `base_uri` is a file CID or direct IPFS URI → fetched directly

### Image field resolution order
Metadata JSON image is read from (first non-null wins): `image`, `image_url`, `cover_image`, `banner_image_url`, `featured_image`. This ensures compatibility with OpenSea collection metadata standard.

### IPFS gateways (`src/utils/ipfs.ts`)
Multi-gateway fallback: Pinata → ipfs.io → Cloudflare → dweb.link. 24h localStorage cache (`ipfs-metadata-{cid}`). All `ipfs://` URIs go to `IPFS_GATEWAYS[0]` (Pinata) — do not change to index 1.

### OpenSea metadata standards compliance
- Token metadata: `{ name, description, image, external_url, attributes: [{ trait_type, value }] }`
- Collection metadata: `{ name, description, image, external_link }`
- `IPFSMetadata` interface in `src/utils/ipfs.ts` includes all standard OpenSea collection and token fields

---

## Asset Detail Pages (modernized 2026-05-22)

`/asset/[contract]/[tokenId]` resolves the asset type and renders one of four
variant pages, all built on a shared component set ported to match medialane.io.

**Dispatcher:** `asset-page-client.tsx` → `asset-page-{standard,edition,drop,pop}.tsx`
- `standard` — ERC-721 IP asset (license, remix, full marketplace)
- `edition` — ERC-1155 multi-edition (edition stats, holders grid)
- `drop` — Collection Drop (drop info panel + primary `CollectionDropMintButton` + secondary market)
- `pop` — POP soulbound credential (claim-only, no marketplace)

**Shared modules** (all under `src/app/asset/[contract]/[tokenId]/`):

| File | Exports |
|---|---|
| `asset-shared.tsx` | `AssetToken` type (extends SDK `ApiToken` with `balances`/`isHidden`), `AssetAtmosphere` (blurred backdrop), `useAssetMarketState` (listing/bid/`cheapest`/ownership + metadata derivation) |
| `asset-marketplace-dialogs.tsx` | `useAssetMarketplaceDialogState` (all dialog state + `handleCancelClick`) + `AssetMarketplaceDialogs` (buy/list/offer/transfer/cancel) |
| `asset-marketplace-panel.tsx` | `AssetMarketplacePanel` — price + `ActionButton` grid. An ERC-1155 owner still sees Buy/Make-offer (`canBuyMore`) since edition ownership is shared |
| `asset-top-sections.tsx` | `AssetMediaColumn`, `AssetHeaderBlock`, `buildEditionStats` |
| `asset-side-panels.tsx` | `AssetOwnersPanel`, `AssetLinksRow`, `AssetCommentsDialog` |
| `asset-overview-content.tsx` | `AssetOverviewContent` — license summary + attributes grid |

Each page keeps the dapp's own wallet hooks (`useWallet`, `useMarketplace`) and
dialog set — the shared modules are presentation + derivation only. Use the
`AssetToken` type for page-level token state; never `(token as any)`.

---

## Creator Coin pages (added 2026-06-04; Coin/Collection split 2026-06-14, SDK 0.38; design + Ekubo-swap pass 2026-06-26)

A Creator Coin (and any `external-erc20`) is a **fungible `Coin`** — its **own model**, not a
`Collection` (the 2026-06-14 split). It has no per-token `/asset/...` page and no `Token`/`Order`
rows. Coins are fetched from **`/v1/coins`** via the SDK's **`getCoins()` / `getCoin()`**, never
`getCollections`.

- **`hooks/use-coins.ts`** — `useCoins({ service? })` (list, → `/v1/coins`) + `useCoin(contract)`
  (single, → `getCoin`; returns `mutate`). The discovery explorer and the coin page read these.
  Also `useCoinsByCreator(address)` (→ `/v1/coins?creator=`, the "my coins" list) and
  `updateCoinProfile(contract, { image?, description? }, siwsToken)` (PATCH via the BFF proxy —
  the proxy allowlists `PATCH coins/:contract`).
- **Creator coin settings (2026-06-15)** — a coin's creator edits its logo + description:
  `/portfolio/coins` (list via `useCoinsByCreator`, reuses the shared `CoinCard` with an `href`
  override → settings) and `/portfolio/coins/[contract]/settings` (SIWS-gated logo upload via
  `uploadFileToIpfs` + description → `updateCoinProfile`; ownership-gated on `coin.creator`). A
  creator-only "Manage coin" link sits on `coin-page-client.tsx`. Admin coin tools live in the
  **portal** (`/admin/coins`), not here.
- **`components/coins/coins-explorer.tsx`** — injects `useCoins` into the shared
  `@medialane/ui` `CoinsExplorer` (maps `ApiCoin.totalSupply` string→number for the UI's
  `CoinCollectionLike`). The marketplace **Tokens** tab embeds this explorer.
- **`collections/[contract]/collection-page-client.tsx`** — the dispatcher resolves a **Coin**
  on the `/coins/[address]` route (or as a fallback for an old `/collections/[coin]` link) and
  early-returns `<CoinPageClient coin={coin} />`. NFT collections take the normal path.
- **`collections/[contract]/coin-page-client.tsx`** — `CoinPageClient({ coin }: { coin: ApiCoin })`:
  identity over the image-blur backdrop (same `AssetAtmosphere` settings: `opacity-30`, no tint),
  a brand-gradient-`Panel` live-price card with the price in `text-brand-orange`, supply/market-cap
  stats, and an embedded **buy-swap** (`CoinSwapCard`). Stats render only when they resolve (no
  empty `—` boxes). Deliberately NO benefit-tile copy, NO holders, NO `font-mono` (Inter only);
  primary actions use `btn-border-animated` + a solid `bg-brand-*` fill (never a static gradient
  fill / gradient-on-text). Creator chip from `coin.creator`; image from `coin.image`.
- **`hooks/use-coin-supply.ts`** — reads the ERC-20 `total_supply()` on-chain (same provider/SWR
  pattern as `use-coin-balance`) so Supply + Market Cap resolve for every coin, including external
  ERC-20s the backend doesn't index. Caller hides the stat if the read returns nothing.
- **Swap engine — Ekubo via StarkZap v3 (NO AVNU).** `hooks/use-swap.ts` routes swaps directly on
  Ekubo through StarkZap's `EkuboSwapProvider` (`getQuote` → `prepareSwap` returns approve+swap
  `Call[]` → executed via the unified wallet/paymaster, so EVERY wallet type works). `starkzap` is
  on **3.0.0**; its barrel pulls optional provider peers (Solana/Tongo/Hyperlane/RN shims) which
  `next.config.ts` stubs via `resolve.alias = false` (same approach as the Privy stubs). Pay-with
  token presets live in `utils/swap-tokens.ts` (renamed from `avnu-swap.ts` — all AVNU REST code
  deleted). The standalone `/swap` page is an experiment; it and the coin page share `use-swap`.
  **The AVNU *Paymaster* (gas sponsorship) is unrelated and still in use** — do not confuse it with
  the removed AVNU *swap aggregator*.
- **`hooks/use-coin-price.ts`** — `useCoinPrice(coin)`: SWR over `getCreatorCoinPrice(coin,
  starknetProvider)` (30s, read-only). Ekubo price math lives in `@medialane/sdk` — never
  reimplement. Uses the failover-covered `starknetProvider` singleton (RPC path #1).

---

## Launchpad & Claim form template (Phase 3 complete, 2026-06-25)

Every claim/create/mint surface in the launchpad shares one presentation template.
The vivid primitives live in `@medialane/ui` (`ServiceHeader`, `ServiceFormShell`,
`ClaimRail`); this repo holds the wiring in `src/components/claim/`:

- **`ServiceHeader`** (`@medialane/ui`) — page header: a dark `bg-card` card on a static
  brand-gradient border (`from-brand-blue via-brand-purple to-brand-rose`), solid
  `primary` icon chip, title + subtitle, optional `headerAccessory`. Used standalone
  (coin page, browse pages, `/claim` hub) or inside `ClaimRouteShell`.
- **`ClaimRouteShell`** (local) — full form layout: `ClaimBackButton` + `ServiceHeader` +
  the form wrapped in the animated full-spectrum border (`.btn-border-animated`, same one
  as the asset page / Buy button). With an `aside`, an 8/4 bento (form left, rail right);
  without, a single column. Prop **`gated`** (default **true** → wraps children in
  `WalletGate`, the form-level blur gate); pass **`gated={false}`** for pages already
  protected by their own page-level `ConnectGate` or an early-return signed-out/owner
  state (most launchpad form pages) so the connect UI isn't doubled.
- **`ClaimRail`** (`@medialane/ui`) — the vivid right-rail panels (What's included · How it
  works · trust). **`included` is optional** — omit it to skip the first panel (the coin
  page does this; its live `CoinLaunchPreview` is the rail's first panel). Per-surface
  content lives in tiny `*-aside.tsx` wrappers (`create-collection-aside`,
  `mint-edition-aside`, `create-pop-aside`, …).

**To migrate a form onto the template:** replace its old header with `ClaimRouteShell`
(or `ServiceHeader` + `ClaimBackButton` for non-form pages), wrap the existing `<Form>` as
`children`, add a `*-aside.tsx`, **de-animate the form's own submit button** (the
compartment provides the border now — drop the `btn-border-animated` wrapper, use a solid
`bg-*` button), and soften copy to plain language (no "IPFS"/"PIN"/"ERC-xxxx"). Keep all
tx logic + dialogs + the page's `ConnectGate`/`WalletGate` untouched.

**Footer copy — never claim free/sponsored gas (2026-07-03).** AVNU isn't currently
sponsoring transactions on this dapp (tested working previously, not active now — no
budget for it). Every real network transaction costs the connected wallet real gas
unless/until that changes. Footers should say **"Free to publish/mint — no platform
fee"** (true: Medialane doesn't charge a cut) — never "no gas fees" / "gas is free" /
"gasless" / "sponsored", which are currently false and were removed from ~28 files
across both apps in this pass (`getFriendlyWalletError` in `src/lib/wallet-error.ts`
also got hardened the same session — see its own header comment). Cartridge/Privy
"gasless" claims are equally false: their StarkZap-routed sponsorship depends on the
exact same `NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY` (`isStarkZapSponsorshipEnabled()` in
`src/lib/starkzap.ts`), not a separate always-on mechanism — don't reintroduce those
claims either.

**Applied to:** all claims (`/launchpad/memecoin` + `ClaimCollectionPanel`),
`/create/{collection,asset}`, `/launchpad/nfteditions/{create,[contract]/mint}`,
`/launchpad/{pop,drop,coin}/create`. **Browse/list pages**
(`/launchpad/{nfteditions,pop,drop}`) and the combined **`/claim`** hub use
`ServiceHeader` + `ClaimBackButton` only (no animated form/rail), constrained to
`max-w-5xl`. The **coin page** keeps its stepper + `CoinLaunchPreview` live-preview rail
and adds `ServiceHeader` + a `ClaimRail` (How it works + a "Locked forever" trust panel,
no `included`) under the preview. `ClaimCollectionPanel` gained an optional `helperText`
prop (default unchanged) so `/launchpad/memecoin` shows coin-specific copy. Mirrors the
medialane-io rollout end-to-end.

### Launchpad grid: 5 groups + dynamic filter bar (2026-07-03, @medialane/ui ≥ 0.35.1)

The `/launchpad` browse page (`LaunchpadGroupedSections` + `LaunchpadServiceCard` +
`LaunchpadFilterBar`, all in `@medialane/ui`) was regrouped and made searchable —
full design/plan history: `docs/superpowers/specs/2026-07-03-launchpad-grid-redesign-design.md`
+ `docs/superpowers/plans/2026-07-03-launchpad-grid-redesign.md`.

- **5 groups, not 10** (`src/data/launchpad-services.ts`, `LAUNCHPAD_SERVICE_GROUPS`):
  Single Edition (now includes Collection Drop + Remix Asset — same mechanical type,
  one unique tradeable item), Limited Editions, Coins (absorbs Claim Memecoin),
  Community (new — POP Protocol + IP Tickets + IP Club + IP Sponsorship, grouped by
  audience/event intent, not mechanism), Claims. Adding a new service: pick one of
  these 5 (or `coming-soon`) for its `group:` field — don't invent a new group without
  updating `LAUNCHPAD_SERVICE_GROUPS` and confirming the fit with the user first.
- **Cards are 3-per-row on desktop** (`lg:grid-cols-3`, was capped at 2) at a smaller,
  denser size (`min-h-[200px]`, 2 feature chips shown, not 3; the `example`/"e.g. ..."
  line was dropped from the card entirely — still in the data model for other
  consumers, just not rendered here).
- **`LaunchpadFilterBar`** (new component, exported from `@medialane/ui`) sits above
  the grouped sections: a search input (matches title/blurb/subtitle) + multi-select
  group pills + a live result count. State is lifted into `LaunchpadGroupedSections`
  itself (not the filter bar) so the grid below reacts to the same query/activeGroups
  state. Active pill = the brand gradient (`from-brand-purple to-brand-blue`), not
  generic `bg-primary`. No "show coming soon" toggle — removed after shipping (no
  `building`/`soon`-status services exist; it was pure noise). A "Browse services"
  eyebrow label + top border separates the filter bar from the hero above it — no
  filled background card (would clash with the cards' own aurora-glow treatment).
- **`PopHowItWorks`** (the 3-step explainer column) now keys off the `community`
  group and is additionally gated on POP actually being in the filtered set — if a
  search/filter hides POP, the explainer hides with it.
- Copy across several taglines was tightened after user review: no jargon (dropped
  "ERC-721"/"soulbound" from the IP Tickets card), no sales-y phrasing ("who show up
  for you" → plain feature list), Claims rewritten to cover all three claim types
  (username / collection name / external collection) instead of reading as just
  "claim your name".

**Adding a new launchpad service:** add its `ServiceDefinition` to
`LAUNCHPAD_SERVICE_DEFINITIONS` in `@medialane/ui`'s `src/data/launchpad-services.ts`
with a `group:` from the 5 above, publish a new `@medialane/ui` version, bump both
apps. No per-app wiring needed beyond `overrides` (href/browseHref/status) in each
app's `launchpad-content.tsx` — the grid, grouping, and filter bar are entirely
shared-package-driven.

### Standard form layout + UX conventions (2026-06-27, @medialane/ui ≥ 0.28.0)

The 2-column form layout is the **standard** every launchpad create/mint surface follows.
Three conventions were added; keep new forms consistent with them:

- **Plain header, gradient on the form only.** `ServiceHeader` gained a `plain` variant
  (neutral border, no brand gradient); `ServiceFormShell` renders the header **`plain`** so a
  create/mint page shows the animated gradient border **only on the form**, never stacked on
  the header. Standalone headers (browse pages, coin detail, `/claim` hub) still pass no
  `plain` → they keep the gradient (single accent, nothing competing).
- **Multi-step forms use the shared shell, not a bespoke layout.** `ServiceFormShell` gained
  an **`aboveForm`** slot (left column, between header and form) and a **sticky right rail**
  on desktop. New **`StepNav`** (`@medialane/ui`, `accentText`/`accentBg` props) is the
  polished stepper (solid active dot, outlined check for done, filling connector). The
  **coin page (`/launchpad/coin/create`) now uses `ServiceFormShell`**: plain header in the
  left column, animated border on the form, `StepNav` via `aboveForm`, `CoinLaunchPreview` +
  `CreateCoinAside` as the `aside`. Do NOT reintroduce its old `grid-cols-[1fr_340px]` /
  full-width-gradient-header layout.
- **Mobile-flush nested panels — no panels-inside-panels on phones.** Collapsible sub-panels
  inside a form (Licensing, IP Type & Metadata, drop/edition sections) drop their border,
  rounding, and horizontal padding on mobile so fields get the form card's full width. The
  `sm:`-gated pattern: wrapper `sm:overflow-hidden sm:rounded-xl sm:border sm:border-border`,
  trigger `px-0 py-3 sm:px-5 sm:py-4`, content `px-0 pb-4 sm:px-5 sm:pb-5 …`. Applies to
  `/create/asset`, `/launchpad/nfteditions/[contract]/mint`, `/launchpad/drop/create`, remix.

---

## Notification System (added 2026-05-12)

**Types** (`src/types/notification.ts`): `offer`, `offer_accepted`, `sale`, `listing`, `mint`, `transfer`, `asset_received`, `cancelled`, `announcement`. Priority: `"normal" | "spotlight"`. Celebratory flag drives confetti.

**`NotificationSpotlight`** (`src/components/shared/notification-spotlight.tsx`): Modal panel shown once per wallet session for all unread spotlight-priority notifications. Animated dot pagination, confetti on celebratory items, marks only seen items as read on close. Mounted in `providers.tsx`, **gated on `!isStandalone`** (2026-05-28) so it does not fire on `/br/*`, `/mint`, or `/airdrop` — firing "Creator's Airdrop is live" on the page the user just used to claim it was confusing new sign-ups.

**`useNotifications`** (`src/hooks/use-notifications.ts`): Aggregates offer_accepted (fulfilled ERC20 orders), received offers (`useReceivedOffers`), activity events, and announcements into a unified list. Read state persisted in localStorage via `src/lib/notification-storage.ts`.

**Shared meta** (`src/lib/notification-meta.ts`): `NOTIFICATION_ICON`, `NOTIFICATION_COLOR`, `NOTIFICATION_LABEL` — used by both `notification-row.tsx` and `notification-spotlight.tsx`. Add new types here first.

**`AcceptOfferDialog`** (`src/components/marketplace/accept-offer-dialog.tsx`): Full accept flow with success state + confetti. Wired into `ReceivedOffersTable` via `acceptOrder` state pattern (replaces the old toast).

## Rewards System (added 2026-05-12)

50-level DAO-managed XP + badge system. Scores live on the backend; frontend reads them via SWR hooks.

**Hooks**: `useRewards(address)`, `useLeaderboard(page, limit)` in `src/hooks/use-rewards.ts`.

**Components**: `LevelBadge` (`src/components/rewards/level-badge.tsx`) — color-coded level chip in sm/md/lg sizes. `BadgeShelf` (`src/components/rewards/badge-shelf.tsx`) — lazy-loaded Lucide icon badges with tooltips.

**Page**: `/rewards` — My Rank tab (level card with ambient glow, XP progress bar, badge shelf, breakdown table) + Leaderboard tab. Uses `useWallet()` for address resolution.

## Conventions

- Filenames: `kebab-case`; components: `PascalCase`
- Absolute imports with `@/` prefix throughout
- Tailwind CSS for all styling; avoid custom CSS
- Starknet addresses should be normalized using `normalizeStarknetAddress` from `src/lib/utils.ts`
- Token IDs are represented as `bigint` in contract calls and decoded as `u256` (low + high << 128)
- All contract calls that modify state go through `executeAuto` (paymaster) or `account.execute()` — never call contracts directly in server code
- New transaction flows should default to `executeAuto` from `usePaymasterTransaction` or the feature-specific paymaster hook
- **Wallet**: `useWallet()` is the single hook for everything — `{ address, isConnected, isConnecting, walletType, error, connect, disconnect, execute }`. `useUnifiedWallet()`/`useWalletSession()` are legacy compat shims over it; don't reach for them in new code.
- **Page layout**: top-level pages wrap content in `<PageContainer className="box-border max-w-full pt-20 …">` from `@medialane/ui` (full-width, content aligns with the logo) — do NOT use Tailwind's `container` (it caps width + centers → mismatched side gutters). `pt-20` clears the fixed logo/nav. Asset pages use `mx-auto w-full px-4 sm:px-6 lg:px-8` (full-width without PageContainer).
- **No hover-only effects** on cards/grids (scale, lift-shadow, color-shift) — most users are on mobile where hover doesn't exist. Keep `active:` (touch) states; reserve `hover:` for non-essential desktop polish only.
- **Token images go through `resolveTokenImage` (`src/lib/utils.ts`), not raw `ipfsToHttp`.** It returns a browser-loadable URL or `null` (so the UI shows its own fallback, never the `/placeholder.svg` sentinel), and is **idempotent** (already-resolved/proxied URLs pass through). The marketplace dialogs that take a `tokenImage` prop (`listing`/`transfer`/`offer`/`counter-offer`) **resolve it internally** — so callers pass the **raw** `token.metadata?.image` and never repeat `x ? ipfsToHttp(x) : null`. (Forgetting that incantation is what dropped the image in the portfolio/collection dialogs, 2026-06-27.)
