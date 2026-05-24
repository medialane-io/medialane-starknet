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

```
# Network
NEXT_PUBLIC_STARKNET_NETWORK          # "mainnet" or "sepolia" (defaults to mainnet)
NEXT_PUBLIC_RPC_URL                   # Starknet RPC endpoint (for write/execution only)

# Contracts
# Marketplace contract addresses come from @medialane/sdk only.
NEXT_PUBLIC_COLLECTION_721_CONTRACT   # ERC-721 collection registry (renamed from NEXT_PUBLIC_COLLECTION_CONTRACT on 2026-05-22)
NEXT_PUBLIC_COLLECTION_1155_CONTRACT  # ERC-1155 collection registry
NEXT_PUBLIC_NFTCOMMENTS_CONTRACT      # NFT comments contract

# Medialane Backend API (indexed on-chain data — used for all reads)
NEXT_PUBLIC_MEDIALANE_BACKEND_URL     # Backend base URL (default: http://localhost:3001) — public, used to construct URLs
MEDIALANE_API_KEY                     # Server-only API key. The BFF proxy at
                                      # /api/proxy/v1/[...path] injects this on
                                      # outbound requests. NEVER set
                                      # NEXT_PUBLIC_MEDIALANE_API_KEY (would
                                      # ship the key in the browser bundle).

# IPFS
NEXT_PUBLIC_GATEWAY_URL               # Pinata IPFS gateway URL
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

The app supports three wallet connection strategies, unified by `useUnifiedWallet`:

1. **Argent / Braavos** — injected browser wallets via `starknetkit` + `@starknet-react/core`
2. **Cartridge Controller** — session-key gaming wallet via StarkZap SDK (`OnboardStrategy.Cartridge`). Auto-gasless, policies scoped to collection + marketplace contracts.
3. **Privy** — email/social login via StarkZap SDK (`OnboardStrategy.Privy`). Keys managed server-side; no seed phrase required. Requires the two Privy API routes.

**Priority**: StarkZap wallet (Cartridge/Privy) takes priority over injected in `useUnifiedWallet`.

**Provider tree** (in `src/app/layout.tsx`):
```
ThemeProvider
  └─ Providers (PrivyProvider + StarkZapWalletProvider)  ← src/components/providers.tsx
       └─ StarknetProvider                               ← src/components/starknet-provider.tsx
