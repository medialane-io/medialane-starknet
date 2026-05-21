# Dapp Missing Pages — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port three incomplete or missing product pages in medialane-dapp: upgrade the creator username profile to a full-featured tabbed page, add the `/claim` hub, and add the wallet disconnect section to portfolio settings.

**Source of truth:** `medialane-io` for UI patterns. All auth replacements follow the dapp's established pattern: `useUnifiedWallet` + `usePaymasterTransaction().executeAuto()` instead of Clerk + ChipiPay.

**Tech Stack:** Next.js 15 App Router, React 19, starknet-react, starknetkit, SWR, Tailwind, shadcn/ui, lucide-react, sonner

---

## Scope

Three self-contained tasks in priority order:

1. **Task 1** — Upgrade `/creator/[username]` from 159-line simplified view to full 4-tab profile
2. **Task 2** — Add `/claim` hub (collection import + username claim + branded page showcase)
3. **Task 3** — Add Disconnect Wallet section to `/portfolio/settings`

No new backend API endpoints are needed. All three tasks use existing hooks and components.

---

## Task 1: Creator Username Profile Upgrade

### Problem

`/creator/[address]/page.tsx` renders `CreatorUsernamePageClient` from `creator-username-client.tsx` (159 lines). This is a simplified two-section layout (collections + assets). The medialane-io version (`creator-username-client.tsx`, 438 lines) has a full cinematic profile with 4 tabs, collection carousels, activity timeline, and dominant-color theming.

The dapp already has the full-featured `creator-page-client.tsx` (645 lines) used for address-based routes (`/account/[address]`). The username page should match that quality.

### Design

Rewrite `src/app/creator/[address]/creator-username-client.tsx` in place. The file resolves a username to a `walletAddress` via `useCreatorByUsername`, then renders the same rich profile the address-based page provides.

**Data flow:**
```
username prop
  → useCreatorByUsername(username) → { creator, walletAddress }
  → useTokensByOwner(walletAddress)       [lazy: only when "assets" tab active]
  → useCollectionsByOwner(walletAddress)  [lazy: only when "collections" tab active]
  → useUserOrders(walletAddress)          [lazy: only when "listings" tab active]
  → useActivitiesByAddress(walletAddress) [always — feeds activity tab + stats]
  → useDominantColor(bannerImage)         [always — drives cinematic banner]
```

