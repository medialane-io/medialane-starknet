# Medialane — Starknet App

Permissionless Web3 app for programmable IP monetization on Starknet — Creator Launchpad + IP Marketplace with full wallet sovereignty.

**Starknet App:** https://starknet.medialane.io  
**Consumer App (social login):** https://medialane.io

---

## Core Features

### Creator Launchpad
Deploy and manage tokenized IP assets on-chain:
- **Collection Drops** — ERC721 curated NFT launches with mint pages
- **IP1155** — ERC1155 multi-edition IP tokens
- **Proof of Purchase (POP)** — on-chain purchase receipts and access passes

### NFT Marketplace
The high-integrity exchange for all tokenized creator assets:
- List, buy, make and accept offers
- Cart-based multi-asset checkout
- On-chain provenance and ownership verification
- Programmable licensing terms enforced by smart contracts

### Creator Profiles
- Profile by wallet address (`/creator/[address]`) and by username slug (`/creator/[username]`)
- 4-tab layout: Collections · Listings · Analytics · Activity
- Cinematic gradient banner with dominant-color extraction

### Claims Hub (`/claim`)
- Genesis NFT claim
- Collection ownership claim (on-chain verified, no auth token required)
- Username claim (DAO-reviewed)
- Branded creator page claim

---

## Fee Structure

| Service | Fee |
|---|---|
| Creator Launchpad | 1% |
| NFT Marketplace | 1% |

Gas fees are sponsored for all users via the AVNU Paymaster.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Blockchain | Starknet Mainnet |
| RPC | Alchemy |
| Wallet — Browser | Argent / Braavos via starknetkit |
| Wallet — Gaming | Cartridge Controller (session keys, auto-gasless) |
| Wallet — Social | Privy (email / Google / Twitter, no seed phrase) |
| Wallet SDK | StarkZap |
| Gasless Transactions | AVNU Paymaster |
| IP Tokenization | Mediolano Protocol (zero-fee) |
| Marketplace Protocol | Medialane Protocol (SNIP-12 signed orders) |
| Backend API | medialane-backend via `@medialane/sdk` |
| Shared UI | `@medialane/ui` v0.4.0 |
| Styling | Tailwind CSS + shadcn/ui |
| IPFS | Pinata |
| Deployment | Vercel (autodeploy on push to main) |

---

## Wallet System

All three strategies are unified under `useUnifiedWallet` — one hook, one interface:

| Strategy | Best for | Gas |
|---|---|---|
| **Argent / Braavos** | Existing Starknet users | Sponsored via AVNU |
| **Cartridge Controller** | Gamers, power users | Auto-gasless (session keys) |
| **Privy (Email / Social)** | Web2 onboarding | Sponsored via AVNU |

No Clerk. No ChipiPay. Disconnect: `const { disconnect } = useUnifiedWallet()`.

---

## Route Map

| Route | Page |
|---|---|
| `/` | Home / discover |
| `/marketplace` | NFT marketplace grid |
| `/collections` | Collection explorer |
| `/launchpad` | Launchpad hub |
| `/launchpad/drop/create` | Deploy new ERC721 drop |
| `/launchpad/drop/[contract]` | Drop detail + mint |
| `/launchpad/ip1155/create` | Deploy new ERC1155 collection |
| `/launchpad/ip1155/[contract]/mint` | ERC1155 mint page |
| `/launchpad/pop/[contract]` | Proof of Purchase page |
| `/create` | Asset creation hub |
| `/asset/[contract]/[tokenId]` | Token detail + buy/offer/remix |
| `/collections/[contract]` | Collection detail |
| `/creator/[address]` | Creator profile by wallet address |
| `/creator/[username]` | Creator profile by username slug |
| `/claim` | Claims hub |
| `/portfolio` | Portfolio overview |
| `/portfolio/settings` | Profile settings + disconnect wallet |
| `/portfolio/activity` | On-chain activity |
| `/account/[address]` | Public account view |
| `/provenance/[contract]/[tokenId]` | On-chain provenance |
| `/licensing` | Licensing info |

---

## Architecture

