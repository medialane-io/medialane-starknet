# Porting fiat price display + auto-swap purchases to medialane-starknet

**Date:** 2026-08-12
**Status:** Approved, ready for implementation plan
**Origin:** Ports the design already shipped and validated in medialane-io
(see that repo's `docs/superpowers/specs/2026-08-12-usd-price-autoswap-design.md`
and the follow-up price-component refinement work in the same session) to
the dapp — full external-wallet marketplace (Ready / Braavos / injected /
Cartridge / Privy).

## Why

io's fiat-price + auto-swap work landed well and the visual redesign
(dual-price, coin chips, decluttered cards) is already published in
`@medialane/ui@0.114.0` — a shared package both apps consume. The dapp's
`ListingCard`/`AssetCard`/`AssetMarketplacePanel` wrappers already exist at
structurally identical call sites to io's (same components, same shared
package), so most of this port is mechanical rather than novel design work.
Auto-swap is the one part that isn't a straight port — the dapp's wallets
pay their own gas (no AVNU paymaster sponsorship, unlike io), so the "one
tap, zero friction" framing doesn't fully carry over; what does carry over
is removing the separate manual-swap step by bundling swap + purchase into
one signed multicall.

## What's in scope

Two independent phases, same phasing as io:

1. **Fiat price display** — USD-equivalent shown alongside the on-chain
   currency everywhere io now shows it: listing cards (marketplace grid +
   collection page), the single asset page, the purchase dialog, offer/
   counter-offer dialogs, and the collection-page asset-card price pills.
2. **Auto-swap purchases** — a buyer whose balance in the order's own
   currency is insufficient can pay with any of `SUPPORTED_TOKENS` instead;
   the swap is bundled into the same signed multicall as the purchase.

**Explicitly out of scope:** any change to the dapp's wallet-connection
architecture, AVNU paymaster sponsorship for the dapp (a materially
different, separately-scoped feature if ever pursued), and Cartridge
session-policy changes (swap calls prompt a normal signature for Cartridge
users, same precedent already accepted for listing/offer — see "Why" and
Wallet-kind notes below).

## Phase 1: Fiat price display

Almost entirely a dependency bump + hook port — no new backend work, the
backend (`/v1/prices`, already serving USDT) is shared infrastructure both
apps already hit through their respective BFF proxies.

- **Bump `@medialane/ui` to `0.114.0`.** Carries every price-display change
  from io's session: `ListingCard`'s `usdValue` prop + dual-price full-card
  redesign (Price/Offer label and time-ago dropped), `AssetMarketplacePanel`'s
  `usdValue` prop + `PrimaryPrice` dual-price component (Floor dropped from
  the active-listing row, kept in the "not currently listed" fallback),
  `AssetCard`'s `usdValue` field + bigger, fiat-leading price pill.
- **Port `useUsdPrices()`** (`src/hooks/use-usd-prices.ts`) — identical to
  io's: polls `/api/proxy/v1/prices` every 60s, already-existing generic BFF
  proxy, zero new routes.
- **Port `usdValueFor()`** into the dapp's shared format util (wherever
  `formatDisplayPrice`/similar already lives) — pure function, no new
  dependencies.
- **Wire `usdValue` through** at the 8 call sites already consuming the
  shared price components: `asset-page-standard.tsx`, `asset-page-
  membership.tsx`, `asset-page-edition.tsx`, `asset-page-ticket.tsx`,
  `collection-page-client.tsx`, `components/marketplace/listing-card.tsx`
  (the dapp's own thin wrapper, mirroring io's), `components/home/new-on-
  marketplace.tsx`, `app/portfolio/page.tsx`. Same pattern at every site:
  `useUsdPrices()` once, `usdValueFor(price.formatted, price.currency,
  usdPrices)` per rendered price, pass as the `usdValue` prop.
- **Offer/counter-offer dialogs**: same inline `≈ $X` treatment under the
  price input as io's (`offer-dialog.tsx`/`counter-offer-dialog.tsx`
  equivalents, if the dapp has them under different names — confirm exact
  file names during implementation).

No changes to `asset-page-drop.tsx`'s pricing (drops/claims are a separate
pricing model, unaffected — confirm during implementation whether it
already reuses `AssetMarketplacePanel` or has bespoke pricing UI).

## Phase 2: Auto-swap purchases

### Backend — none needed

