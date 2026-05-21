# Medialane Dapp Audit Remediation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the security, reliability, and wallet-UX findings from the May 14, 2026 audit of `medialane-dapp`, with the highest-risk issues handled first.

**Architecture:** Remove admin-only surfaces from the public dapp, enforce wallet ownership before server-side signing, align marketplace transaction support with the unified wallet model, close open quota-proxy surfaces, and update vulnerable dependencies. Keep user-facing behavior unchanged except where the current UI over-promises unsupported wallet flows.

**Audit scope covered:** Server API routes, Privy/StarkZap wallet flow, marketplace order execution, public/admin API keys, IPFS/Pinata proxying, dependency audit, TypeScript/lint/build checks.

---

## Priority Findings

| Priority | Finding | Primary Files |
|----------|---------|---------------|
| P0 | Privy signing endpoint verifies only access token, not ownership of caller-supplied `walletId` | `src/app/api/wallet/sign/route.ts`, `src/app/api/wallet/starknet/route.ts`, `src/contexts/privy-connector.tsx` |
| P0 | Admin backend key was exposed through `NEXT_PUBLIC_ADMIN_API_KEY` and browser admin hooks | remove `src/hooks/use-claims.ts`; do not add dapp admin proxy routes |
| P1 | Production dependency audit reports high-severity advisories for Next.js and transitive Axios/PostCSS | `package.json`, `package-lock.json` |
| P1 | Marketplace UI accepts Privy/Cartridge connections but marketplace implementation only supports injected `useAccount()` signing/execution | `src/hooks/use-marketplace.ts`, marketplace dialogs, portfolio tables |
| P2 | Public IPFS proxy can consume private Pinata gateway/JWT quota for arbitrary valid CIDs | `src/app/api/ipfs/[...cid]/route.ts` |
| P2 | Build/lint are mostly clean but still report `<img>` optimization warnings | `src/components/shared/asset-preview-dialog.tsx`, `src/components/shared/asset-preview-standard.tsx` |

---

## Phase 1 — Privy Signing Authorization

**Goal:** Ensure a valid Privy user can only sign with their own server-created Starknet wallet.

### Task 1: Bind wallet signing to authenticated Privy user

**Files:**
- Modify: `src/app/api/wallet/sign/route.ts`
- Modify if helpful: `src/app/api/wallet/starknet/route.ts`
- Modify if helpful: `src/contexts/privy-connector.tsx`

- [x] **Step 1: Verify Privy claims before reading signing inputs**

In `src/app/api/wallet/sign/route.ts`, keep extracting `Authorization: Bearer ...`, but store the verified claims:

```ts
const claims = await privyServer.utils().auth().verifyAccessToken(token);
```

- [x] **Step 2: Derive the expected wallet identity server-side**

Reuse the same user-id normalization as `src/app/api/wallet/starknet/route.ts`:

```ts
function toExternalId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}
```

Use `claims.user_id` to compute the expected external id. Retrieve/list the Privy wallet by that external id and compare it to the requested `walletId`.

- [x] **Step 3: Reject mismatched wallet ids**

Before `rawSign`, require:

```ts
wallet.id === walletId
```

Return `403` for a wallet mismatch and `401` for invalid auth. Do not reveal whether another wallet id exists.

- [x] **Step 4: Validate the hash shape**

Require `hash` to match a Starknet felt-style hex string before passing it to Privy:

```ts
if (!/^0x[0-9a-fA-F]+$/.test(hash)) ...
```

Optionally enforce felt width if Privy's raw signing API expects a field element.

- [ ] **Step 5: Reduce client trust**

If the SDK allows it, stop sending `walletId` from the browser and have `/api/wallet/sign` derive the wallet id from the authenticated user. If StarkZap requires `walletId` in its resolver response, keep sending it, but treat it only as a hint on the server.

- [ ] **Step 6: Verification**

Run:

```bash
npx tsc --noEmit
npm run build
```

Manual checks:
- Connect with Privy and complete account deployment.
- Execute one low-risk sponsored action.
- Call `/api/wallet/sign` with a fake/mismatched `walletId`; expect `403`.

---

## Phase 2 — Remove Admin Surface From Dapp

**Goal:** Keep admin functionality out of the public dapp. The dapp must not expose browser admin hooks, must not contain `/api/admin/*` proxy routes, and must not require admin allowlist env vars.

