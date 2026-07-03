# Launchpad grid redesign: density, grouping, dynamic filtering

**Date:** 2026-07-03
**Status:** Approved, ready for implementation plan
**Scope:** `@medialane/ui` (shared source) — consumed by `medialane-starknet` and `medialane-io`

## Problem

The current `/launchpad` page (`LaunchpadGroupedSections` + `LaunchpadServiceCard` in
`@medialane/ui`) has three problems, confirmed against a live screenshot:

1. **Cards are too big.** Each card is `min-h-[240px]` with `p-6 sm:p-8`, a 2xl–3xl title,
   a giant watermark icon, and up to 3 feature chips. The grid caps at
   `grid-cols-1 sm:grid-cols-2` — never more than 2 per row at any breakpoint, even on a
   wide desktop viewport.
2. **Grouping doesn't match how creators think about services.** Groups are organized by
   product type today (Single Editions, Limited Editions, Creator Coins, Collection Drop,
   POP Protocol, IP Tickets, IP Sponsorship, IP Club, Licensing & Remix, Claims — 10 groups
   total for 13 services). Collection Drop, for example, is mechanically the same kind of
   item as a single NFT or an NFT Collection (one unique, tradeable token) but sits in its
   own group.
3. **No way to navigate or narrow the list.** With 13 services across 10 sections, there's
   no search, no filter, no way to jump around — just a long scroll.

## Regrouping

Five groups replace the current ten. Grouping is by *what kind of thing you're making /
why a creator is here*, not by underlying token mechanics — confirmed with the user that
IP Tickets (mechanically a unique tradeable item, same as an NFT) belongs with the other
community/audience services instead, since selling event tickets is a different creator
intent than publishing art.

| New group key | Title | Services (existing `key`s) |
|---|---|---|
| `single-edition` | Single Edition | `mint-ip-asset`, `create-collection`, `collection-drop` *(moved)*, `remix-asset` *(moved)* |
| `limited-editions` | Limited Editions | `ip-collection-1155`, `mint-editions` |
| `coins` | Coins | `creator-coins`, `claim-memecoin` |
| `community` | Community | `pop-protocol` *(moved)*, `ip-tickets` *(moved)*, `ip-club` *(moved)*, `ip-sponsorship` *(moved)* |
| `claims` | Claims | `claim-username`, `claim-collection`, `claim-collection-name` |

`coming-soon` stays as-is (currently empty; the strip component is unchanged).

This is a data-only change in `src/data/launchpad-services.ts`: `LAUNCHPAD_SERVICE_GROUPS`
gets rewritten to these 5 entries, and each moved service's `group:` field is updated.
`ServiceGroup` the TypeScript union type shrinks to 6 keys (5 + `coming-soon`). No service
definitions, hues, icons, or per-app overrides change — only which group each belongs to.

Taglines (existing groups keep their current tagline; two need new copy since they now
cover a wider set):
- `single-edition`: "Publish one-of-a-kind pieces — a song, a photo, a film, a timed drop, or a remix — under your own name."
- `limited-editions`: unchanged — "Release your work in numbered copies your fans can collect and trade."
- `coins`: unchanged tagline text, shorter title only — "Launch your own coin — or bring one you already made — and let your community back you."
- `community`: "Connect with the people who show up for you — badges, tickets, memberships, and direct sponsorship."
- `claims`: unchanged — "Quick wins — claim your name and bring in work you have already made."

