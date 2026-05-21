# Genesis Mint Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/mint` (English) and `/br/mint` (Portuguese) standalone pages to the dapp, porting the medialane-io mint campaign with Privy/injected/Cartridge wallet support and AVNU-sponsored minting.

**Architecture:** `providers.tsx` skips the Shell (sidebar + footer) for `/mint` and `/br/*` routes via `usePathname`. A shared `GenesisMint` widget drives a connect→mint→success state machine using `useWallet` + `usePaymasterTransaction.executeAuto`. `serializeByteArray` is ported from medialane-io to encode the token URI as Cairo ByteArray calldata.

**Tech Stack:** Next.js App Router, `useWallet`, `usePaymasterTransaction`, `ConnectWallet`, Tailwind CSS, starknet.js v8.

**Spec:** `docs/superpowers/specs/2026-05-12-genesis-mint-design.md`

---

## File Map

| Action | File |
|---|---|
| Modify | `src/app/providers.tsx` |
| Modify | `src/lib/constants.ts` |
| Create | `src/lib/cairo-calldata.ts` |
| Create | `src/components/airdrop/genesis-mint.tsx` |
| Create | `src/app/mint/page.tsx` |
| Create | `src/app/mint/mint-content.tsx` |
| Create | `src/app/br/mint/page.tsx` |
| Create | `src/app/br/mint/br-mint-content.tsx` |

---

## Task 1: Add BR constants and cairo-calldata utility

**Files:**
- Modify: `src/lib/constants.ts`
- Create: `src/lib/cairo-calldata.ts`

- [ ] **Step 1: Add BR env vars to constants.ts**

Open `src/lib/constants.ts`. After the existing `GENESIS_NFT_IMAGE_URL` block (around line 60), add:

```typescript
export const BR_MINT_CONTRACT =
  (process.env.NEXT_PUBLIC_BR_MINT_CONTRACT as `0x${string}`) || ("" as `0x${string}`);
export const BR_NFT_URI =
  process.env.NEXT_PUBLIC_BR_NFT_URI || "";
export const BR_NFT_IMAGE_URL =
  process.env.NEXT_PUBLIC_BR_NFT_IMAGE_URL || "";
```

- [ ] **Step 2: Create cairo-calldata.ts**

```typescript
// src/lib/cairo-calldata.ts

/**
 * Serialize a JS string into Cairo ByteArray calldata felts.
 *
 * Encodes as UTF-8, then packs bytes into 31-byte felt252 chunks
 * (Cairo ByteArray layout), supporting any Unicode string.
 *
 * Returns: [numFullWords, ...fullWords, pendingWord, pendingWordLen]
 */
export function serializeByteArray(str: string): string[] {
  const bytes = new TextEncoder().encode(str);
  const data: string[] = [];
  let i = 0;
  while (i + 31 <= bytes.length) {
    let value = 0n;
    for (let j = 0; j < 31; j++) value = (value << 8n) | BigInt(bytes[i + j]);
    data.push("0x" + value.toString(16));
    i += 31;
  }
  const remaining = bytes.slice(i);
  let pendingWord = 0n;
  for (const byte of remaining) pendingWord = (pendingWord << 8n) | BigInt(byte);
  return [
    data.length.toString(),
    ...data,
    "0x" + pendingWord.toString(16),
    remaining.length.toString(),
  ];
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -E "cairo-calldata|constants"
```

