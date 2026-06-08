# Remix / Licensing Separation — Design

**Date:** 2026-06-08
**Branch:** `feat/remix-licensing-separation`
**Goal:** Bring medialane-dapp to parity with medialane-io's 2026-06-01 separation of the derivative-rights UX into two distinct flows: permissionless **Remix** and the **Licensing** deal. Mirror io faithfully (the explicit goal is feature/aesthetic parity).

## Background

io split the old combined "remix offer" flow into two app-layer flows (contracts stay permissionless; this is purely frontend gating). Reference: io `src/lib/remix-policy.ts`, `src/app/create/remix`, `src/app/create/licensing`, `src/app/portfolio/licensing`; medialane-core `docs/architecture/04-licensing-model.md` + `docs/specs/2026-06-01-remix-licensing-separation-design.md`.

The dapp still runs the **old combined model**: a single `/create/remix` page handles both the owner self-mint and the non-owner license-offer; `/portfolio/remix-offers` is the approval inbox; there is no policy resolver.

**Key discovery — backend is already shared & sufficient.** The dapp's `confirmSelfRemix` and io's `registerRemix` are the *same* function (identical body, same `POST /v1/remix-offers/self/confirm` endpoint; only the auth token differs — SIWS vs Clerk). The dapp's `submitRemixOffer`, `confirmRemixOffer`, `rejectRemixOffer`, `useRemixOffers`, `useTokenRemixes` already exist. So **no backend changes** and **no new SDK** are needed — this is a frontend restructure.

## The model (mirror io)

`resolveRemixPolicy(input)` (app-layer rule, ported verbatim from io):
- `canRemixDirect = viewerIsParentOwner || !parentNoDerivatives` — show the direct, permissionless self-mint **Remix** action.
- `showDealOption = dealAvailable && !viewerIsParentOwner` — show the **License this IP** deal action. `dealAvailable` ≈ parent lives in a Medialane service-backed collection (`!!getService(parentCollection?.service)`).
- `getDerivativesTerm(attributes)` reads the parent's self-declared `Derivatives` trait (`"Allowed" | "Not Allowed" | null`).

Both actions can appear on the same open asset (remix directly **or** propose a paid license). Owners only see Remix (you can't license your own work).

**Remix** (`/create/remix`) = direct, permissionless self-mint of a derivative → records provenance via `registerRemix` (the renamed `confirmSelfRemix`). No owner approval.

**Licensing** (`/create/licensing`) = "request a license" deal: a non-owner proposes license terms + a fee → `submitRemixOffer` → the creator approves via the **"Grant license & mint"** sheet → the licensed derivative is minted + listed for the requester.

## Decisions (confirmed)

- **Full mirror** — `/create/remix` becomes permissionless self-mint **only**; the non-owner license-offer path moves entirely to `/create/licensing`. No duplicate offer paths.
- **Portfolio: rename + redirect** — `/portfolio/remix-offers` → `/portfolio/licensing`; keep a redirect from the old path so links/bookmarks survive.

## Changes (file-by-file)

1. **New `src/lib/remix-policy.ts`** — port io's `getDerivativesTerm` + `resolveRemixPolicy` verbatim (pure logic, auth-agnostic).

2. **New `src/components/create/create-form-primitives.tsx`** — port io's `Section` + `ToggleGroup` (used by the licensing form; auth-agnostic). Reused by the refactored remix page where convenient.

3. **`src/hooks/use-remix-offers.ts`** — rename `confirmSelfRemix` → `registerRemix` (signature/endpoint unchanged; keeps the dapp's `siwsToken` + `authedFetch`). Update the one caller in `/create/remix`.

4. **New `src/app/create/licensing/[contract]/[tokenId]/page.tsx`** — port io's licensing page, adapting auth: replace `useAuth().getToken()` (Clerk) + `useSessionKey().walletAddress` (ChipiPay) with the dapp's `useWallet()` (address) + `useSiwsToken().getValidToken()` (SIWS token for `submitRemixOffer`). Same form (license type, commercial/derivatives toggles, royalty, fee + currency, message), same `resolveRemixPolicy` guard (`if (viewerIsOwner || !policy.dealAvailable) redirect to asset`), same success panel linking to `/portfolio/licensing`.

5. **`src/app/create/remix/[contract]/[tokenId]/page.tsx`** — remove the non-owner `submitRemixOffer` path. The page becomes self-mint only: owner mints into a chosen collection; an eligible non-owner (`canRemixDirect`) self-mints permissionlessly. Wire `registerRemix` for provenance. Button copy → "Create Remix" (drop "Propose Remix"). Non-eligible viewers (parent `Derivatives: Not Allowed`, non-owner) are redirected to the asset (the licensing deal is their path).

6. **Asset page CTAs** — in `asset-marketplace-panel.tsx` / `asset-page-standard.tsx`: compute `resolveRemixPolicy` from the token attributes + ownership + collection service, and render two policy-gated CTAs: **Remix** (`canRemixDirect` → `/create/remix/…`) and **License this IP** (`showDealOption` → `/create/licensing/…`). Mirror io's placement/labels.

7. **`src/app/portfolio/remix-offers/` → `src/app/portfolio/licensing/`** — move the page; relabel "Remix Requests" → "License Requests", "My Remix Requests" → "My License Requests". Add `src/app/portfolio/remix-offers/page.tsx` as a thin redirect to `/portfolio/licensing`. Update the portfolio subnav + any nav-commands entry.

8. **`src/components/portfolio/approve-mint-sheet.tsx`** — reframe copy to "Grant license & mint" (and related labels) to match io's licensing framing. (Logic unchanged — it already mints + lists + `confirmRemixOffer`.)

9. **Nav** — update `src/lib/nav-commands.ts` and the portfolio layout subnav: `Remix Offers` → `Licensing`; ensure the asset-page "License this IP" entry exists.

## Auth adaptation (the only io→dapp translation)

| io (Clerk + ChipiPay) | dapp (StarkZap + Privy + SIWS) |
|---|---|
| `useAuth().getToken()` | `useSiwsToken().getValidToken()` |
| `useSessionKey().walletAddress` | `useWallet().address` |
| `apiFetch(url, clerkToken, …)` | `authedFetch(url, siwsToken, …)` (already in use-remix-offers) |

Everything else (backend endpoints, SDK helpers `getService`/`getListableTokens`/`getTokenBySymbol`/`LICENSE_TYPES`, the `RemixOffer` type, `submitRemixOffer`) is identical.

## Out of scope

- No contract/backend changes (shared backend already supports every endpoint).
- No change to the swap/Creator-Coin (dapp-only) features.
- `/portfolio/remix-offers` content is moved, not redesigned.
- `extendRemixOffer` (io has it; dapp lacks it) — **not** part of this separation; tracked separately if wanted.

## Verification

- `npx tsc --noEmit` clean (only the 2 pre-existing `use-register-user` baseline errors).
- Full `npm run build` clean.
- No test runner — browser checks: non-owner on an open asset sees both **Remix** + **License this IP**; owner sees only **Remix**; non-owner on a `Derivatives: Not Allowed` asset sees only **License this IP**; license request lands in `/portfolio/licensing`; old `/portfolio/remix-offers` redirects; creator "Grant license & mint" approval still mints+lists.