`/v1/swap/quote/meter` and `/v1/swap/build/meter` are already live on the
shared backend (medialane-backend, deployed from io's PR #105). Both apps
authenticate the same way (`MEDIALANE_API_KEY` + `x-api-key` header), so
the dapp's swap routes bill through the identical metered endpoints — no
new backend routes, no new `PricingRule` wiring.

### Dependency swap

Add `@avnu/avnu-sdk@4.2.0` (io's version). Remove or leave dormant
`@avnu/gasless-sdk` — currently unused in the dapp, and paymaster-only
(no `getQuotes`/`quoteToCalls`), so it can't serve this feature; whether to
remove it outright is an implementation-time call, not a design decision.

### App server routes — direct port

`src/lib/wallet/swap-billing.ts` and `src/app/api/wallet/swap/{quote,build}/
route.ts` port from io essentially verbatim — same request/response shape,
same "bill first, refuse to forward to AVNU on 402" logic, same env vars
(`MEDIALANE_BACKEND_URL`, `MEDIALANE_API_KEY` already exist in the dapp's
`src/lib/constants.ts` with the identical server-only pattern).

### Frontend — adapted to the dapp's fulfill path

The dapp has no `fulfillOrder` — buying goes through `useMarketplace()`'s
`checkoutCart`, a multi-item atomic sweep that already composes
`[...fulfillCalls, ...feeCalls]` and executes via `signer.execute(calls)`
(`src/lib/use-venue-signer.ts`, a thin wrapper unifying all five wallet
kinds behind one `execute(calls: Call[])` call). This is structurally the
same shape as io's `runIntent`, so the port is:

- `checkoutCart` gains an optional `swapCalls?: Call[]` parameter, prepended
  ahead of `fulfillCalls`: `[...swapCalls, ...fulfillCalls, ...feeCalls]`.
  Same atomicity guarantee as io — swap and purchase either both land or
  both fail.
- `use-swap-quote.ts` (browsing estimate), `swap-calls.ts` (buy-time fresh
  quote + build), `pay-with-picker.tsx` port with import-path adjustments
  only — same balance-check trigger (only show the picker when the order-
  currency balance is insufficient), same exact-output swap request, same
  fixed 1% slippage, same "price moved, try again" error on a stale quote.
- **Trigger point**: the dapp's purchase dialog (`src/components/
  marketplace/purchase-dialog.tsx`) currently calls `checkoutCart([item])`
  directly — same integration point as io's `executeAction`, just without
  io's separate `fulfillOrder` wrapper to modify.
- Balance-checking hook: the dapp's `use-token-balance.ts` is the
  `use-erc20-balance.ts` equivalent — confirm its exact return shape during
  implementation (io's `useErc20Balance`/`useTokenBalance`/
  `hasSufficientBalance` trio may need a small adapter, not a rewrite).

### Wallet-kind notes (the one real difference from io)

- **No gas sponsorship.** Every wallet kind pays its own gas via normal fee
  estimation, exactly as every other dapp write already does. The value
  delivered is "no separate manual swap step," not "zero gas, one tap" —
  the spec and any user-facing copy should say this accurately rather than
  echo io's framing.
- **Cartridge session policies** (`src/lib/wallet-connectors.ts`) only cover
  a fixed, pre-declared contract/entrypoint list for popup-free execution.
  AVNU's swap router isn't on it. Per the confirmed decision: this is
  acceptable — a Cartridge user attempting an auto-swap purchase gets a
  normal signature prompt instead of a silent session call, identical to
  today's listing/offer behavior for the same reason (unbounded/dynamic
  amounts can't be pre-policied). No picker gating needed by wallet kind.
- **Privy/injected/Ready/Braavos**: no known constraints: they already
  execute arbitrary multicalls today via `signer.execute(calls)`.

## Error handling

Same taxonomy as io's spec, adapted to the dapp's existing error surface
(`getFriendlyWalletError`, `withProcessing`'s toast/inline-error split):
insufficient balance everywhere (picker disables every option, no swap
attempted); backend meter 402 (swap routes refuse to forward, generic
retry message — never the raw 402); AVNU quote/build failure (retry
messaging, picker lets the user pick a different token); on-chain multicall
revert (atomic — swap and purchase both land or both fail, surfaced through
the same error path `checkoutCart` already uses today).

## Testing

- Backend: none needed (already covered by io's PR #105 test suite).
- Dapp: unit tests for `swap-billing.ts` (mirror io's `swap-billing.test.ts`
  exactly — same mocking pattern for `MEDIALANE_API_KEY`/`fetch`) and for
  the balance-check trigger logic. `checkoutCart`'s new `swapCalls`
  parameter gets a test asserting call order (`[...swap, ...fulfill,
  ...fee]`).
- Manual/prod verification: confirm the dapp's existing test/preview story
  (unlike io, the dapp is not stated to be prod-only for wallet flows —
  confirm during implementation whether Vercel previews can exercise real
  wallet connections here) before claiming either phase done; if not, the
  same "smoke on prod with small amounts" discipline from io's spec
  applies.

## Rollout

Two independent PRs, same as io:

1. Fiat price display (dependency bump + hook port + wiring).
2. Auto-swap (dependency add + route port + `checkoutCart`/picker
   integration), landed after (1) is live.