Expected: no output (zero errors in these files).

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/cairo-calldata.ts
git commit -m "feat: add BR mint constants and cairo ByteArray serializer"
```

---

## Task 2: Standalone layout — skip Shell for mint routes

**Files:**
- Modify: `src/app/providers.tsx`

The Shell wraps every page with the sidebar + footer. Mint pages need to render their own standalone layout. Add a `usePathname` check inside `Providers` that renders `{children}` directly for `/mint` and `/br/*`.

- [ ] **Step 1: Add usePathname import**

In `src/app/providers.tsx`, add to the existing React/Next imports at the top:

```typescript
import { usePathname } from "next/navigation";
```

- [ ] **Step 2: Add pathname check inside Providers**

In the `Providers` function, just before the return statement, add:

```typescript
const pathname = usePathname();
const isStandalone = pathname === "/mint" || pathname.startsWith("/br/");
```

- [ ] **Step 3: Conditionally skip Shell in the JSX**

Replace this line inside the `StarkZapWalletProvider` block:

```tsx
<Aurora />
<Shell>{children}</Shell>
<CartDrawer />
<NotificationSpotlight />
<Toaster richColors position="bottom-right" />
```

With:

```tsx
<Aurora />
{isStandalone ? children : <Shell>{children}</Shell>}
<CartDrawer />
<NotificationSpotlight />
<Toaster richColors position="bottom-right" />
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "providers"
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/app/providers.tsx
git commit -m "feat: skip Shell for standalone /mint and /br/* routes"
```

---

## Task 3: GenesisMint widget

**Files:**
- Create: `src/components/airdrop/genesis-mint.tsx`

Shared mint CTA used by both pages. Drives a five-phase state machine: `idle` (not connected) → `ready` → `minting` → `success` | `error`. Reads localStorage on mount to restore a prior successful mint.

- [ ] **Step 1: Create the component**

```typescript
// src/components/airdrop/genesis-mint.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/use-wallet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { serializeByteArray } from "@/lib/cairo-calldata";
import { EXPLORER_URL } from "@/lib/constants";

interface GenesisMintProps {
  contract: string;
  nftUri: string;
  storageKey: string;
  locale?: "en" | "br";
}

type MintPhase = "idle" | "ready" | "minting" | "success" | "error";

const COPY = {
  en: {
    connect: "Join the airdrop",
    claim: "Claim my spot",
    minting: "Claiming…",
    success: "You're in!",
    viewTx: "View transaction",
    retry: "Try again",
    noContract: "Mint not started yet",
  },
  br: {
    connect: "Participar do airdrop",
    claim: "Ativar minha participação",
    minting: "Ativando…",
    success: "Participação confirmada!",
    viewTx: "Ver transação",
    retry: "Tentar novamente",
    noContract: "Distribuição não iniciada ainda",
  },
};

export function GenesisMint({
  contract,
  nftUri,
  storageKey,
  locale = "en",
}: GenesisMintProps) {
  const { address, isConnected } = useWallet();
  const { executeAuto, isLoading } = usePaymasterTransaction();
  const copy = COPY[locale];

  const [phase, setPhase] = useState<MintPhase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lsKey = address ? `${storageKey}_${address}` : null;

  // Restore prior mint from localStorage
  useEffect(() => {
    if (!lsKey) return;
    const stored = localStorage.getItem(lsKey);
    if (stored) {
      setTxHash(stored);
      setPhase("success");
      return;
    }
    setPhase(isConnected ? "ready" : "idle");
  }, [lsKey, isConnected]);

  // Sync idle ↔ ready when wallet connects/disconnects
  useEffect(() => {
    setPhase((prev) => {
      if (prev === "success" || prev === "minting") return prev;
      return isConnected ? "ready" : "idle";
    });
  }, [isConnected]);

  const handleMint = useCallback(async () => {
    if (!contract || !address) return;
    setPhase("minting");
    setError(null);
    try {
      const calldata = [address, ...serializeByteArray(nftUri)];
      const hash = await executeAuto([
        { contractAddress: contract, entrypoint: "mint_item", calldata },
      ]);
      if (!hash) throw new Error("Transaction not confirmed");
      setTxHash(hash);
      setPhase("success");
      if (lsKey) localStorage.setItem(lsKey, hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPhase("error");
    }
  }, [contract, address, nftUri, executeAuto, lsKey]);

  if (phase === "success" && txHash) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {copy.success}
          </span>
        </div>
        <a
          href={`${EXPLORER_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copy.viewTx}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  if (phase === "idle") {
    return <ConnectWallet label={copy.connect} />;
  }

  if (!contract) {
    return (
      <Button disabled size="lg" className="font-bold">
        {copy.noContract}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {phase === "error" && error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <Button
        size="lg"
        className="font-bold gap-2"
        onClick={
          phase === "error"
            ? () => { setPhase("ready"); setError(null); }
            : handleMint
        }
        disabled={phase === "minting" || isLoading}
      >
        {(phase === "minting" || isLoading) && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {phase === "error"
          ? copy.retry
          : phase === "minting"
          ? copy.minting
          : copy.claim}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "genesis-mint"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/airdrop/genesis-mint.tsx
git commit -m "feat: add GenesisMint widget (connect → mint → success state machine)"
```

---

## Task 4: /mint page (English)

**Files:**
- Create: `src/app/mint/page.tsx`
- Create: `src/app/mint/mint-content.tsx`

Port of medialane-io `/mint`. Same sections in the same order. Auth replaced by `useWallet` + `ConnectWallet`.

- [ ] **Step 1: Create page.tsx**

```typescript
// src/app/mint/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { MintContent } from "./mint-content";

const OG_IMAGE =
  "https://crimson-improved-unicorn-113.mypinata.cloud/ipfs/bafybeiglhfpl3ilyaiulzfjxspolmudih2d3t7lr27imy327fjag2s5zrq";

export const metadata: Metadata = {
  title: "Creator's Airdrop — Medialane",
  description:
    "Claim your participation record and join the Medialane Creator's Airdrop. Free for everyone — no approval, no fees. Eligible for every community fund distribution.",
  alternates: {
    canonical: "https://dapp.medialane.io/mint",
    languages: {
      "en-US": "https://dapp.medialane.io/mint",
      "pt-BR": "https://dapp.medialane.io/br/mint",
    },
  },
  openGraph: {
    title: "Creator's Airdrop — Medialane",
    description:
      "Claim your participation record and join the Medialane Creator's Airdrop. Free for everyone — no approval, no fees.",
    locale: "en_US",
    type: "website",
    url: "/mint",
    images: [{ url: OG_IMAGE, width: 1024, height: 1024, alt: "Creator's Airdrop — Medialane" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creator's Airdrop — Medialane",
    description: "Claim your free participation record in the Medialane creator community fund.",
    images: [OG_IMAGE],
  },
};

export default function MintPage() {
  return (
    <Suspense>
      <MintContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create mint-content.tsx**

```typescript
// src/app/mint/mint-content.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
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
  ArrowRight,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MedialaneLogo } from "@/components/brand/medialane-logo";
import { ConnectWallet } from "@/components/ConnectWallet";
import { GenesisMint } from "@/components/airdrop/genesis-mint";
import { useWallet } from "@/hooks/use-wallet";
import { MINT_CONTRACT, GENESIS_NFT_URI, GENESIS_NFT_IMAGE_URL } from "@/lib/constants";

function EventCard() {
  const [errored, setErrored] = useState(false);
  const src = GENESIS_NFT_IMAGE_URL || "/genesis.jpg";
  return (
    <div className="relative rounded-3xl overflow-hidden border border-border/40 shadow-2xl shadow-black/20 aspect-square w-full">
      {errored ? (
        <div className="w-full h-full bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-purple-500/10 flex flex-col items-center justify-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ImageIcon className="h-8 w-8 text-primary/40" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Medialane Airdrop 2026</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Medialane Creator's Airdrop"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

export function MintContent() {
  const { isConnected } = useWallet();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/30 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <Link href="/"><MedialaneLogo /></Link>
        {!isConnected && (
          <ConnectWallet />
        )}
        {isConnected && <ConnectWallet />}
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
                    Creator&apos;s Airdrop — Launch Campaign
                  </span>
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05]">
                  Join the{" "}
                  <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                    Creator&apos;s Airdrop
                  </span>
                </h1>
                <GenesisMint
                  contract={MINT_CONTRACT}
                  nftUri={GENESIS_NFT_URI}
                  storageKey="ml_mint"
                  locale="en"
                />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Medialane is an app for creators to publish, share, and monetize content. Free to join.
                </p>
                <div className="flex items-center gap-4">
                  {["Free to join", "No card needed", "Instant"].map((t) => (
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

          {/* Creator Fund */}
          <section className="py-10 border-t border-border/30 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-black">Creator Fund</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: FileCheck, color: "text-blue-400",   bg: "bg-blue-500/10",   title: "Join for free",      desc: "Sign up with your Google account — no card, no approval needed." },
                { icon: Coins,     color: "text-yellow-500", bg: "bg-yellow-500/10", title: "Creator fund",       desc: "Fund distributions for all participants." },
                { icon: Users,     color: "text-purple-400", bg: "bg-purple-500/10", title: "Boost your chances", desc: "Create, share, and collect!" },
              ].map(({ icon: Icon, color, bg, title, desc }) => (
                <div key={title} className="flex flex-col gap-4 p-5 rounded-2xl border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
                  <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section className="py-10 border-t border-border/30 space-y-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">How it works</p>
              <h2 className="text-2xl sm:text-3xl font-black">Join in seconds.</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Connect your wallet or sign in with email — that&apos;s all you need.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <UserCheck className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-lg">Connect your wallet</p>
                    <span className="text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                      Minimum — you&apos;re in
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Use email, Google, Twitter, or any Starknet wallet. No seed phrase required with social login.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/40 bg-card/30 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <PenLine className="h-5 w-5 text-purple-400" />
                  </div>
                  <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full">Bonus</span>
                </div>
                <div>
                  <p className="font-bold">Create content</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Publish original work — photos, music, art, or writing. Creators get a larger share of each distribution.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/30 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-orange-400" />
                  </div>
                  <span className="text-xs font-semibold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full">Biggest bonus</span>
                </div>
                <div>
                  <p className="font-bold">Trade &amp; collect</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Buy, sell, and collaborate with other creators. Active participants receive the highest share.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Distribution phases */}
          <section className="py-10 border-t border-border/30 space-y-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Distribution</p>
              <h2 className="text-2xl sm:text-3xl font-black">Creator fund phases</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                When the community hits a milestone, platform revenue gets distributed to all participants.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-lg">Phase 1</p>
                  <span className="text-xs font-semibold bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full">5,000 members</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  First distribution. All eligible participants get a proportional share based on their activity.
                </p>
              </div>
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-lg">Phase 2</p>
                  <span className="text-xs font-semibold bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full">10,000 members</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Second distribution, including all revenue since Phase 1. Activity scores recalculated from launch.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 flex items-start gap-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Both phases are planned for the first year of the platform. Milestones are targets, not guarantees — timing depends on growth.
              </p>
            </div>
          </section>

          {/* Eligibility + Disclaimer */}
          <section className="py-10 border-t border-border/30">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Eligibility</p>
                  <h2 className="text-2xl font-black">Who qualifies</h2>
                </div>
                <div className="space-y-2.5 text-sm">
                  {[
                    { ok: true,  text: "Anyone who connects a wallet and claims a spot." },
                    { ok: true,  text: "Creators who publish original content get a higher share." },
                    { ok: true,  text: "Active participants who trade or collaborate get the most." },
                    { ok: false, text: "Automated tools and duplicate accounts are disqualified." },
                    { ok: false, text: "Artificially inflated activity is disqualified." },
                  ].map(({ ok, text }) => (
                    <div key={text} className="flex items-start gap-3">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ok ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                        {ok
                          ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          : <XCircle className="h-3 w-3 text-destructive" />}
                      </div>
                      <span className="text-muted-foreground leading-relaxed">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-2xl font-black">Disclaimer</h2>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>Medialane is a content publishing and creator rewards platform. This campaign is not a financial product, investment scheme, lottery, or gambling service.</p>
                  <p>Participation does not guarantee any financial return. Fund distributions, if any occur, may take the form of platform credits, digital assets, or other community resources.</p>
                  <p>The participation record is a digital record of community membership. It has no inherent monetary value and is not a financial instrument.</p>
                  <p>
                    By participating you agree to the{" "}
                    <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Campaign Terms</a>
                    {" "}and{" "}
                    <a href="https://docs.medialane.io/guidelines/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Terms of Service</a>.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Bottom CTA — not connected only */}
          {!isConnected && (
            <section className="py-10 border-t border-border/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Ready to join?</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Free, instant, no card required.</p>
                </div>
                <ConnectWallet
                  label="Claim my spot"
                  className="h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6"
                />
              </div>
            </section>
          )}

          <div className="pb-12" />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <p className="text-[11px] text-center text-muted-foreground/50 px-5 pt-4">
          Free to join · No purchase required ·{" "}
          <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground/80 transition-colors">
            Campaign terms
          </a>
        </p>
        <div className="px-5 py-4 flex items-center justify-center gap-5 text-xs text-muted-foreground flex-wrap">
          <a href="https://docs.medialane.io/guidelines/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms</a>
          <a href="https://docs.medialane.io/guidelines/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Campaign</a>
          <a href="https://docs.medialane.io/about" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">About</a>
          <span>© {new Date().getFullYear()} Medialane</span>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "mint"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/mint/
git commit -m "feat: add /mint genesis airdrop page (English)"
```

---

## Task 5: /br/mint page (Portuguese)

**Files:**
- Create: `src/app/br/mint/page.tsx`
- Create: `src/app/br/mint/br-mint-content.tsx`

Same structure as `/mint`, all copy in Portuguese, uses BR_* constants.

- [ ] **Step 1: Create page.tsx**

```typescript
// src/app/br/mint/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { BrMintContent } from "./br-mint-content";

const OG_IMAGE =
  "https://crimson-improved-unicorn-113.mypinata.cloud/ipfs/bafybeiglhfpl3ilyaiulzfjxspolmudih2d3t7lr27imy327fjag2s5zrq";

export const metadata: Metadata = {
  title: "Medialane - Campanha de Lançamento no Brasil",
  description:
    "Campanha de Lançamento no Brasil. Publique fotos, vídeos, músicas, e conteúdo autoral para monetizar com Medialane.",
  alternates: {
    canonical: "https://dapp.medialane.io/br/mint",
    languages: {
      "en-US": "https://dapp.medialane.io/mint",
      "pt-BR": "https://dapp.medialane.io/br/mint",
    },
  },
  openGraph: {
    title: "Medialane - Campanha de Lançamento no Brasil",
    description:
      "Campanha de Lançamento no Brasil. Publique fotos, vídeos, músicas, e conteúdo autoral para monetizar com Medialane.",
    locale: "pt_BR",
    type: "website",
    url: "/br/mint",
    images: [{ url: OG_IMAGE, width: 1024, height: 1024, alt: "Airdrop de Prêmios — Medialane Brasil" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Medialane - Campanha de Lançamento no Brasil",
    description: "Campanha de Lançamento no Brasil. Publique fotos, vídeos, músicas, e conteúdo autoral para monetizar com Medialane.",
    images: [OG_IMAGE],
  },
};

export default function BrMintPage() {
  return (
    <Suspense>
      <BrMintContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create br-mint-content.tsx**

```typescript
// src/app/br/mint/br-mint-content.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
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
  ArrowRight,
  XCircle,
} from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import { GenesisMint } from "@/components/airdrop/genesis-mint";
import { MedialaneLogo } from "@/components/brand/medialane-logo";
import { useWallet } from "@/hooks/use-wallet";
import { BR_MINT_CONTRACT, BR_NFT_URI, BR_NFT_IMAGE_URL } from "@/lib/constants";

function EventCard() {
  const [errored, setErrored] = useState(false);
  const src = BR_NFT_IMAGE_URL || "/genesis.jpg";
  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-xl shadow-black/10 aspect-square w-full">
      {errored ? (
        <div className="w-full h-full bg-muted/30 flex flex-col items-center justify-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ImageIcon className="h-7 w-7 text-primary/40" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Medialane Brasil 2026</p>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt="Medialane Airdrop de Prêmios"
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

export function BrMintContent() {
  const { isConnected } = useWallet();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-border/30 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <Link href="/"><MedialaneLogo /></Link>
        <ConnectWallet />
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
                <GenesisMint
                  contract={BR_MINT_CONTRACT}
                  nftUri={BR_NFT_URI}
                  storageKey="ml_br_mint"
                  locale="br"
                />
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

          {/* Fundo dos Criadores */}
          <section className="py-10 border-t border-border/30 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-black">Fundo dos Criadores</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: FileCheck, color: "text-blue-400",   bg: "bg-blue-500/10",   title: "Entre gratuitamente", desc: "Conecte sua carteira ou entre com Google — sem cartão, sem aprovação." },
                { icon: Coins,     color: "text-yellow-500", bg: "bg-yellow-500/10", title: "Fundo dos criadores", desc: "Distribuições do fundo para todos os participantes." },
                { icon: Users,     color: "text-purple-400", bg: "bg-purple-500/10", title: "Aumente suas chances", desc: "Crie, compartilhe e colecione!" },
              ].map(({ icon: Icon, color, bg, title, desc }) => (
                <div key={title} className="flex flex-col gap-4 p-5 rounded-2xl border border-border/40 bg-card/30 hover:bg-card/50 transition-colors">
                  <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Como funciona */}
          <section className="py-10 border-t border-border/30 space-y-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Como funciona</p>
              <h2 className="text-2xl sm:text-3xl font-black">Entre em segundos.</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Conecte sua carteira ou entre com e-mail ou Google — é tudo que você precisa.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 p-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <UserCheck className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-lg">Conecte sua carteira</p>
                    <span className="text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
                      Mínimo — você está dentro
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Use e-mail, Google, Twitter ou qualquer carteira Starknet. Login social não exige seed phrase.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/40 bg-card/30 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    <PenLine className="h-5 w-5 text-purple-400" />
                  </div>
                  <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full">Bônus</span>
                </div>
                <div>
                  <p className="font-bold">Crie conteúdo</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Publique trabalhos originais — fotos, músicas, arte ou textos. Criadores recebem uma parcela maior de cada distribuição.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/40 bg-card/30 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-orange-400" />
                  </div>
                  <span className="text-xs font-semibold text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full">Maior bônus</span>
                </div>
                <div>
                  <p className="font-bold">Troque e colecione</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Compre, venda e colabore com outros criadores. Participantes ativos recebem a maior parcela.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Fases de distribuição */}
          <section className="py-10 border-t border-border/30 space-y-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Distribuição</p>
              <h2 className="text-2xl sm:text-3xl font-black">Fases do fundo dos criadores</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Quando a comunidade atinge uma meta, a receita da plataforma é distribuída para todos os participantes.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-lg">Fase 1</p>
                  <span className="text-xs font-semibold bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full">5.000 membros</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Primeira distribuição. Todos os participantes elegíveis recebem uma parcela proporcional à sua atividade.
                </p>
              </div>
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-lg">Fase 2</p>
                  <span className="text-xs font-semibold bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full">10.000 membros</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Segunda distribuição, incluindo toda a receita desde a Fase 1. Pontuações de atividade recalculadas desde o lançamento.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 flex items-start gap-3">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ambas as fases estão planejadas para o primeiro ano da plataforma. As metas são objetivos, não garantias — o prazo depende do crescimento.
              </p>
            </div>
          </section>

          {/* Elegibilidade + Aviso */}
          <section className="py-10 border-t border-border/30">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Elegibilidade</p>
                  <h2 className="text-2xl font-black">Quem se qualifica</h2>
                </div>
                <div className="space-y-2.5 text-sm">
                  {[
                    { ok: true,  text: "Qualquer pessoa que conecte uma carteira e ative a participação." },
                    { ok: true,  text: "Criadores que publicam conteúdo original recebem uma parcela maior." },
                    { ok: true,  text: "Participantes ativos que trocam ou colaboram recebem mais." },
                    { ok: false, text: "Ferramentas automatizadas e contas duplicadas são desclassificadas." },
                    { ok: false, text: "Atividade artificialmente inflada é desclassificada." },
                  ].map(({ ok, text }) => (
                    <div key={text} className="flex items-start gap-3">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ok ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                        {ok
                          ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          : <XCircle className="h-3 w-3 text-destructive" />}
                      </div>
                      <span className="text-muted-foreground leading-relaxed">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-2xl font-black">Aviso legal</h2>
                </div>
                <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
                  <p>Medialane é uma plataforma de publicação de conteúdo e recompensas para criadores. Esta campanha não é um produto financeiro, esquema de investimento, loteria ou serviço de apostas.</p>
                  <p>A participação não garante nenhum retorno financeiro. As distribuições do fundo, se ocorrerem, podem ser em forma de créditos da plataforma, ativos digitais ou outros recursos da comunidade.</p>
                  <p>O registro de participação é um registro digital de membros da comunidade. Não tem valor monetário intrínseco e não é um instrumento financeiro.</p>
                  <p>
                    Ao participar, você concorda com os{" "}
                    <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Termos da Campanha</a>
                    {" "}e os{" "}
                    <a href="https://docs.medialane.io/guidelines/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors">Termos de Serviço</a>.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA final — apenas desconectado */}
          {!isConnected && (
            <section className="py-10 border-t border-border/30">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">Pronto para entrar?</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Gratuito, instantâneo, sem cartão.</p>
                </div>
                <ConnectWallet
                  label="Ativar minha participação"
                  className="h-11 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6"
                />
              </div>
            </section>
          )}

          <div className="pb-12" />
        </div>
      </div>

      {/* Rodapé */}
      <footer className="border-t border-border/40">
        <p className="text-[11px] text-center text-muted-foreground/50 px-5 pt-4">
          Gratuito · Sem compra obrigatória ·{" "}
          <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-muted-foreground/80 transition-colors">
            Termos da campanha
          </a>
        </p>
        <div className="px-5 py-4 flex items-center justify-center gap-5 text-xs text-muted-foreground flex-wrap">
          <a href="https://docs.medialane.io/guidelines/terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Termos</a>
          <a href="https://docs.medialane.io/guidelines/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacidade</a>
          <a href="https://docs.medialane.io/guidelines/campaign-terms" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Campanha</a>
          <a href="https://docs.medialane.io/about" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Sobre</a>
          <span>© {new Date().getFullYear()} Medialane</span>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "br/mint\|br-mint"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/app/br/
git commit -m "feat: add /br/mint genesis airdrop page (Portuguese)"
```

---

## Task 6: Verify end-to-end

**Files:** none

- [ ] **Step 1: Full type-check and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: zero errors, only pre-existing warnings (no-img-element in other files).

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Test /mint**

Open `http://localhost:3000/mint`. Verify:
- No sidebar visible, no app footer
- Standalone header shows Medialane logo + ConnectWallet icon
- Hero section shows badge, headline, GenesisMint widget, NFT image card
- GenesisMint shows "Join the airdrop" button (not connected)
- Click button → ConnectWallet dialog opens with Social Login option
- Connect via Privy email → GenesisMint transitions to "Claim my spot"
- Click "Claim my spot" → minting spinner → success state with explorer link

- [ ] **Step 4: Test /br/mint**

Open `http://localhost:3000/br/mint`. Verify:
- All copy is in Portuguese
- GenesisMint shows "Participar do airdrop"
- Same connect + mint flow works with `ml_br_mint` storage key (separate from `/mint`)

- [ ] **Step 5: Verify env vars needed in Vercel**

Add these to Vercel project environment variables before deploying:
```
NEXT_PUBLIC_BR_MINT_CONTRACT=<starknet contract address>
NEXT_PUBLIC_BR_NFT_URI=<ipfs:// URI for BR NFT metadata>
NEXT_PUBLIC_BR_NFT_IMAGE_URL=<direct image URL>
```

`NEXT_PUBLIC_MINT_CONTRACT`, `NEXT_PUBLIC_GENESIS_NFT_URI`, and `NEXT_PUBLIC_GENESIS_NFT_IMAGE_URL` should already be set for the `/mint` page.

- [ ] **Step 6: Commit any fixes, then push**

```bash
git push origin main
```