### Task 2: Remove dapp admin env vars

**Files/Systems:**
- Vercel project env vars
- Local `.env.local` if present
- Backend/admin key management

- [ ] **Step 1: Remove dapp admin env vars**

In the Vercel dapp project, remove:

```bash
NEXT_PUBLIC_ADMIN_API_KEY
ADMIN_API_KEY
ADMIN_WALLET_ADDRESSES
```

The public dapp should not need any of them. Keep admin secrets only in the backend or a separate admin app.

- [ ] **Step 2: Rotate the underlying admin secret**

Because `NEXT_PUBLIC_ADMIN_API_KEY` may already have been bundled or exposed, rotate the backend admin key rather than only renaming the current value.

### Task 3: Delete dapp admin code

**Files:**
- Delete: `src/hooks/use-claims.ts`
- Ensure absent: `src/app/api/admin/*`
- Ensure absent: `src/lib/admin-api-server.ts`

- [x] **Step 1: Delete unused browser admin hooks**

`src/hooks/use-claims.ts` was unused and has been removed.

- [x] **Step 2: Do not add dapp admin proxy routes**

No `/api/admin/*` routes should exist in this dapp. Admin access belongs in the backend or a separate admin surface.

- [ ] **Step 3: Verification**

Run:

```bash
rg -n "NEXT_PUBLIC_ADMIN_API_KEY|ADMIN_API_KEY|ADMIN_WALLET_ADDRESSES|/api/admin|useAdminClaims|useAdminCollections" src
npx tsc --noEmit
npm run build
```

Expected:
- No admin env references remain in `src`.
- No dapp admin proxy routes exist.
- No browser admin hooks remain.

---

## Phase 3 — Dependency Remediation

**Goal:** Clear production `npm audit` findings without destabilizing wallet dependencies.

### Task 4: Update vulnerable packages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Run audit fix on a branch**

Run:

```bash
npm audit fix
```

Review changes before committing. Pay special attention to:
- `next`
- nested `next/node_modules/postcss`
- `@coinbase/cdp-sdk` / `axios` through wallet connector dependencies

- [x] **Step 2: If audit fix cannot clear transitive Axios**

Inspect which dependency pulls `@wagmi/connectors` / `@coinbase/cdp-sdk`. If unused by Starknet flows, consider whether the parent package can be upgraded, deduped, or removed. Do not force overrides until wallet connection smoke tests pass.

- [ ] **Step 3: Verification**

Run:

```bash
npm audit --omit=dev --audit-level=moderate
npx tsc --noEmit
npm run build
```

Manual smoke tests:
- Homepage loads.
- Marketplace loads.
- Injected wallet connect still works.
- Privy lazy-load still works.
- Cartridge connect still works.

---

## Phase 4 — Marketplace Wallet Compatibility

**Goal:** Make marketplace actions behave correctly for all wallet types exposed by `useUnifiedWallet`.

### Task 5: Choose product behavior per wallet type

**Files:**
- Modify: `src/hooks/use-marketplace.ts`
- Modify: `src/components/marketplace/*-dialog.tsx`
- Modify: portfolio marketplace tables as needed

- [x] **Step 1: Decide support level**

Choose one path:

| Option | Behavior |
|--------|----------|
| Full support | Refactor `useMarketplace` to sign/execute with injected, Cartridge, and Privy wallets |
| Conservative support | Keep marketplace limited to injected wallets and disable/hide actions for Privy/Cartridge with clear copy |

Preferred long-term path: full support, because the app presents Privy and Cartridge as first-class wallets.

- [ ] **Step 2A: Full support implementation**

If choosing full support:
- Extend `useUnifiedWallet` or add a marketplace-specific signer abstraction that exposes `signMessage`, `hashMessage` if available, and `execute`.
- Replace direct `useAccount()` dependencies in `useMarketplace` with the unified signer/executor.
- Confirm StarkZap wallet supports SNIP-12 typed-data signing for order registration, fulfillment, and cancellation.
- Confirm the returned transaction hash shape is normalized.

- [x] **Step 2B: Conservative implementation**

