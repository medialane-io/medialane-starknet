# Account panel redesign: compact contextual dashboard

**Date:** 2026-08-13
**Status:** Approved, ready for implementation plan
**Backlog item closed by this spec:** redesign the wallet account popup
(`src/components/account-panel.tsx`) — currently shows a crypto balance the
connected wallet extension already displays, colored badges that don't match
the brand palette, and (as of the prior small fix already shipped) no longer
shows the rewards/XP level badge, which was flagged as not belonging here.

## Why

The current panel (screenshot: `0x000c...2592` / Braavos / Starknet badges /
`Balance: 10.51203 STRK` / Disconnect) duplicates what Braavos/Ready/Cartridge
already show natively, uses emerald-green badges that don't exist in the
brand palette (`brand-blue`/`brand-rose`/`brand-purple`/`brand-orange` only —
confirmed against `tailwind.config.ts`), and offers no Medialane-specific
value: nothing here tells you what needs your attention or what you own on
the platform. Direct product decision from this session: replace the balance
readout with a compact, vertically-oriented dashboard — closer in spirit and
proportions to media-wallet's popup (tall, narrow, icon-action row, content
stack, single footer action) — surfacing only what's real and actionable,
each item collapsed to one "smart chip" rather than an expanded list.

## What's in scope

- Redesigned identity header: keep the avatar treatment (already approved),
  replace the two colored badges with one muted caption line.
- A compact icon-action row: Explorer, Settings, Theme toggle.
- Up to three smart-chip content rows, each a single clickable summary line,
  each optional/conditional per the priority order below.
- Wrong-network warning (kept, functional necessity, real alert state).
- Full-width Disconnect button (kept, unchanged behavior).

**Explicitly out of scope:** crypto balance display (dropped — the connected
wallet already shows this), the rewards/XP badge (already removed in a prior
commit), any embedded settings form (Settings is a link out to the existing
`/settings` page, not a mini-form here), multi-wallet switching UI (not a
capability this panel has today).

## Content priority (trim from the bottom if it doesn't fit cleanly)

1. **Activity** — always shown when the address has at least one activity
   row. Single most-recent event only, not a list.
2. **Offers received** — shown only when count > 0. Disappears entirely
   otherwise; never renders an empty/zero state.
3. **My assets** — static count + link. **Cut this first** if the card gets
   too tall or busy — it's the lowest-urgency of the three (a stat, not
   something requiring action), while Activity and Offers both surface
   something that just happened or needs a decision.

## Data sources (all real, already used elsewhere in this codebase)

- **Activity**: `useActivitiesByAddress(address)` from `@/hooks/use-activities`
  → `{ activities: ApiActivity[], isLoading }`. Take `activities[0]` (backend
  already returns most-recent-first, matching how `portfolio/page.tsx`
  consumes this hook via `.slice(0, N)`). `ApiActivity` fields used: `type`
  (`"mint" | "transfer" | "sale" | "listing" | "offer" | "cancelled"`),
  `timestamp`, `token?.name`, `nftContract`, `nftTokenId`, `price?.formatted`
  + `price?.currency` for sale/offer/listing rows.
- **Offers received**: `useReceivedOffers(apiConfig, address)` from
  `@/hooks/use-orders` → `{ orders: ApiOrder[], isLoading }`. Count =
  `orders.length`. Links to `/portfolio/received` (confirmed route —
  **not** `/portfolio/offers`, which is a different page for offers the
  user has *made*).
- **My assets**: `useTokensByOwner(address, 1, 1)` from `@/hooks/use-tokens`
  → `{ meta }`. Count = `meta?.total`. Links to `/portfolio/assets`. Page
  size `1` is enough — only the total count is used, not the token rows.
- **Theme toggle**: `NavThemeToggle` from `@medialane/ui` — no props, already
  a compact self-contained Sun/Moon segmented control (used today as
  `NavCommandMenu`'s footer slot). Drop in directly, no new component.
- **Explorer link**: same pattern already in `account-panel.tsx` today —
  `${networkConfig.explorerUrl}/address/${address}`.
- **Settings link**: `/settings` (confirmed route, existing page).

## Layout

```
┌─────────────────────────────────┐
│ [avatar]  0x000c...2592  [copy] ✕│
│           Braavos · Starknet     │  ← one muted caption line, no badges
├─────────────────────────────────┤
│  [Explorer]  [Settings]  [◐/☾]   │  ← compact icon-action row
├─────────────────────────────────┤
│  ⟳  Sold "Taj Mahal" · 2h ago  › │  ← Activity smart chip
│  ✉  3 offers received         › │  ← Offers chip (conditional, >0 only)
│  ▦  12 assets                 › │  ← My assets chip (cut first if tight)
├─────────────────────────────────┤
│  [!] Switch network needed       │  ← conditional, unchanged from today
├─────────────────────────────────┤
│  [        Disconnect        ]   │  ← unchanged
└─────────────────────────────────┘
```

Each smart chip: leading icon in the same muted circular chip treatment used
elsewhere this session (`bg-foreground/[0.06]` circle), one line of summary
text, trailing chevron, entire row is a `<Link>`. No secondary text row, no
timestamps-plus-description — one line, full stop. If a chip's content is
loading, it doesn't render (no skeleton flash for a popup this small and
short-lived); if there's genuinely nothing to show (e.g. zero activity for a
brand-new address), the whole panel simply has fewer rows — never a "No
activity yet" placeholder taking up space for its own sake.

### Activity chip summary text, per type

Keeps this readable without a description field the API doesn't provide:
- `sale`: `Sold "{token.name}"` (fall back to `Sale` if no token name)
- `listing`: `Listed "{token.name}"`
- `offer`: `Offer on "{token.name}"`
- `transfer`: `Transferred "{token.name}"`
- `mint`: `Minted "{token.name}"`
- `cancelled`: `Cancelled listing`

Trailing: `· {timeAgo(activity.timestamp)}` (existing `timeAgo` util from
`@/lib/utils`, already used throughout the app).

## Component structure

Single file change: `src/components/account-panel.tsx` gets restructured
in place — no new files needed, every piece (hooks, `NavThemeToggle`,
`assetHref`) already exists and is imported from its current location. The
existing `truncate()` helper, `copyAddress`/`handleDisconnect` handlers, and
the wrong-network block are kept as-is; only the identity badges and the
balance block are replaced.

## Error handling

- Any of the three data hooks failing or being slow: that chip simply
  doesn't render (same "no skeleton, no empty state" rule as above) — a
  failed activity fetch should never block the panel from opening or show
  a visible error inside a lightweight popup.
- Wrong-network state: unchanged from today, still blocks nothing, still
  just a warning banner.

## Testing

No existing test file covers `account-panel.tsx` (confirmed: no
`account-panel.test.ts` in the repo). This redesign is presentational/data-
composition, not business logic — verification is manual (open the panel
with a connected wallet, confirm each chip's condition: zero offers → chip
absent; some offers → chip present with correct count; fresh address with no
activity → activity chip absent) plus the standard `bun run typecheck` /
`bun run lint` / `bun test` gate before shipping, same as every change this
session.

## Rollout

Single PR — this is one file, no phasing needed.
