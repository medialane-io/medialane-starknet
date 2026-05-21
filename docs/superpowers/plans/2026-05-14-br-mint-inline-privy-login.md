# Inline Privy Login on `/br/mint` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single CTA on `/br/mint` with an inline email + Google Privy login form, plus a secondary link to the existing wallet picker, so ad traffic can sign up without an intermediate modal.

**Architecture:** Pre-mount `<PrivyProvider>` on any `/br/*` route so headless Privy hooks resolve immediately. New `<PrivyInlineLogin />` component uses `useLoginWithEmail` (sendCode → loginWithCode) and `useLoginWithOAuth` (initOAuth with provider: "google"). Setting `localStorage["ml_privy_session"] = "1"` before initiating login lets the existing `PrivyConnector` auto-reconnect branch run the onboarding pipeline once `authenticated` flips true — no new wiring in the connector.

**Tech Stack:** Next.js App Router, React 19, TypeScript, `@privy-io/react-auth` (`useLoginWithEmail`, `useLoginWithOAuth`), Tailwind, lucide-react.

**Reference spec:** `docs/superpowers/specs/2026-05-14-br-mint-inline-privy-login.md`

---

## File Structure

| File | Change |
|------|--------|
| `src/app/providers.tsx` | Modify — pre-mount Privy when pathname starts with `/br/` |
| `src/components/airdrop/privy-inline-login.tsx` | Create — 3-stage inline form (Idle → OTP → Connecting) |
| `src/app/br/mint/br-mint-content.tsx` | Modify — render `<PrivyInlineLogin />` when not connected |

No tests are added (repo has no test suite per `CLAUDE.md`). Verification is manual + `npx tsc --noEmit` + `npm run lint` + `npm run build`.

---

## Task 1: Pre-mount Privy on `/br/*` routes

**Files:**
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Add the `/br/*` pre-mount effect**

In `src/app/providers.tsx`, find the existing auto-reconnect effect (around lines 133-140):

```ts
  useEffect(() => {
    if (localStorage.getItem("ml_privy_session")) {
      loadPrivyStack().then(activatePrivy).catch((err) => {
        console.error("[Privy] auto-reconnect load failed:", err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Immediately below it, add a new effect that pre-mounts Privy on any `/br/*` route:

```ts
  useEffect(() => {
    if (!pathname.startsWith("/br/")) return;
    loadPrivyStack().then(activatePrivy).catch((err) => {
      console.error("[Privy] /br pre-mount failed:", err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
```

`pathname` is already destructured at the top of `Providers` (line 119). `loadPrivyStack` and `activatePrivy` are already in scope.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Smoke-test the pre-mount**

Run: `npm run dev`. Open `http://localhost:3000/br/mint`. Open DevTools → Network. Reload. Within ~1s you should see a request for the Privy bundle. In the console: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/providers.tsx
git commit -m "feat(providers): pre-mount Privy on /br/* routes"
```

---

## Task 2: Build `<PrivyInlineLogin />`

**Files:**
- Create: `src/components/airdrop/privy-inline-login.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/airdrop/privy-inline-login.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { useLoginWithEmail, useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useWallet } from "@/hooks/use-wallet";

type Stage = "idle" | "otp" | "connecting";

const COPY = {
  title: "Crie sua conta gratuita",
  subtitle: "Entre com email ou Google. Sem carteira, sem cartão, sem gas.",
  emailPlaceholder: "seu@email.com",
  emailSubmit: "Continuar com email",
  emailSending: "Enviando código…",
  or: "ou",
  googleButton: "Continuar com Google",
  googleLoading: "Abrindo Google…",
  otpTitle: "Verifique seu email",
  otpSubtitleA: "Enviamos um código para",
  otpPlaceholder: "Código de 6 dígitos",
  otpSubmit: "Verificar",
  otpVerifying: "Verificando…",
  otpBack: "Usar outro email",
  connecting: "Criando sua conta…",
  connectingSub: "Estamos preparando e implantando sua conta Starknet. Isso leva alguns segundos.",
  retry: "Tentar de novo",
  walletLink: "Já tem uma carteira cripto? Conectar",
  invalidEmail: "Digite um email válido.",
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function maskEmail(value: string): string {
  const [user, domain] = value.split("@");
  if (!user || !domain) return value;
  const visible = user.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

interface Props {
  /** Called when the user clicks the secondary "connect crypto wallet" link. */
  onOpenWalletPicker: () => void;
}