If choosing conservative support:
- Add `walletType` checks in marketplace dialogs.
- Disable `List`, `Offer`, `Buy`, `Cancel`, and `Accept offer` actions for `walletType === "privy"` or `"cartridge"`.
- Show concise copy: `Marketplace orders currently require Ready or Braavos.`
- Keep read-only marketplace browsing available.

- [x] **Step 3: Verification**

Run:

```bash
npx tsc --noEmit
npm run build
```

Manual checks:
- Ready/Braavos listing, offer, buy, cancel, accept-offer flows.
- Privy/Cartridge users either complete the same flows or see an early, clear unsupported-wallet state.

---

## Phase 5 — IPFS Proxy Hardening

**Goal:** Prevent `/api/ipfs/[...cid]` from becoming an unlimited public drain on Pinata quota.

### Task 6: Add limits and policy to the proxy

**Files:**
- Modify: `src/app/api/ipfs/[...cid]/route.ts`
- Optional create: `src/lib/rate-limit.ts`

- [x] **Step 1: Add per-IP rate limiting**

Use a Vercel-compatible limiter if available, or a lightweight in-memory limiter as a first pass. Enforce a conservative anonymous limit.

- [ ] **Step 2: Restrict proxied content where possible**

Preferred:
- Allow CIDs known by the Medialane backend/indexer.

Fallback:
- Keep syntax validation.
- Add rate limiting.
- Add response size guard.
- Keep safe MIME allowlist and `nosniff`.

- [x] **Step 3: Avoid leaking upstream detail**

Keep error responses generic enough to avoid exposing Pinata plan/gateway behavior.

- [ ] **Step 4: Verification**

Manual checks:
- Known token images still render.
- Invalid CIDs return `400`.
- Repeated requests above threshold return `429`.
- SVG/HTML/scriptable responses are not served as executable content.

---

## Phase 6 — Smaller Reliability And Performance Cleanups

### Task 7: Replace remaining raw `<img>` warnings

**Files:**
- Modify: `src/components/shared/asset-preview-dialog.tsx`
- Modify: `src/components/shared/asset-preview-standard.tsx`

- [x] **Step 1: Replace `<img>` with `next/image` or a local image component**

Preserve existing layout and `unoptimized` behavior for IPFS/external media if required.

- [x] **Step 2: Verification**

Run:

```bash
npm run lint
npm run build
```

Expected: no `<img>` warnings.

### Task 8: Clean stale/dead IPFS hook code if confirmed unused

**Files:**
- Review: `src/hooks/use-ipfs.ts`
- Review: `src/services/config/server.config.ts`

- [ ] **Step 1: Confirm usage**

Run:

```bash
rg -n "useIpfsUpload|uploadImageFromUrl|services/config/server.config" src
```

- [ ] **Step 2: Remove or repair dead code**

If `useIpfsUpload` is unused, delete it and the client import of `server.config.ts`. If it is needed, remove the `"server only"` import from client code and route all Pinata signing through server API endpoints.

- [ ] **Step 3: Verification**

Run:

```bash
npx tsc --noEmit
npm run build
```

---

## Final Verification Checklist

- [x] `rg -n "NEXT_PUBLIC_ADMIN_API_KEY|ADMIN_API_KEY|ADMIN_WALLET_ADDRESSES|/api/admin|useAdminClaims|useAdminCollections" src` shows no dapp admin surface.
- [x] `npm audit --omit=dev --audit-level=moderate` passes or has documented accepted residual risk.
- [x] `npx tsc --noEmit` passes.
- [x] `npm run lint` passes with no warnings, or warnings are documented.
- [x] `npm run build` passes.
- [ ] Privy connect and account deployment work.
- [ ] Mismatched Privy wallet signing request is rejected.
- [x] Admin pages/routes are absent from the public dapp.
- [ ] Marketplace behavior is correct for injected, Privy, and Cartridge wallets according to the chosen support level.
- [ ] IPFS proxy is rate-limited and still serves known app media.

---

## Deployment Notes

- Remove `NEXT_PUBLIC_ADMIN_API_KEY`, `ADMIN_API_KEY`, and `ADMIN_WALLET_ADDRESSES` from the Vercel dapp project.
- Rotate the backend admin key because the old public value may have been bundled.
- Watch Vercel logs for `/api/wallet/sign` and `/api/ipfs/*` after deploy.
- Re-run `npm audit` after dependency updates and again after deployment lockfile install.
