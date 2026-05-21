# Privy Onboarding with Automatic Account Deploy — Design

**Date:** 2026-05-14
**Status:** Approved (pending spec review)
**Motivation:** Unblock the Starknet Foundation seed-grant marketing push (5k wallets by July 2026). Today the Privy login button is visibly dead and accounts never get deployed, so we cannot onboard a single user end-to-end.

## Diagnosis

Three concrete defects in the current implementation:

1. **Deploy never runs.** `src/contexts/privy-bridge.tsx` calls `sdk.onboard({ deploy: "never" })` then a separate `result.wallet.ensureReady({ deploy: "if_needed", feeMode: "sponsored" })`. StarkZap docs ([source](https://docs.starknet.io/build/starkzap/integrations/privy)) document the canonical pattern as a single `sdk.onboard({ ..., deploy: "if_needed", feeMode: "sponsored" })` — the SDK handles the deployed/undeployed distinction internally. The split flow regressed.

2. **Privy `login()` is called before the SDK is `ready`.** PrivyBridge is lazy-loaded; the moment it mounts, the pending-connect effect fires and invokes `login()` synchronously. Privy requires `ready === true` from `usePrivy()` before invoking SDK methods. Result: `login()` no-ops/throws, the Privy modal never opens. This matches the observed symptom (button briefly disables, no modal, no console error).

3. **Errors are invisible.** `onPrivyError` writes to `session.error` but nothing renders it. The user sees a dead button with no explanation.

A fourth UX defect: even when the flow eventually works, deploy takes 5–15 s with no feedback, so users assume it's broken.

## Design

### A. Single-step deploy

In `src/contexts/privy-bridge.tsx`, replace the two-step flow with a single call:

```ts
const result = await sdk.onboard({
  strategy: OnboardStrategy.Privy,
  accountPreset: "argentXV050",
  feeMode: "sponsored",
  privy: { resolve: privyResolve },
  deploy: "if_needed",
});
```

Delete the subsequent `result.wallet.ensureReady(...)` block. The earlier `getClassHashAt(addr, "pending")` workaround documented in memory was a defense against an "already deployed" AVNU error in a separate deploy step — it is no longer needed once the SDK's built-in detection drives deployment.

### B. Gate connect flow on Privy `ready`

In `PrivyBridge`:

- Destructure `ready` from `usePrivy()`.
- Add `ready` to the dep array of the pending-connect effect, and short-circuit if `!ready`. The effect re-fires automatically once `ready` flips true.
- Same gate on the auto-reconnect effect.

### C. Surface errors as toasts

Add a small effect (in `starkzap-wallet-context.tsx` or a new mounted watcher) that fires `toast.error(session.error)` whenever `session.error` transitions to a non-null value with `walletType === "privy"`. This guarantees the user sees real failure messages from Privy login, server signing, or AVNU.

### D. Connect progress dialog

New component `src/components/wallet/privy-connect-dialog.tsx`, mounted globally next to `NotificationSpotlight` in `src/app/providers.tsx`.

Steps shown:
1. **Authenticating** — Privy login modal in flight
2. **Preparing wallet** — `POST /api/wallet/starknet` server call
3. **Deploying account** — `sdk.onboard(... deploy: "if_needed")` in flight
4. **Ready** — closes shortly after success

Driven by extended session states added to `src/lib/wallet-session.ts`:
- `walletPreparingWallet(type)` (between Privy login and onboard)
- `walletDeployingAccount(type)` (during onboard)

Bridge updates these between steps. Dialog closes on `walletReady` or surfaces the error inline with a **Try again** button that re-invokes `connectPrivy()`.

### E. Lazy-load race

No structural change needed. The bridge only mounts after `loadPrivyStack()` resolves, and the `ready` gate from (B) ensures the connect effect waits until Privy itself is initialized.

## Files touched

| File | Change |
|------|--------|
| `src/contexts/privy-bridge.tsx` | Collapse deploy to single call; add `ready` gate; emit new in-flight session states |
| `src/contexts/starkzap-wallet-context.tsx` | Wire new session states; add error toast effect |
| `src/lib/wallet-session.ts` | Add `walletPreparingWallet`, `walletDeployingAccount` helpers + types |
| `src/components/wallet/privy-connect-dialog.tsx` | NEW — progress dialog with stepper + retry |
| `src/app/providers.tsx` | Mount the dialog globally |

## Out of scope

- Cartridge / injected wallet flows (unchanged).
- Post-connect onboarding (username claim, welcome state).
- Confetti / celebratory animation.
- Nav account panel redesign.
- Backend `POST /api/wallet/starknet` and `/api/wallet/sign` endpoints (already shipped, unchanged).

## Success criteria

1. Clicking **Privy** on a fresh browser opens the Privy login modal within ~1s.
2. After Privy login completes, the progress dialog visibly steps through Authenticating → Preparing wallet → Deploying → Ready.
3. On success, `useWallet()` returns a connected Privy address and `getClassHashAt(addr, "latest")` resolves (account is deployed on-chain).
4. Any failure shows a toast with the actual error message and a retry path that does not require a page reload.
5. Auto-reconnect on page reload still works for users who previously chose Privy.

## Verification

- Manual: end-to-end onboarding on mainnet (or sepolia) with a new email — confirm a deployed account address that shows up on Voyager.
- `npx tsc --noEmit` clean.
- `npm run lint` clean.