```

**Key files**:
- `src/lib/starkzap.ts` — SDK singleton (`getStarkZapSdk()`), token presets, staking config
- `src/contexts/starkzap-wallet-context.tsx` — `StarkZapWalletProvider` + `useStarkZapWallet()`
- `src/hooks/use-unified-wallet.ts` — normalises all wallet types into one interface
- `src/hooks/use-wallet.ts` — **normalized identity hook**: wraps `useUnifiedWallet()`, returns `{ address, isConnected, walletType }`. Use this in any component that only needs to know who the user is. Use `useUnifiedWallet` directly only when you also need signing or execution.
- `src/components/providers.tsx` — PrivyProvider + StarkZapWalletProvider client wrapper
- `src/app/api/wallet/starknet/route.ts` — Privy wallet get-or-create (server)
- `src/app/api/wallet/sign/route.ts` — Privy raw signing endpoint (server)

**Compat note**: StarkZap bundles starknet v9 internally; the app uses v8 via starknet-react. They coexist — share primitives (addresses, tx hashes) as plain strings only; never mix Account objects across stacks.

## Starknet Integration Patterns

**Contract ABIs** come from `@medialane/sdk` (currently 0.20.0). Import `IPMarketplaceABI`, `Medialane1155ABI`, `IPCollectionABI`, `IPNftABI`, `POPFactoryABI`, `POPCollectionABI`, `DropFactoryABI`, `DropCollectionABI`, `IPCollection1155FactoryABI`, `IPCollection1155ABI` from the SDK. Each ABI lives in its own file under `src/abis/` in the SDK (split in v0.19.0); the public import path is unchanged via `abis/index.ts` barrel. The only local ABI that remains in this repo's `src/abis/` is `user_settings.ts` — everything contract-related lives in the SDK as the single source of truth.

**Marketplace order flow** (in `src/hooks/use-marketplace.ts`):
- Orders use **SNIP-12 typed data signing** (`getOrderParametersTypedData`, `getOrderFulfillmentTypedData` from `src/utils/marketplace-utils.ts`)
- Listings: sign → ERC721 `approve` + `register_order` multicall
- Offers: sign → ERC20 `approve` + `register_order` multicall
- Buying a listing: approve the ERC-20 total + `fulfill_order` signature, executed as one atomic multicall
- Cancellations: sign typed cancellation data → `cancel_order`

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

## AVNU Paymaster (Gasless Transactions)

Medialane absorbs gas costs for users via AVNU; the 1% platform fee (above) is
charged on top of the trade.

**Core hook**: `usePaymasterTransaction` (`src/hooks/use-paymaster-transaction.ts`)
- `executeAuto(calls)` — **primary path**: tries sponsored gas first, silently falls back to `account.execute()` if AVNU rejects. Use this everywhere.
- `executeSponsored(calls)` — explicit sponsored path (requires API key)
- `executeGasless(calls, gasToken, maxAmount)` — user pays with alt token (USDC/USDT/etc.)
- `executeTraditional(calls)` — normal ETH/STRK gas

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

1. **IPFS/Pinata**: Asset metadata and images are uploaded via server actions (`src/app/api/pinata/`, `src/app/api/forms-ipfs/`). Server-side Pinata SDK is configured in `src/services/config/server.config.ts`.
2. **Indexed data (primary read path)**: `getMedialaneClient()` from `src/lib/medialane-client.ts` wraps the Medialane backend REST API (`NEXT_PUBLIC_MEDIALANE_BACKEND_URL`). Use `client.api.*` for tokens, collections, orders, activities, and provenance. Available methods: `getOrders`, `getActiveOrdersForToken`, `getOrdersByUser`, `getToken`, `getTokensByOwner`, `getTokenHistory`, `getCollections`, `getCollection`, `getCollectionTokens`, `getCollectionsByOwner`, `getActivities`, `getActivitiesByAddress`.
3. **On-chain reads (writes + approvals only)**: Direct RPC calls are reserved for: approval checks (`get_approved`, `is_approved_for_all`), nonce reads, and transaction execution. Never scan events or enumerate tokens on-chain — use the backend API instead.
4. **Zustand stores**: Used for mint state (`src/hooks/use-mint.ts`).
5. **User profiles**: Stored/fetched via `src/services/user_settings.ts` (off-chain).

## Directory Structure

- `src/app/` — App Router pages/layouts. Key routes: `/marketplace`, `/launchpad`, `/create`, `/asset`, `/collections`, `/creator`, `/portfolio`, `/provenance`, `/licensing`, `/airdrop`, `/mint`
  - `/airdrop` (added 2026-05-20) — Creator's Airdrop **info** page (rewards, tiers, distribution phases, rules); uses `GenesisMint`. `/mint` is the separate, generic current-mint-event page. Two distinct pages — same airdrop content for now, intended to diverge. Do not couple them.
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

## Notification System (added 2026-05-12)

**Types** (`src/types/notification.ts`): `offer`, `offer_accepted`, `sale`, `listing`, `mint`, `transfer`, `asset_received`, `cancelled`, `announcement`. Priority: `"normal" | "spotlight"`. Celebratory flag drives confetti.

**`NotificationSpotlight`** (`src/components/shared/notification-spotlight.tsx`): Modal panel shown once per wallet session for all unread spotlight-priority notifications. Animated dot pagination, confetti on celebratory items, marks only seen items as read on close. Mounted globally in `providers.tsx`.

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
- **Wallet identity**: use `useWallet()` → `{ address, isConnected }` in components that only need to know who the user is. Use `useUnifiedWallet()` only when you need signing, wallet type, or execution capabilities.
