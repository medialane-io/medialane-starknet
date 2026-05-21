# @medialane/ui v0.2 — Component Package Expansion Design

## Goal

Expand the `@medialane/ui` shared component package with all display-layer components that are currently duplicated across `medialane-dapp` and `medialane-io`. Validate against `medialane-dapp` first (lower risk, needs most work), then migrate `medialane-io` (main app, battle-tested package by then).

## Architecture

### Why package-first

Both apps currently maintain near-identical copies of the same components in `src/components/shared/`. Any bug fix or visual change must be applied twice. As the platform grows, this drift compounds. The goal of this work is a single source of truth in `@medialane/ui` that both apps consume via a facade pattern, with zero churn to page-level imports.

### Migration phases

1. **Phase 1 (this spec):** Expand `@medialane/ui` with all pure-display components. Publish as `v0.2.0`.
2. **Phase 2:** Migrate `medialane-dapp` page by page — update facades, delete local copies, verify.
3. **Phase 3:** Migrate `medialane-io` page by page — same process, leveraging Phase 2 validation.

### Facade pattern (both apps, unchanged)

Both apps keep `@/components/shared/X` files. Migration = update each facade to:

```ts
export { TokenCard, TokenCardSkeleton } from "@medialane/ui";
```

Page-level imports (`@/components/shared/token-card`) are never touched. Zero churn in feature code.

---

## Phase 1: @medialane/ui v0.2 Scope

### What ships in v0.2

| Component | Source | Change |
|---|---|---|
| `MotionCard` | Identical in both apps | Direct lift into package |
| `ScrollSection` | Identical in both apps (zero diff) | Direct lift |
| `ShareButton` | Identical in both apps (zero diff) | Direct lift |
| `TokenCard` + `TokenCardSkeleton` | Diverged — io is richer | **Redesigned: callback-driven** |
| `CollectionCard` + `CollectionCardSkeleton` | Minor diff | **Unified: merged props** |

### What is deferred (Phase 2)

| Component | Reason |
|---|---|
| `ActivityTicker` | Calls `useOrders()` internally — app-specific SWR hook |
| `ActivityRow` | Calls `useToken()`, reads `ACTIVITY_TYPE_CONFIG` + `EXPLORER_URL` — app-specific |

Phase 2 will split these into a pure display layer (to `@medialane/ui`) and a data container (stays per-app).

---

## Component Specifications

### MotionCard

Lifted directly from both apps' `src/components/ui/motion-primitives.tsx` (identical). Exported as a standalone component.

```ts
// No props beyond standard motion.div — whileTap scale-[0.96] always applied
export function MotionCard({ children, className, ...props }: MotionCardProps)
```

Requires `framer-motion` as peer dependency (already in both apps).

---

### ScrollSection

Lifted directly — zero diff between apps. Pure layout shell for horizontal-scroll carousels.

```ts
interface ScrollSectionProps {
  icon: React.ElementType;
  title: string;
  href?: string;          // "See all" link destination
  hrefLabel?: string;     // Label for the link, default "See all"
  children: React.ReactNode;
  className?: string;
}
```

No data fetching. No shadcn dependencies (pure Tailwind + Next.js `Link`).

---

### ShareButton

Lifted directly — zero diff between apps. Web Share API with clipboard fallback. Uses `sonner` for the copy toast.

```ts
interface ShareButtonProps {
  title: string;
  url?: string;            // defaults to window.location.href
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}
```

Requires `sonner` as peer dependency (already in both apps). Renders as a plain `<button>` styled with Tailwind — no shadcn `Button` import needed.

---

### TokenCard (redesigned)

The key component. Redesigned to be fully callback-driven — no embedded dialogs, no app-specific hooks. The io version's action layout (the better design) is used as the base.

**Props:**

