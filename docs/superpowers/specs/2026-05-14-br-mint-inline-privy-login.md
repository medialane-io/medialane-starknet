# Inline Privy Login on `/br/mint` — Design

**Date:** 2026-05-14
**Status:** Approved (pending spec review)
**Motivation:** `/br/mint` is the landing page for the Brazil launch campaign — the page our ads will point at. ~100% of arriving users will be non-crypto. Today the page shows a single "Participar do airdrop" button that opens a wallet picker; even with Privy fixed, that's still a click before users see the email form. To maximize ad conversion we want the email/Google login form already visible in the hero, with a small secondary path for web3 users.

## Scope

- **In:** Inline Privy email + Google login in the `/br/mint` hero. Secondary "Conectar carteira" button that opens the existing `<ConnectWallet />` modal. Pre-mount of PrivyProvider for `/br/*` routes so the inline form works immediately.
- **Out:** Other locales (`/mint`, etc.), inline X/Twitter login, redesign of the rest of the page, changes to `<GenesisMint>` post-connect flow, changes to `<ConnectWallet />` modal contents.

## Current state

- `src/app/br/mint/page.tsx` is server-rendered, wraps `<BrMintContent />` in `<Suspense>`.
- `src/app/br/mint/br-mint-content.tsx` renders the hero: headline + `<GenesisMint contract={BR_MINT_CONTRACT} ... locale="br" />` as the CTA, plus a header with `<ConnectWallet />`.
- `<GenesisMint>` when no wallet is connected renders `<ConnectWallet label="Participar do airdrop" />` — a single button that opens the existing wallet picker modal (the one shown in the user's screenshot: Browser Wallets section + Cartridge + a "Sign in with Email or Social" button that routes through Privy).
- `<PrivyProvider>` is lazy-loaded globally — it only mounts after `onRequestPrivy()` is called. Privy hooks like `useLoginWithEmail` don't resolve until then.

## Design

### A. Pre-mount PrivyProvider on `/br/*` routes

`src/app/providers.tsx` already wires `handleRequestPrivy` which dynamically imports the Privy bundle. Trigger that automatically when the pathname starts with `/br/`, so by the time `<BrMintContent />` renders its inline form, `<PrivyProvider>` is already in the tree.

```ts
// In Providers, alongside the existing localStorage auto-reconnect effect:
useEffect(() => {
  if (pathname.startsWith("/br/")) {
    loadPrivyStack().then(activatePrivy).catch((err) => {
      console.error("[Privy] /br pre-mount failed:", err);
    });
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [pathname]);
```

No new env vars, no new lazy modules — reuses what we already built.

### B. New component: `<PrivyInlineLogin />`

Lives at `src/components/airdrop/privy-inline-login.tsx`. Stateful client component. Three internal stages:

1. **Idle** (default)
   - Email input + primary button **"Continuar com email"**
   - Divider: **"ou"**
   - Secondary button **"Continuar com Google"** (Privy logo + Google icon)
   - Footer link: **"Já tem uma carteira cripto? Conectar"** — opens the existing `<ConnectWallet />` modal

2. **OTP** (after `sendCode(email)` resolves)
   - Headline: **"Verifique seu email"** + subtitle showing the masked email
   - 6-digit OTP input
   - Primary button **"Verificar"** — calls `loginWithCode(code)`
   - Back link: **"Usar outro email"** — returns to Idle

3. **Connecting** (after `loginWithCode` resolves successfully — Privy `authenticated` flips true; PrivyConnector takes over)
   - Inline status: **"Criando sua conta…"** with a small spinner
   - The existing `PrivyConnectDialog` will *not* render here (it's gated on `walletType === "privy"` post-`authenticating`). We deliberately keep the inline status so the user stays oriented inside the page.
   - When `isConnected` becomes true via `useWallet()`, the parent (`BrMintContent`) re-renders and `<GenesisMint>` advances to its mint flow.

#### Hooks used

- `useLoginWithEmail()` → `{ sendCode, loginWithCode, state }`
- `useLoginWithOAuth()` → `{ initOAuth }` for Google
- `useWallet()` from `@/hooks/use-wallet` to detect successful connection
- `useStarkZapWallet()` from `@/contexts/starkzap-wallet-context` — only to set the same `walletAuthenticating("privy")` session so existing toasts/error surfacing keep working (otherwise PrivyConnector wouldn't know to run onboarding, because no `pendingConnect` flag was set)

#### Triggering the onboarding pipeline

PrivyConnector today runs onboarding when `authenticated && (needsOnboard || ml_privy_session)`. From the inline form we need PrivyConnector to fire after `loginWithCode` succeeds.

Two clean options. We'll use option 2:

1. ❌ Set `pendingConnect=true` via `connectPrivy()` *before* calling `loginWithCode`. Problem: `connectPrivy()` also calls `onRequestPrivy()` and `login()` (the Privy modal). We don't want the modal.
2. ✅ Persist `ml_privy_session` in localStorage *before* calling `loginWithCode`. PrivyConnector's auto-reconnect branch already keys off this, so when `authenticated` flips true it runs onboarding without needing a `pendingConnect` flag. Set the session error toast in motion using the same path as auto-reconnect.

This means the inline form does not need new wiring on the connector — it reuses the auto-reconnect branch. Single change: set `localStorage["ml_privy_session"] = "1"` before kicking off the login.

#### Errors

- Invalid email format → inline below the input (no toast).
- `sendCode` failure → inline error below the input + log.
- Wrong OTP → inline error above the OTP input + clear field.
- Google OAuth cancelled → silent reset to Idle.
- Onboarding failure (from PrivyConnector) → flows through the existing toast we set up earlier; the inline form returns to its Connecting → error state with a **"Tentar de novo"** button.

### C. Hook the component into `<BrMintContent />`

Add a connected-state branch around `<GenesisMint>`:

```tsx
{!isConnected ? (
  <PrivyInlineLogin />
) : (
  <GenesisMint contract={BR_MINT_CONTRACT} nftUri={BR_NFT_URI} storageKey="ml_br_mint" locale="br" />
)}
```

`<GenesisMint>` will then receive an already-connected wallet and render its post-connect mint UI without the fallback connect button.

### D. Visual

Hero layout untouched (two-column grid). The inline form replaces the CTA region in the left column at the same vertical slot as today's "Participar do airdrop" button. Form width matches the headline (`max-w-md`). Tailwind tokens consistent with the rest of `/br/mint`:

- Container: `rounded-2xl border border-border/40 bg-card/30 p-5 space-y-4`
- Primary button: solid `bg-primary text-primary-foreground` (matches today's CTA)
- Secondary Google button: `bg-muted/30 border border-border/50` with Google icon
- Footer link: `text-xs text-muted-foreground underline-offset-4 hover:underline`

The existing event image card on the right column is unchanged.

## Files touched

| File | Change |
|------|--------|
| `src/components/airdrop/privy-inline-login.tsx` | Create — inline 3-stage form |
| `src/app/br/mint/br-mint-content.tsx` | Modify — render `<PrivyInlineLogin />` when not connected |
| `src/app/providers.tsx` | Modify — pre-mount Privy when pathname starts with `/br/` |

Nothing in `src/contexts/` changes. `PrivyConnector` already handles the auto-reconnect branch that the inline form leverages.

## Cross-cutting (unchanged)

- `<UserRegistration />` continues to fire silently when the Privy wallet is ready (memory: `arch-user-registry`).
- `<PrivyConnectDialog />` stays mounted globally; it will not pop up during the inline flow because we use the auto-reconnect path that triggers `walletDeployingAccount` without first going through `walletAuthenticating`. Confirming this in verification.

## Success criteria

1. Landing on `/br/mint` with no wallet shows the inline email/Google form in the hero left column within ~1s.
2. Submitting a valid email + correct OTP triggers PrivyConnector onboarding (preparing wallet → deploying) and ends with `useWallet().isConnected === true`.
3. The new Privy address appears in the backend `users` table with `walletType=PRIVY`, `appSource=MEDIALANE_DAPP`.
4. Clicking **"Continuar com Google"** runs OAuth → returns to the page → same onboarding → connected state.
5. Clicking the footer **"Já tem uma carteira cripto? Conectar"** opens the existing `<ConnectWallet />` modal unchanged.
6. After connection, `<GenesisMint>` renders its mint flow (replaces the inline form).
7. No regressions in the global Privy connect path from the nav panel.
8. `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.

## Verification

- Manual: fresh browser, navigate to `/br/mint`, complete the email OTP flow end-to-end.
- Manual: repeat with Google OAuth.
- Manual: click the crypto-wallet link, confirm the existing modal opens.
- Manual: confirm `<GenesisMint>` advances after connect.
- Manual: from a different route (e.g. `/marketplace`), connect via the nav Privy button — must still work as before (the global flow uses `pendingConnect=true` from `connectPrivy()`, which is untouched).
- Manual: check the backend `users` row.
- Type-check + lint + build.