The `pop-protocol`-only special case in `LaunchpadGroupedSections` (the `PopHowItWorks`
side column shown alongside POP's cards) moves to key off `community` instead, but only
renders when the group being rendered is `community` *and* `pop-protocol`'s def is in the
list being shown by the current filter (see Filtering below) — if a filter hides POP,
the how-it-works column hides with it.

## Card density

Target: 3 per row on desktop (`sm:grid-cols-2 lg:grid-cols-3`), meaningfully smaller cards,
still touch-friendly, keeping the aurora-glow/hue identity system.

Changes to `LaunchpadServiceCard`:
- `min-h-[240px]` → `min-h-[200px]`
- Padding `p-6 sm:p-8` → `p-5 sm:p-6`
- Title `text-2xl sm:text-3xl` → `text-xl sm:text-2xl`
- Watermark icon `h-44 w-44` → `h-32 w-32`, icon tile `h-14 w-14` → `h-12 w-12`
- Feature chips: show at most 2 (`features.slice(0, 2)`) instead of all 3 — the full list
  stays in `ServiceDefinition.features` for other consumers (e.g. detail pages), the card
  just displays fewer
- `example` line (the italic "e.g. ...") drops from the card entirely — it was already
  marked `unused by the 0.9.0 card` intent in one place and adds height for little value
  at this density; kept in the data model since detail/create pages may still read it
- `featured` full-width span behavior is unchanged (still `sm:col-span-2` — at 3-col it
  reads as 2-of-3, still a valid showcase treatment)

The grid class in `LaunchpadGroupedSections` changes from `grid-cols-1 sm:grid-cols-2
gap-5 sm:gap-7` to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5`.

## Dynamic filter bar (new component: `LaunchpadFilterBar`)

A new component in `@medialane/ui`, rendered once above the grouped sections by
`LaunchpadGroupedSections` (so both apps get it for free — no per-app wiring beyond the
existing `overrides` prop).

**State owned by `LaunchpadGroupedSections`** (lifted, not inside the filter bar, so the
grid below can react to it):
```ts
const [query, setQuery] = useState("");
const [activeGroups, setActiveGroups] = useState<Set<ServiceGroup>>(new Set()); // empty = all
const [showComingSoon, setShowComingSoon] = useState(false);
```

**`LaunchpadFilterBar` props:** `query`, `onQueryChange`, `groups` (the 5
`ServiceGroupDefinition`s, `coming-soon` excluded from the pill list), `activeGroups`,
`onToggleGroup`, `showComingSoon`, `onToggleComingSoon`, `resultCount`.

**Behavior:**
- Search input: matches against `title`, `blurb`, and `subtitle` (case-insensitive
  substring — no fuzzy-match dependency needed for ~13 items)
- Group pills: multi-select toggle buttons, one per group (Single Edition / Limited
  Editions / Coins / Community / Claims). None active = show all groups (the default —
  clicking a pill narrows to just that group; clicking it again clears back to "all")
- Coming-soon toggle: off by default (hides not-yet-live services from view entirely,
  since the current `ComingSoonStrip` already handles that group separately when
  present — this toggle instead governs whether individual `status: "building"` items
  *within* a live group, if any exist later, show up)
- Result count: "N services" text, live-updating, sits at the end of the filter bar
- Empty state: when search + filters produce zero matches anywhere, render a single
  centered message + a "Clear filters" button in place of the grouped sections

**Filtering logic** (in `LaunchpadGroupedSections`):
```ts
const matches = (def: ServiceDefinition) =>
  (activeGroups.size === 0 || activeGroups.has(def.group)) &&
  (showComingSoon || def.status === "live") &&
  (query === "" || `${def.title} ${def.blurb} ${def.subtitle}`.toLowerCase().includes(query.toLowerCase()));
```
Each group section filters its `defs` through `matches` and hides itself entirely
(returns `null`) if it has zero matching defs after filtering — so narrowing to
"Community" makes the other 4 section headers disappear, not just their cards.

**Micro-interactions:**
- Framer Motion `layout` prop added to each card's motion.div so cards animate
  position/opacity smoothly when the filtered set changes, instead of an instant
  reflow — consistent with the existing staggered-entrance treatment
- Active filter pills get the same hue-forward treatment already used elsewhere (solid
  fill + light shadow when active, outline when inactive)
- `AnimatePresence` wraps the group-section list so a section that filters down to zero
  results fades out instead of vanishing abruptly

## What's explicitly out of scope

- No change to the individual service create/detail pages, hrefs, or per-app overrides
- No new "intent-based quick start" buttons (considered, not what the user wants — this
  is a real filterable grid, not a curated set of shortcuts)
- No backend/API changes — this is presentation-layer only over the existing static
  `LAUNCHPAD_SERVICE_DEFINITIONS` array
- `ComingSoonStrip` (the `coming-soon` group's own rendering) is unchanged

## Rollout

Single change in `@medialane/ui`, version bump + publish, then a version bump in both
`medialane-starknet` and `medialane-io` (`package.json` + `bun.lock`). Both apps already
consume `LaunchpadGroupedSections` with zero other wiring beyond `overrides`, so no
per-app code changes are expected — verify this holds once the component is built.