All these hooks already exist in the dapp. No new hooks needed.

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Cinematic banner (dominant-color mesh gradient overlay) │
├─────────────────────────────────────────────────────────┤
│  Avatar  │  @username  displayName  bio  │  Links  CTA  │
│          │  Stats: Assets · Listed · Colls             │
├─────────────────────────────────────────────────────────┤
│  [Collections] [Listings] [Analytics] [Activity]        │
├─────────────────────────────────────────────────────────┤
│  Tab content (lazy loaded)                              │
└─────────────────────────────────────────────────────────┘
```

**Tab definitions:**

| Tab | Hook | Component |
|-----|------|-----------|
| Collections | `useCollectionsByOwner` | `CollectionCarouselRow` per collection, grid fallback |
| Listings | `useUserOrders` filtered to active | `ListingCard` |
| Analytics | `useActivitiesByAddress` | `CreatorAnalytics` |
| Activity | `useActivitiesByAddress` | `ActivityRow` timeline |

**Cinematic banner:** Inject CSS vars `--h1`, `--h2`, `--h3` derived from `addressPalette(walletAddress)`. Overlay: `bg-[radial-gradient(ellipse_at_top_right,...hsl(var(--h1),...)]` over `useDominantColor` extracted image color. Identical to existing `creator-page-client.tsx` pattern.

**Address palette (deterministic color identity):**
```typescript
function addressPalette(address: string) {
  const seed = parseInt(address.slice(2, 10) || "a1b2c3d4", 16);
  const h1 = seed % 360;
  const h2 = (h1 + 137) % 360;
  const h3 = (h1 + 73) % 360;
  return { h1, h2, h3 };
}
```

**Activity event map** (copy from io verbatim):
```typescript
const ACTIVITY_META = {
  mint:      { label: "Minted",    textColor: "text-yellow-400",  bg: "bg-yellow-500/8 border-yellow-500/15" },
  listing:   { label: "Listed",    textColor: "text-violet-400",  bg: "bg-violet-500/8 border-violet-500/15" },
  sale:      { label: "Sold",      textColor: "text-emerald-400", bg: "bg-emerald-500/8 border-emerald-500/15" },
  offer:     { label: "Offer",     textColor: "text-amber-400",   bg: "bg-amber-500/8 border-amber-500/15" },
  transfer:  { label: "Transfer",  textColor: "text-blue-400",    bg: "bg-blue-500/8 border-blue-500/15" },
  cancelled: { label: "Cancelled", textColor: "text-muted-foreground", bg: "bg-muted/30 border-border" },
};
```

**"Full profile" CTA:** Link `href="/account/${creator.walletAddress}"` — keeps `/creator/[slug]` exclusively for username routes.

**Not-found state:** Same as current simplified version (emoji + message + Browse Marketplace button).

**Loading state:** Banner skeleton + identity row skeleton + tab skeleton (same structure as existing `loading.tsx`).

### Files

- **Modify:** `src/app/creator/[address]/creator-username-client.tsx` — full rewrite (target ~400 lines)
- **No other files change** — all dependencies already exist:
  - `src/components/creator/collection-carousel-row.tsx` ✓
  - `src/components/creator/creator-analytics.tsx` ✓
  - `src/components/marketplace/listing-card.tsx` ✓
  - `src/hooks/use-creator-by-username` (via `use-username-claims.ts`) ✓
  - `src/hooks/use-dominant-color.ts` ✓

---

## Task 2: `/claim` Hub

### Problem

No `/claim` route exists in the dapp. The io version provides a three-panel hub: genesis mint, collection import, and username claim. In the dapp, Clerk is absent — auth is wallet-based.

### Design

**New files:**
- `src/app/claim/page.tsx` — metadata wrapper (server component)
- `src/app/claim/claim-page-client.tsx` — hub layout (4 sections)
- `src/components/claim/wallet-gate.tsx` — wallet connect gate (replaces `ClaimGate`)
- `src/components/claim/claim-collection-panel.tsx` — collection import panel (no Clerk JWT)

**Reused without change:**
- `src/components/shared/username-claim-panel.tsx` ✓ (already dapp-native)

#### `page.tsx`

Server component. Metadata + `<ClaimPageClient />`. Identical structure to io.

```typescript
export const metadata: Metadata = {
  title: "Claims & Drops — Medialane",
  description: "Claim your Genesis NFT, import your Starknet collection, or reserve your creator username on Medialane.",
};
```

#### `claim-page-client.tsx`

Four sections separated by `SectionDivider`:

1. **Genesis Mint** — Static card with `<Package />` icon, copy about the genesis drop, CTA button linking to `/launchpad/drop` (no inline mint flow — keeps the hub simple; the drop page handles minting).

2. **NFT Collection** — `<WalletGate><ClaimCollectionPanel /></WalletGate>`

3. **Creator Username** — `<WalletGate><UsernameClaimPanel /></WalletGate>`

4. **Branded Collection Page** — Static showcase card (port io verbatim: URL bar mockup + 3 feature tiles + CTA buttons to `/create/collection` and `/collections`). No auth needed.

#### `wallet-gate.tsx`

Replaces io's `claim-gate.tsx`. Same blur-overlay pattern but uses `useUnifiedWallet` + starknetkit modal instead of Clerk.

```
if (!isConnected):
  show blur overlay with:
    Lock icon
    "Connect wallet to access this claim"
    <Button onClick={handleConnectWallet}>Connect wallet</Button>
else:
  render children directly
```

Connect handler: `useStarknetkitConnectModal` + `useConnect` (identical pattern to other dapp components).

```typescript
interface WalletGateProps { children: React.ReactNode }

export function WalletGate({ children }: WalletGateProps) {
  const { isConnected } = useUnifiedWallet();
  const { connectAsync, connectors } = useConnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
    modalTheme: "dark",
  });
  // ...blur overlay or children
}
```

#### `claim-collection-panel.tsx`

Port of io's `claim-collection-panel.tsx` with Clerk JWT removed. Auth is implicit: the backend verifies on-chain ownership against the connected `walletAddress`.

**Steps:** `input` → `verifying` → `success` / `manual` → `pending`

Key change from io:
```typescript
// io (Clerk JWT):
const token = await getToken();
const result = await client.api.claimCollection(contractAddress, walletAddress, token);