```ts
export interface TokenCardProps {
  token: ApiToken;

  // Ownership & cart state — managed by consumer
  isOwner?: boolean;          // default false
  inCart?: boolean;           // default false — consumer passes cart state

  // Display options
  showBuyButton?: boolean;    // default true
  rarityTier?: RarityTier;   // "legendary" | "epic" | "rare" | "uncommon" | "common"
  className?: string;

  // Action callbacks — any omitted = that button hidden
  onBuy?: (token: ApiToken) => void;
  onCart?: (token: ApiToken) => void;     // replaces inline useCart
  onOffer?: (token: ApiToken) => void;    // replaces inline OfferDialog
  onList?: (token: ApiToken) => void;     // replaces inline ListingDialog
  onCancel?: (token: ApiToken) => void;
  onTransfer?: (token: ApiToken) => void;
  onRemix?: (token: ApiToken) => void;
  onReport?: (token: ApiToken) => void;   // replaces inline ReportDialog

  // Overflow menu slot — app provides DropdownMenu trigger if needed
  overflowMenu?: React.ReactNode;
}
```

**Action states (using io's renderActions logic):**

| State | Buttons shown |
|---|---|
| Non-owner + listed | Buy (if onBuy) · Cart (if onCart) · Offer (if onOffer) |
| Non-owner + unlisted | View · Offer (if onOffer) |
| Owner + listed | Cancel listing (if onCancel) · Transfer (if onTransfer) |
| Owner + unlisted | List for sale (if onList) · Transfer (if onTransfer) |
| No callbacks at all | No action bar — pure display card |

**What is NOT in the package TokenCard:**
- `useCart` — consumer manages cart, passes `inCart` + `onCart`
- `useRouter` — navigation via `Link href` only
- `ListingDialog` / `OfferDialog` / `ReportDialog` — consumer opens dialogs from callbacks
- `DropdownMenu` — consumer passes fully-composed trigger via `overflowMenu` slot

**RarityTier:** Exported from @medialane/ui alongside TokenCard:
```ts
export type RarityTier = "legendary" | "epic" | "rare" | "uncommon" | "common";
```

**TokenCardSkeleton:** Exported alongside TokenCard. Same design as io version (the better skeleton layout).

---

### CollectionCard (unified)

Merges both apps' versions:

```ts
interface CollectionCardProps {
  collection: ApiCollection;
  /** Shows gear icon linking to settings — used in portfolio pages */
  settingsHref?: string;
  className?: string;
}
```

`collection.isKnown` (from SDK type) is read directly — no extra prop needed. The verified badge (CheckCircle2) is shown when `collection.isKnown === true`.

Floor price tooltip (HelpIcon from io version) is included. HelpIcon is implemented inline using a Radix Popover — no local file dependency.

**CollectionCardSkeleton:** Exported alongside CollectionCard.

---

## Package Dependencies

### New peer dependencies (both consuming apps already have these)

```json
{
  "peerDependencies": {
    "framer-motion": ">=10",
    "lucide-react": ">=0.400.0",
    "sonner": ">=1.0.0",
    "next": ">=14",
    "@medialane/sdk": ">=0.6.0",
    "@radix-ui/react-popover": ">=1.0.0"
  }
}
```

`@radix-ui/react-popover` is needed by `CollectionCard` for the `HelpIcon` floor price tooltip. Both apps already have all `@radix-ui/*` packages installed via shadcn.

### Tailwind compatibility

Both consuming apps must include `@medialane/ui` source in their Tailwind `content` array:

```js
// tailwind.config.ts (both apps)
content: [
  "./src/**/*.{ts,tsx}",
  "./node_modules/@medialane/ui/src/**/*.{ts,tsx}",
]
```

The package uses the same Tailwind design tokens (`brand-blue`, `brand-purple`, `brand-orange`, `brand-rose`, `brand-navy`, `card-base`, CSS variable-based colors) that both apps define in their `globals.css`. No new tokens are introduced.

---

## File Structure (medialane-ui/src/)

```
components/
  address-display.tsx       ← existing
  brand-icon.tsx            ← existing
  brand-logo.tsx            ← existing
  currency-icon.tsx         ← existing
  ip-type-badge.tsx         ← existing
  motion-primitives.tsx     ← NEW: MotionCard (+ FadeIn, Stagger for completeness)
  scroll-section.tsx        ← NEW: direct lift
  share-button.tsx          ← NEW: direct lift
  token-card.tsx            ← NEW: redesigned callback-driven
  collection-card.tsx       ← NEW: unified
index.ts                    ← updated exports
```

---

## index.ts Export Plan

```ts
// Existing exports (unchanged)
export { cn } from "./utils/cn.js";
export { formatDisplayPrice } from "./utils/format.js";
export { shortenAddress } from "./utils/address.js";
export { ipfsToHttp } from "./utils/ipfs.js";
export { IP_TYPE_DATA, IP_TYPE_DATA_MAP } from "./data/ip-types.js";
export type { IpTypeData } from "./data/ip-types.js";
export { BRAND } from "./data/brand.js";
export { CurrencyIcon, CurrencyAmount } from "./components/currency-icon.js";
export { IpTypeBadge, IP_TYPE_CONFIG, IP_TYPE_MAP } from "./components/ip-type-badge.js";
export { AddressDisplay } from "./components/address-display.js";
export { MedialaneIcon } from "./components/brand-icon.js";
export { MedialaneLogoFull } from "./components/brand-logo.js";

// New v0.2 exports
export { MotionCard, FadeIn, Stagger, StaggerItem, SPRING, EASE_OUT } from "./components/motion-primitives.js";
export { ScrollSection } from "./components/scroll-section.js";
export type { ScrollSectionProps } from "./components/scroll-section.js";
export { ShareButton } from "./components/share-button.js";
export type { ShareButtonProps } from "./components/share-button.js";
export { TokenCard, TokenCardSkeleton } from "./components/token-card.js";
export type { TokenCardProps, RarityTier } from "./components/token-card.js";
export { CollectionCard, CollectionCardSkeleton } from "./components/collection-card.js";
export type { CollectionCardProps } from "./components/collection-card.js";
```

---

## Consumer Migration (per app, per component)

For each component migrated:

1. Delete `src/components/shared/<component>.tsx` (local implementation)
2. Create or update `src/components/shared/<component>.tsx` as a pure facade:
   ```ts
   export { TokenCard, TokenCardSkeleton } from "@medialane/ui";
   export type { TokenCardProps, RarityTier } from "@medialane/ui";
   ```
3. Pages that call `onOffer`/`onCart`/`onList`/etc. pass their local handler — no page changes required for pages that don't use those callbacks.
4. Pages that previously relied on the embedded `ListingDialog`/`OfferDialog` inside `TokenCard` must now manage the dialog themselves and pass `onList`/`onOffer` callbacks. This is the **only breaking change** and only affects pages that were relying on the embedded fallback (primarily dapp's portfolio page).
5. For `medialane-io` (Phase 3): the io `TokenCard` had a full `DropdownMenu` with ~8 items built-in. After migration, this dropdown must be constructed in the page/container and passed via `overflowMenu`. Each dropdown item maps directly to an existing callback (`onBuy`, `onCart`, `onOffer`, `onRemix`, `onReport`, etc.). This is more verbose to set up but makes the action menu fully customizable per-page.

---

## Testing Plan

After publishing v0.2.0:

1. Update `medialane-dapp` to `@medialane/ui@0.2.0`
2. Migrate each shared component facade (one at a time)
3. For each: `bun run build` must pass, visual check in browser
4. Key pages to verify: home, discover, marketplace, collections, asset, creator, portfolio
5. Once dapp is clean, repeat for `medialane-io`

---

## Out of Scope (this spec)

- ActivityTicker / ActivityRow migration (Phase 2)
- Sidebar / navigation components (too app-specific — different NAV items, auth requirements)
- Footer (does not exist in either app yet — separate initiative)
- medialane-io page-by-page migration (Phase 3)
- Any new features — this is purely extracting what already exists
