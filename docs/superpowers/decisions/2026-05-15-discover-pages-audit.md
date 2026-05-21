# Discover / filter pages — audit (2026-05-15)

## Files

| Page | LOC | Surface |
|---|---|---|
| `src/app/[ipType]/ip-type-page-client.tsx` | 487 | Discover assets filtered by IP type (Audio, Art, Photography, …) at `/[ipType]` |
| `src/app/marketplace/marketplace-page-client.tsx` | 461 | Main marketplace at `/marketplace` |

## Overlap measurement

- **Shared imports:** 5 lines out of ~30 per file
- **Pairwise diff:** 901 lines (out of files that are 461 + 487 = 948 lines total — meaning almost no shared lines)
- **Shared components already in use:** `TokenCard`, `ListingCard`, `CurrencyIcon` — extracted in `src/components/shared/` and `src/components/marketplace/`

## Where each page diverges

### ip-type
- Hero banner with the IP type's icon + description from `IP_TYPE_CONFIG`
- Filters by IP type (drives the URL `/audio`, `/photography`, etc.)
- Renders an inline OfferDialog
- Has a search-by-name input (filters client-side)
- Uses Framer Motion for the hero animations
- Configures the token grid columns based on viewport breakpoints differently from marketplace

### marketplace
- Sort dropdown (recent / price asc / price desc / volume)
- Currency filter chips (USDC / USDT / ETH / STRK / WBTC)
- Collection filter (modal-style dropdown)
- Sort-by-type chip row (different from ip-type's IP-type config)
- Pagination + load-more
- Different token grid behavior (renders ListingCards from active orders, not TokenCards from all tokens)

## DECISION

**No refactor.** Despite the surface similarity ("filterable token grid"), the two pages source different data shapes and apply different filter dimensions:

- ip-type lists *tokens* filtered by IP-type trait, with offer-creation flow inline
- marketplace lists *active listings* (orders) filtered by sort/currency/collection, with cart + purchase flow

Forcing a shared `<FilteredTokenGrid>` would require either:
- Conditional logic to switch between token-source vs order-source modes (one component doing two jobs)
- A complex prop interface that accepts the data source + filter config + render mode (premature framework)

Both are worse than the current honest divergence.

## What IS already shared

The expensive parts are extracted:
- Token / listing card rendering: `TokenCard`, `ListingCard` in `src/components/shared/` and `src/components/marketplace/`
- Currency icons: `CurrencyIcon`
- Skeleton states: `TokenCardSkeleton`, `ListingCardSkeleton`
- Common formatters: `formatDisplayPrice`, `ipfsToHttp`

The page-level filter toolbars are intentionally bespoke because each surface filters along different axes.

## RATIONALE

Per memory `feedback_medialane_dapp_patterns.md` — the dapp has a documented preference for variant files over conditional components (e.g. the asset page dispatcher pattern, the asset preview dialog). Two filterable grids with different filter dimensions naturally fit that pattern — keep them as two route shells.

If a third filterable grid lands (e.g. a "discover by creator" page), that's the right time to look again — but it would more likely fit the same variant pattern than benefit from forced unification.