// dapp (no JWT):
const result = await client.api.claimCollection(contractAddress, walletAddress, "");
```

The backend's on-chain ownership check does not require a JWT — it reads the chain directly. The empty string for token is consistent with how the dapp's `portfolio/settings` already handles profile updates.

**Manual fallback:** When on-chain verification fails, show email + notes form → `client.api.requestCollectionClaim({ contractAddress, walletAddress, email, notes })`. No token needed for this endpoint.

`StepIndicator`, `success`, `pending`, `manual`, `verifying` states: port io verbatim (pure UI, no auth).

Uses: `useUnifiedWallet()` for `walletAddress`, `getMedialaneClient()` for API calls.

---

## Task 3: Portfolio Settings Disconnect

### Problem

`src/app/portfolio/settings/page.tsx` is missing the Account section (bottom of page). In io this shows a Sign-Out button. In the dapp it should show a Disconnect Wallet button.

### Design

Add an Account section at the end of the existing settings page. The section disconnects the unified wallet (clears both StarkZap and injected wallet state) and navigates to `/`.

```typescript
// At bottom of settings page, after existing form sections:
<div className="space-y-4 pt-4 border-t border-border">
  <div>
    <h3 className="text-sm font-semibold">Account</h3>
    <p className="text-xs text-muted-foreground mt-0.5">Manage your wallet connection</p>
  </div>
  <Button
    variant="outline"
    className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
    onClick={() => { disconnect(); router.push("/"); }}
  >
    <LogOut className="h-4 w-4" />
    Disconnect wallet
  </Button>
</div>
```

`disconnect` comes from `useUnifiedWallet()` (already imported in the file). `router` from `useRouter()`. `LogOut` from lucide-react.

**Files:**
- **Modify:** `src/app/portfolio/settings/page.tsx` — add Account section + import `LogOut` + `useRouter`

---

## What Is Explicitly Out of Scope

- `/docs/*`, `/learn/*`, `/contact`, `/about` — institutional pages, skip
- `/admin/*` — already ported, no changes
- `/portfolio/wallet` — ChipiWallet panel, not applicable to dapp
- `/welcome`, `/br/mint` — Clerk-gated or promotional, skip
- `opengraph-image.tsx` — OG image generation, out of scope
- No changes to `creator-page-client.tsx` (address-based route) — it's complete
- No changes to `page.tsx` for the creator route — redirect logic is correct

---

## Self-Review

**Placeholder scan:** No TBD or TODO items. All file paths are exact. All hook names verified against dapp codebase.

**Internal consistency:** 
- Task 1 uses hooks that exist in dapp — verified.
- Task 2's `WalletGate` uses the same starknetkit pattern as `drop/create/page.tsx` and `collection-drop-mint-button.tsx` — consistent.
- Task 3 uses `disconnect` from `useUnifiedWallet` — verified it exists at line 40 of the hook.
- Empty JWT string in `ClaimCollectionPanel` is consistent with `portfolio/settings` existing behavior.

**Scope check:** Three independent, focused tasks. Each produces a working page on its own. No shared state or coordination between tasks.

**Ambiguity check:** 
- Genesis Mint section in `/claim`: links to `/launchpad/drop` rather than embedding a mint flow. This is intentional — keeps the hub simple and avoids duplicating the genesis drop page.
- `creator-username-client.tsx` rewrite: replaces the file entirely rather than creating a new component. The `page.tsx` import stays unchanged.