```
src/
├── app/                        # Next.js App Router pages
│   ├── api/
│   │   ├── wallet/sign/        # Privy server-side signing
│   │   ├── wallet/starknet/    # Privy wallet provisioning
│   │   └── pinata/             # IPFS upload endpoints
│   ├── marketplace/
│   ├── launchpad/
│   │   ├── drop/[contract]/    # ERC721 drop pages
│   │   ├── ip1155/             # ERC1155 pages
│   │   └── pop/[contract]/     # POP pages
│   ├── create/
│   ├── portfolio/
│   ├── collections/
│   ├── claim/                  # Claims hub
│   ├── creator/[address]/      # Creator profiles (address + username routing)
│   ├── asset/[contract]/[tokenId]/
│   ├── account/[address]/
│   ├── provenance/
│   └── licensing/
├── components/
│   ├── claim/                  # WalletGate, ClaimCollectionPanel, UsernameClaimPanel
│   ├── creator/                # ActivityRow, ACTIVITY_META, CreatorAnalytics
│   ├── marketplace/            # ListingCard, OrderCard
│   ├── shared/                 # CollectionCard, TokenCard (from @medialane/ui)
│   └── ui/                     # shadcn/ui base components
├── hooks/
│   ├── use-unified-wallet.ts        # Single interface across all wallet types
│   ├── use-paymaster-transaction.ts # Core AVNU paymaster hook (executeAuto)
│   ├── use-marketplace.ts           # SNIP-12 order creation & fulfillment
│   ├── use-collections.ts           # Collection data
│   ├── use-orders.ts                # Order / listing data
│   ├── use-activities.ts            # On-chain activity feed
│   ├── use-profiles.ts              # Creator profile data
│   ├── use-username-claims.ts       # Username claim + resolution
│   └── use-drops.ts                 # Drop contract data
├── lib/
│   ├── constants.ts            # Contract addresses, tokens, AVNU config
│   ├── creator-utils.ts        # addressPalette() — deterministic color from address
│   ├── medialane-client.ts     # @medialane/sdk singleton
│   └── utils.ts                # cn, ipfsToHttp, normalizeAddress, timeAgo, formatDisplayPrice
└── abis/                       # Starknet contract ABIs
```

---

## Key Patterns

### Transactions
Always use `executeAuto` — tries AVNU sponsored gas, falls back silently:
```ts
const { executeAuto } = usePaymasterTransaction();
await executeAuto([{ contractAddress, entrypoint, calldata }]);
```

### Backend API calls
Empty JWT string — backend verifies on-chain ownership:
```ts
const client = getMedialaneClient();
await client.api.claimCollection(contract, wallet, "");
```

### Lazy tab data loading
Pass `null` as SWR key when a tab isn't active:
```ts
const { orders } = useUserOrders(activeTab === "listings" ? walletAddress : null);
```

---

## Environment Variables

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_STARKNET_NETWORK` | `mainnet` or `sepolia` |
| `NEXT_PUBLIC_RPC_URL` | Alchemy or custom RPC endpoint |
| `NEXT_PUBLIC_COLLECTION_CONTRACT` | Optional collection registry override |
| `NEXT_PUBLIC_EXPLORER_URL` | Block explorer base URL |
| `NEXT_PUBLIC_GATEWAY_URL` | IPFS gateway URL |
| `PINATA_JWT` | Pinata JWT for server-side uploads |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app ID (public) |
| `PRIVY_APP_SECRET` | Privy app secret (**server only**) |
| `NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY` | AVNU API key for sponsored gas |
| `NEXT_PUBLIC_MEDIALANE_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_MEDIALANE_API_KEY` | Backend API key |

Marketplace contract addresses are sourced from `@medialane/sdk`; do not configure marketplace addresses in dapp env files.

---

## Development

```bash
npm install
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npx tsc --noEmit    # Type-check
npm run lint         # ESLint
```

---

## Protocol Integrations

**Mediolano Protocol** — Zero-fee IP tokenization. Provides collection registry, on-chain provenance, ERC721/ERC1155 ownership.

**Medialane Protocol** — Marketplace smart contracts on SNIP-12 typed data signing:
1. Seller signs order parameters off-chain
2. ERC721 `approve` + `register_order` multicall submitted on-chain
3. Buyer fulfills via signed `fulfill_order` + `approve` + execute multicall
4. Cancellations: signed off-chain → `cancel_order`

**AVNU Paymaster** — All transactions attempt sponsored execution first (`executeAuto`), falling back silently if AVNU rejects. Users never need ETH/STRK.

**StarkZap SDK** — Abstracts Cartridge Controller (session keys) and Privy (email/social, server-managed keys). Transaction monitoring, ERC20 balances, and STRK staking all powered by StarkZap.

---

## Medialane DAO

[dao@medialane.org](mailto:dao@medialane.org)  
[@integrityweb](https://t.me/integrityweb)
