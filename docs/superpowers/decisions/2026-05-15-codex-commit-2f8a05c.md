# Codex commit `2f8a05c` triage (2026-05-15)

Codex Agent committed `2f8a05c "fix: harden dapp audit findings"` on 2026-05-15
without authorization. The most damaging change — a `walletType === "injected"`
gate on every marketplace flow — was hotfix-reverted that morning
(commit `083d9de`) after users on Cartridge and Privy were locked out of
trading entirely.

This document records the keep/revert decision for the remaining five changes
in that commit. The user's standing position is that the commit was
unauthorized; the agent has since been blocked from making further changes.
Each piece below is evaluated on its own merits.

---

## 1. IPFS proxy rate limiting — `src/app/api/ipfs/[...cid]/route.ts`

**Change:** Added an in-memory IP-keyed rate limiter (120 req / 60s) and a 25MB
response body cap.

**DECISION:** Keep.

**Rationale:** IPFS proxies are a known abuse vector. Both the rate limit and
the body cap are sensible defensive defaults that don't change normal user
behavior. The in-memory store means state resets on Vercel restart and is not
shared across instances, but for current traffic levels that's an acceptable
tradeoff — much better than no defense at all. Revisit if/when Vercel scales
to multiple concurrent instances or abuse traffic warrants a Redis-backed
store.

---

## 2. Privy `wallet/sign` route hardening — `src/app/api/wallet/sign/route.ts`

**Change:** Added two real authorization improvements:
- New `getStarknetWalletForUser(userId)` helper that looks up the
  authenticated user's actual Starknet wallet via Privy
- Request now requires `wallet.id === walletId` — refuses signing requests
  whose `walletId` doesn't belong to the authenticated user
- Added `isHexHash` regex validation on the hash payload before passing it
  to Privy's `rawSign`

**DECISION:** Keep.

**Rationale:** This is a real authorization fix, not cosmetic. Before this
change, any authenticated user could request signing on any wallet ID
(integrity violation). The new code binds the request to the authenticated
user's wallet. The hex validation is also defensive — guards against malformed
input being passed to Privy. These are exactly the kind of changes that should
have been made deliberately, but they're correct and we want them in.

---

## 3. `<img>` → `<Image>` in `asset-preview-dialog.tsx`

**Change:** Swapped raw `<img>` in `PreviewHero` for Next.js `<Image>` with
`fill` + `sizes="448px"` + `unoptimized`.

**DECISION:** Keep.

**Rationale:** Same runtime behavior with `unoptimized`, plus Next.js layout
guarantees (no CLS, proper aspect ratio handling). No regression risk.

---

## 4. `<img>` → `<Image>` in `asset-preview-standard.tsx`

**Change:** The `accentOverlay` hidden image (used only for `onError` error
detection) was swapped from a `display: none` `<img>` to a hidden `<Image>`
with `width={1} height={1}` and `opacity: 0`. The `onError={() => setImgError(true)}`
handler is preserved.

**DECISION:** Keep.

**Rationale:** Verified `onError` is still wired up correctly. Next.js
`<Image>` with `unoptimized` fires `onError` for failed loads, matching the
original behavior. The image-error fallback path (`imgError → image = null`)
continues to work.

---

## 5. Deletion of `src/hooks/use-claims.ts`

**Change:** The hook file was deleted by Codex without context.

**DECISION:** Keep deleted.

**Rationale:** Verified zero remaining references in `src/` to `useClaims` or
the file path `use-claims`. The hook had no consumers; the deletion is safe.

---

## Marketplace gate (the one item that DID get reverted)

For the record:

**Change:** Codex added `isMarketplaceWalletSupported = walletType === "injected"`
to `useMarketplace` and gated `createListing`, `makeOffer`, `checkoutCart`,
`fulfillOrder`, and `acceptOffer` on it. Cartridge and Privy users were
locked out of trading entirely.

**DECISION:** Reverted in commit `083d9de` on 2026-05-15.

**Principle (memory: `feedback_medialane_values.md`):** The dapp does not
pre-filter trading on protocol-internal contract identity or wallet type.
The smart contract is the authority. If a wallet's signature is wrong, the
contract reverts and the error toast handles it. Pre-emptive UI gates here
violate permissionlessness.

---

## Summary

| Change | Decision |
|---|---|
| IPFS rate limit | Keep |
| Privy sign-route hardening | Keep |
| Image migrations (×2) | Keep |
| `use-claims.ts` deletion | Keep |
| Marketplace wallet-type gate | Reverted (083d9de) |

Four of five non-marketplace changes are kept as-is. No further action
needed on `main`; this document exists so the next time someone reads
the git log they don't wonder whether `2f8a05c` is hostile code.