export function PrivyInlineLogin({ onOpenWalletPicker }: Props) {
  const { ready, authenticated } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();
  const { session } = useStarkZapWallet();
  const { isConnected } = useWallet();

  const [stage, setStage] = useState<Stage>("idle");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Once the wallet is connected the parent unmounts us, but during the
  // post-login window we show a connecting status driven by the wallet session.
  const isOnboarding =
    authenticated &&
    !isConnected &&
    (session.status === "preparing-wallet" || session.status === "deploying-account");

  const armAutoReconnect = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ml_privy_session", "1");
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!isValidEmail(email)) {
      setEmailError(COPY.invalidEmail);
      return;
    }
    setBusy(true);
    try {
      armAutoReconnect();
      await sendCode({ email: email.trim() });
      setStage("otp");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    if (code.trim().length < 4) {
      setOtpError("Digite o código completo.");
      return;
    }
    setBusy(true);
    try {
      await loginWithCode({ code: code.trim() });
      setStage("connecting");
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Código inválido. Tente novamente.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setEmailError(null);
    setBusy(true);
    try {
      armAutoReconnect();
      await initOAuth({ provider: "google" });
      // initOAuth redirects via window.assign — execution typically does not
      // continue past this point. When the user returns, PrivyConnector's
      // auto-reconnect branch handles the onboarding.
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Não foi possível abrir o Google.");
      setBusy(false);
    }
  };

  const showConnecting = stage === "connecting" || isOnboarding;

  if (!ready) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/30 p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      </div>
    );
  }

  if (showConnecting) {
    return (
      <div className="max-w-md rounded-2xl border border-border/40 bg-card/30 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">{COPY.connecting}</p>
            <p className="text-xs text-muted-foreground">{COPY.connectingSub}</p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "otp") {
    return (
      <form onSubmit={handleVerify} className="max-w-md space-y-3 rounded-2xl border border-border/40 bg-card/30 p-5">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{COPY.otpTitle}</p>
          <p className="text-xs text-muted-foreground">
            {COPY.otpSubtitleA} <span className="text-foreground">{maskEmail(email)}</span>
          </p>
        </div>
        {otpError && <p className="text-xs text-destructive">{otpError}</p>}
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder={COPY.otpPlaceholder}
          className="w-full rounded-lg border border-border/50 bg-background/60 px-3 py-2.5 text-sm tracking-widest text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? COPY.otpVerifying : COPY.otpSubmit}
        </button>
        <button
          type="button"
          onClick={() => { setStage("idle"); setCode(""); setOtpError(null); }}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {COPY.otpBack}
        </button>
      </form>
    );
  }

  return (
    <div className="max-w-md space-y-4 rounded-2xl border border-border/40 bg-card/30 p-5">
      <div className="space-y-1">
        <p className="text-base font-semibold text-foreground">{COPY.title}</p>
        <p className="text-xs text-muted-foreground">{COPY.subtitle}</p>
      </div>

      <form onSubmit={handleSendCode} className="space-y-2">
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={COPY.emailPlaceholder}
            className="h-10 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? COPY.emailSending : COPY.emailSubmit}
        </button>
      </form>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border/50" />
        {COPY.or}
        <div className="h-px flex-1 bg-border/50" />
      </div>

      <button
        type="button"
        onClick={() => void handleGoogle()}
        disabled={busy || oauthLoading}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/50 bg-background/60 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.2-5.5 4.2-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.7 2.5 2.4 6.8 2.4 12s4.3 9.5 9.6 9.5c5.5 0 9.2-3.9 9.2-9.3 0-.6-.1-1-.2-1.5H12z"/>
        </svg>
        {oauthLoading || busy ? COPY.googleLoading : COPY.googleButton}
      </button>

      <button
        type="button"
        onClick={onOpenWalletPicker}
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
      >
        {COPY.walletLink}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/airdrop/privy-inline-login.tsx
git commit -m "feat(airdrop): add PrivyInlineLogin component"
```

---

## Task 3: Wire `<PrivyInlineLogin />` into `<BrMintContent />`

**Files:**
- Modify: `src/app/br/mint/br-mint-content.tsx`

- [ ] **Step 1: Inspect the ConnectWallet API**

Run: `grep -n "useConnectWallet\|openConnect\|isOpen" /Users/kalamaha/dev/medialane-dapp/src/components/ConnectWallet.tsx | head -10`

The existing `<ConnectWallet />` component manages its own modal state. To open it programmatically we wrap its trigger. Check the component briefly:

Run: `head -80 /Users/kalamaha/dev/medialane-dapp/src/components/ConnectWallet.tsx`

If `ConnectWallet` exposes a programmatic `open()`, use it directly. Otherwise, render the `<ConnectWallet />` with a hidden trigger and use a ref + `.click()`. The simplest fallback that does not depend on internals is to render an invisible `<ConnectWallet />` next to our inline form and use a CSS-hidden button that we trigger via ref.

If unsure, default to the simpler path: render `<ConnectWallet label="" />` already in the header (it's already there at line 61 of `br-mint-content.tsx`), and the secondary "Conectar carteira" link just scrolls to / focuses the header connect button. **Decision for this plan:** use the simpler path — the secondary link calls a function passed via props that focuses or clicks the header's `<ConnectWallet />` button.

Implementation: lift the ConnectWallet trigger via a ref.

- [ ] **Step 2: Update `br-mint-content.tsx`**

Replace the import block and the `BrMintContent` function in `src/app/br/mint/br-mint-content.tsx` so the file's top section reads:

```tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  CheckCircle2,
  FileCheck,
  Coins,
  Users,
  ImageIcon,
  Shield,
  Info,
  PenLine,
  ShoppingCart,
  UserCheck,
  XCircle,
} from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { GenesisMint } from "@/components/airdrop/genesis-mint";
import { PrivyInlineLogin } from "@/components/airdrop/privy-inline-login";
import { MedialaneLogo } from "@/components/brand/medialane-logo";
import { useWallet } from "@/hooks/use-wallet";
import { BR_MINT_CONTRACT, BR_NFT_URI, BR_NFT_IMAGE_URL } from "@/lib/constants";
```

Then locate `export function BrMintContent()` (currently line 53) and replace the function body up to the `</header>` closing tag through the end of the hero section (currently lines 53-105) with:

```tsx
export function BrMintContent() {
  const { isConnected } = useWallet();
  const headerConnectRef = useRef<HTMLDivElement | null>(null);

  const openWalletPicker = () => {
    // Click the first interactive child of the header's ConnectWallet
    // component (its trigger button). Avoids depending on ConnectWallet
    // internals.
    const btn = headerConnectRef.current?.querySelector("button");
    btn?.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/30 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <Link href="/"><MedialaneLogo /></Link>
        <div ref={headerConnectRef}>
          <ConnectWallet />
        </div>
      </header>

      <div className="flex-1 w-full">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">

          {/* Hero */}
          <section className="py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/5 px-3 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                  <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                    Airdrop de Prêmios — Lançamento no Brasil
                  </span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
                  Participe do{" "}
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    Airdrop de Prêmios
                  </span>
                </h1>

                {isConnected ? (
                  <GenesisMint
                    contract={BR_MINT_CONTRACT}
                    nftUri={BR_NFT_URI}
                    storageKey="ml_br_mint"
                    locale="br"
                  />
                ) : (
                  <PrivyInlineLogin onOpenWalletPicker={openWalletPicker} />
                )}

                <p className="text-sm text-muted-foreground leading-relaxed">
                  Medialane é uma plataforma para criadores publicarem, compartilharem e monetizarem conteúdo. Gratuito para participar.
                </p>
                <div className="flex items-center gap-4">
                  {["Gratuito", "Sem cartão", "Instantâneo"].map((t) => (
                    <div key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500/60" />
                      {t}
                    </div>
                  ))}
                </div>
              </div>
              <div className="lg:sticky lg:top-24">
                <EventCard />
              </div>
            </div>
          </section>
```

Leave the rest of the file (sections after the hero) unchanged.

Notes:
- `useState` is no longer needed in this top-level component (it was only used by `EventCard`, which already imports its own `useState`). The top-level import was `import { useState } from "react";` — the new code uses `useRef` instead. `useState` remains used inside `EventCard` so it must stay imported. The import block above keeps both via the merged statement `import { useRef, useState } from "react";`.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint 2>&1 | grep -E "(br-mint|privy-inline)" | head -10`
Expected: TypeScript clean. Lint may surface no new warnings.

- [ ] **Step 4: Build sanity**

Run: `npm run build`
Expected: builds cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/app/br/mint/br-mint-content.tsx
git commit -m "feat(br-mint): show PrivyInlineLogin in hero when not connected"
```

---

## Task 4: End-to-end verification

**Files:** none

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Open `http://localhost:3000/br/mint` in a fresh browser profile (no `ml_privy_session`, no `ml_registered_*` keys, no Privy auth cookie).

- [ ] **Step 2: Verify the inline form renders**

Within ~1s of page load:
- Hero left column shows the `<PrivyInlineLogin />` card: title, subtitle, email input, **Continuar com email** button, **ou** divider, **Continuar com Google** button, and a small **Já tem uma carteira cripto? Conectar** link.
- The header still shows the existing `<ConnectWallet />` button.
- No console errors.

- [ ] **Step 3: Verify email OTP flow**

1. Type a real email, click **Continuar com email**.
2. The card switches to the OTP stage with the masked email subtitle.
3. Receive the code in the inbox, paste it, click **Verificar**.
4. The card switches to **Criando sua conta…** while PrivyConnector runs preparing-wallet → deploying-account.
5. When the wallet is ready, the card is replaced by `<GenesisMint>`'s mint flow (because `isConnected` flips true).

- [ ] **Step 4: Verify Google OAuth flow**

1. Reload `/br/mint` in another fresh profile.
2. Click **Continuar com Google**.
3. Browser redirects to Google's consent screen.
4. After consent, the user is returned to `/br/mint`.
5. Privy's `authenticated` flips true → PrivyConnector auto-reconnect branch fires (because `ml_privy_session` was set before the redirect) → onboarding completes → `<GenesisMint>` renders.

- [ ] **Step 5: Verify backend registration**

After either flow completes, confirm in localStorage that `ml_registered_<address>` is set to `"1"` (proves `<UserRegistration />` fired). If the backend is reachable, optionally query the `users` table for a row with `walletType=PRIVY`, `appSource=MEDIALANE_DAPP`.

- [ ] **Step 6: Verify the secondary wallet link**

Click the **Já tem uma carteira cripto? Conectar** footer link. The existing `<ConnectWallet />` modal in the header should open (Browser Wallets / Cartridge / Social Login sections).

- [ ] **Step 7: Verify no regression on the global Privy connect path**

1. Open a non-`/br/*` route (e.g. `/marketplace`).
2. Open the nav command menu → click **Email or social** in the 2×2 grid.
3. Confirm the Privy modal opens and the connect flow completes as before.

- [ ] **Step 8: Build sanity + push**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all clean.

If verification has passed, push:

```bash
git push origin main
```

- [ ] **Step 9: Update memory**

Append a note to `/Users/kalamaha/.claude/projects/-Users-kalamaha-dev-medialane-dapp/memory/arch_wallet_onboarding.md`: "Inline Privy email+Google login on /br/* routes; PrivyProvider pre-mounted by pathname; inline form leverages PrivyConnector auto-reconnect branch by setting `ml_privy_session` before login."

---

## Self-review notes

- Spec section A (pre-mount Privy on `/br/*`) → Task 1.
- Spec section B (inline form with Idle/OTP/Connecting stages, hooks used, onboarding trigger via `ml_privy_session`) → Task 2.
- Spec section C (hook into `BrMintContent`) → Task 3.
- Spec section D (visual tokens: `rounded-2xl border border-border/40 bg-card/30 p-5`, primary button uses `bg-primary text-primary-foreground`, Google ghost button uses `bg-background/60 border border-border/50`, footer link uses `text-xs text-muted-foreground underline-offset-4 hover:underline`) → all present in Task 2's component code.
- Spec cross-cutting (UserRegistration still fires) → Task 4 step 5.
- Spec success criteria #1–#7 → Task 4 steps 2–7.
- Spec success criterion #8 (type-check / lint / build) → Task 4 step 8.
- The secondary wallet link uses a ref + `.click()` instead of depending on `<ConnectWallet />` internals. If `<ConnectWallet />` ever exposes a programmatic API, this can be tightened — out of scope.
- Privy hooks (`useLoginWithEmail`, `useLoginWithOAuth`) confirmed present in the installed `@privy-io/react-auth` types.
