# Genesis Mint Pages Design

**Goal:** Port `/mint` (English) and `/br/mint` (Portuguese) from medialane-io to medialane-dapp, replacing Clerk + ChipiWallet with the dapp's ConnectWallet + usePaymasterMinting.

**Architecture:** Two standalone pages (no sidebar, own header/footer) that share a `GenesisMint` widget. `providers.tsx` skips the Shell for `/mint` and `/br/*` routes via `usePathname`. The mint widget drives a simple state machine: not-connected → connected → minting → success/error. All gas is sponsored by AVNU.

**Tech Stack:** `useWallet`, `ConnectWallet`, `usePaymasterMinting`, `usePathname`, existing constants + two new env vars.

---

## Standalone Layout

`providers.tsx` already wraps every page in `Shell` (sidebar + footer). Mint pages need their own standalone layout. Fix: add a `usePathname` check inside `Providers` — if the route is `/mint` or starts with `/br/`, render `{children}` directly instead of `<Shell>`.

```tsx
// In Providers (providers.tsx)
const pathname = usePathname();
const isStandalone = pathname === "/mint" || pathname.startsWith("/br/");
// ...
{isStandalone ? children : <Shell>{children}</Shell>}
```

Aurora, CartDrawer, NotificationSpotlight, and Toaster remain outside Shell so they still work on all routes.

---

## Constants

Add three env vars to `src/lib/constants.ts` (same pattern as existing MINT_CONTRACT):

```
NEXT_PUBLIC_BR_MINT_CONTRACT   — Starknet contract address for the BR NFT
NEXT_PUBLIC_BR_NFT_URI         — IPFS URI for the BR NFT metadata
NEXT_PUBLIC_BR_NFT_IMAGE_URL   — Direct image URL for the BR NFT card
```

---

## Shared GenesisMint Widget

`src/components/airdrop/genesis-mint.tsx` — accepts `contract`, `nftUri`, `storageKey`, and optional `locale` (`"en" | "br"`) props.

**State machine:**

| State | UI |
|---|---|
| `idle` (not connected) | `ConnectWallet` button with "Join the airdrop" label |
| `ready` (connected, not minted) | "Claim my spot" primary button |
| `minting` | Spinner + status message |
| `success` | Green check, tx hash, explorer link |
| `error` | Error message + Retry button |

**Already-minted detection:** On mount, check `localStorage.getItem(storageKey + "_" + address)`. If found, jump straight to `success` and show the stored tx hash.

**Mint call:** `usePaymasterMinting` → `mint(address, tokenUri)`. The hook calls `executeAuto` internally so gas is AVNU-sponsored. Token URI: use `nftUri` prop directly if set; otherwise upload metadata via `/api/pinata` (same fallback as medialane-io).

**ConnectWallet integration:** When not connected, render `<ConnectWallet label="Join the airdrop" />`. After connection the wallet context updates, the component re-renders into `ready` state automatically — no extra logic needed.

---

## Pages

### `/mint` — `src/app/mint/`

**`page.tsx`** — Next.js metadata (same as medialane-io/mint: title, description, OG, Twitter, canonical, hreflang) + `<Suspense><MintContent /></Suspense>`.

**`mint-content.tsx`** — Standalone page, ported 1:1 from medialane-io:
- Header: `MedialaneLogo` + `ConnectWallet` (top-right, icon-only when not connected, account sheet when connected)
- Hero: badge + headline + `<GenesisMint contract={MINT_CONTRACT} nftUri={GENESIS_NFT_URI} storageKey="ml_mint" />` + NFT image card
- Creator Fund section (3 cards: Join for free, Creator fund, Boost your chances)
- How it works section (base tier card + 2 bonus cards)
- Distribution phases (Phase 1: 5,000 members / Phase 2: 10,000 members)
- Eligibility + Disclaimer
- Bottom CTA (shown only when not connected — renders `<ConnectWallet label="Claim my spot" />`)
- Footer (campaign terms, ToS, Privacy, About)

### `/br/mint` — `src/app/br/mint/`

**`page.tsx`** — metadata in `pt_BR` locale, canonical `/br/mint`, hreflang pair with `/mint`.

**`br-mint-content.tsx`** — Same structure as `mint-content.tsx` but all copy in Portuguese (ported 1:1 from medialane-io). Uses `BR_MINT_CONTRACT`, `BR_NFT_URI`, `BR_NFT_IMAGE_URL` constants. `storageKey="ml_br_mint"`.

---

## Data Flow

```
User lands on /mint
  → providers.tsx: isStandalone=true → renders children directly (no Shell)
  → mint-content.tsx renders standalone layout
  → GenesisMint: checks localStorage for prior mint
    → not minted, not connected → shows ConnectWallet button
    → user clicks → ConnectWallet dialog opens (Privy / injected / Cartridge)
    → user connects → wallet context updates → GenesisMint → "ready"
    → user clicks "Claim my spot"
    → usePaymasterMinting.mint(address, tokenUri)
    → AVNU sponsors gas → tx submitted
    → success: tx hash stored in localStorage, success UI shown
```

---

## Error Handling

- `MINT_CONTRACT` empty → disable mint button, show "Mint not started yet"
- `mint()` throws → show error message + Retry button (resets to `ready`)
- NFT image 404 → fallback gradient placeholder (same as medialane-io `EventCard`)
- Pinata upload fails (fallback path) → surface error in widget

---

## File Map

| Action | File |
|---|---|
| Modify | `src/app/providers.tsx` |
| Modify | `src/lib/constants.ts` |
| Create | `src/components/airdrop/genesis-mint.tsx` |
| Create | `src/app/mint/page.tsx` |
| Create | `src/app/mint/mint-content.tsx` |
| Create | `src/app/br/mint/page.tsx` |
| Create | `src/app/br/mint/br-mint-content.tsx` |
