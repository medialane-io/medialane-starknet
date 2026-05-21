# @medialane/ui v0.2 — Component Package Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `@medialane/ui` from 5 to 11 components (MotionCard, ScrollSection, ShareButton, CollectionCard, TokenCard + skeletons) so both `medialane-dapp` and `medialane-io` can consume a single source of truth instead of maintaining parallel copies.

**Architecture:** Package-first: build and publish `v0.2.0`, then migrate `medialane-dapp` facades one by one. The facade pattern (`export { X } from "@medialane/ui"` in `src/components/shared/X.tsx`) means zero churn in page-level imports — pages keep importing from `@/components/shared/X`. TokenCard is redesigned callback-driven (no embedded dialogs or app hooks); dapp pages that already pass callbacks work unchanged after migration.

**Tech Stack:** TypeScript + tsup (ESM+CJS build), React 19, Next.js 15, framer-motion, sonner, lucide-react, @medialane/sdk types

---

## File Structure

**Package (`medialane-ui/`):**
- `package.json` — bump `0.1.6 → 0.2.0`, add peer deps
- `tsup.config.ts` — add `framer-motion`, `sonner`, `@medialane/sdk` to externals
- `src/components/motion-primitives.tsx` — CREATE: MotionCard, FadeIn, Stagger, StaggerItem, KineticWords
- `src/components/scroll-section.tsx` — CREATE: horizontal-scroll section shell
- `src/components/share-button.tsx` — CREATE: Web Share API + clipboard fallback
- `src/components/collection-card.tsx` — CREATE: unified CollectionCard + CollectionCardSkeleton
- `src/components/token-card.tsx` — CREATE: callback-driven TokenCard + TokenCardSkeleton + RarityTier
- `src/index.ts` — MODIFY: export all new components

**Consumer (`medialane-dapp/`):**
- `tailwind.config.ts` — MODIFY: add `@medialane/ui` source to content array
- `package.json` — MODIFY: bump `@medialane/ui` to `0.2.0`
- `src/components/ui/motion-primitives.tsx` — MODIFY: re-export from `@medialane/ui`
- `src/components/shared/scroll-section.tsx` — REPLACE: facade only
- `src/components/shared/share-button.tsx` — REPLACE: facade only
- `src/components/shared/collection-card.tsx` — REPLACE: facade only
- `src/components/shared/token-card.tsx` — REPLACE: facade only

---

## Task 1: Prepare @medialane/ui package for v0.2

**Files:**
- Modify: `medialane-ui/package.json`
- Modify: `medialane-ui/tsup.config.ts`

- [ ] **Step 1: Bump version and add peer deps**

Open `/Users/kalamaha/dev/medialane-ui/package.json` and replace the `"version"` and `"peerDependencies"` fields:

```json
{
  "name": "@medialane/ui",
  "version": "0.2.0",
  "description": "Shared UI components for Medialane apps",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./preset": {
      "types": "./dist/preset/tailwind.d.ts",
      "import": "./dist/preset/tailwind.js",
      "require": "./dist/preset/tailwind.cjs"
    }
  },
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0",
    "next": ">=14.0.0",
    "next-themes": ">=0.3.0",
    "lucide-react": ">=0.400.0",
    "tailwind-merge": ">=2.0.0",
    "clsx": ">=2.0.0",
    "framer-motion": ">=10.0.0",
    "sonner": ">=1.0.0",
    "@medialane/sdk": ">=0.6.0"
  },
  "devDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next": "^15.0.0",
    "next-themes": "^0.4.0",
    "lucide-react": "^0.400.0",
    "tailwind-merge": "^2.0.0",
    "clsx": "^2.0.0",
    "framer-motion": "^11.0.0",
    "sonner": "^1.5.0",
    "@medialane/sdk": "^0.6.7",
    "tailwindcss": "^3.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.6.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

- [ ] **Step 2: Add new externals to tsup config**

Open `/Users/kalamaha/dev/medialane-ui/tsup.config.ts` and replace the `external` array in the first config entry:

```ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/components/*.tsx", "src/utils/*.ts", "src/data/*.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    bundle: false,
    external: [
      "react", "react-dom", "next", "next-themes",
      "lucide-react", "tailwind-merge", "clsx",
      "framer-motion", "sonner", "@medialane/sdk",
    ],
    outDir: "dist",
  },
  {
    entry: { "preset/tailwind": "src/preset/tailwind.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    splitting: false,
    external: ["tailwindcss"],
    outDir: "dist",
  },
]);
```

- [ ] **Step 3: Install new dev deps and verify build still passes**

```bash
cd /Users/kalamaha/dev/medialane-ui
~/.bun/bin/bun add -d framer-motion@^11.0.0 sonner@^1.5.0 @medialane/sdk@^0.6.7
~/.bun/bin/bun run build
```

Expected: build succeeds, `dist/` updated with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add package.json tsup.config.ts bun.lock
git commit -m "chore: prepare v0.2.0 — add framer-motion, sonner, sdk peer deps"
```

---

## Task 2: Add MotionCard to @medialane/ui

**Files:**
- Create: `medialane-ui/src/components/motion-primitives.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create motion-primitives.tsx**

Create `/Users/kalamaha/dev/medialane-ui/src/components/motion-primitives.tsx`:

```tsx
"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

export const SPRING = { type: "spring", stiffness: 400, damping: 28 } as const;
export const EASE_OUT = [0.25, 0.46, 0.45, 0.94] as const;

// ─── Press-able card wrapper ──────────────────────────────────────────────────

interface MotionCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
}

export function MotionCard({ children, className, ...props }: MotionCardProps) {
  return (
    <motion.div
      className={className}
      whileTap={{ scale: 0.96 }}
      transition={SPRING}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─── Scroll-triggered fade-in ─────────────────────────────────────────────────

interface FadeInProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

export function FadeIn({ children, className, delay = 0, y = 20 }: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger container ────────────────────────────────────────────────────────

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function Stagger({ children, className, staggerDelay = 0.07 }: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: staggerDelay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
      }}
    >
      {children}
    </motion.div>
  );
}

// ─── Kinetic headline words ───────────────────────────────────────────────────

export function KineticWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
      }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          variants={{
            hidden: { opacity: 0, y: 24, rotateX: -20 },
            show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.5, ease: EASE_OUT } },
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}
```

- [ ] **Step 2: Export from index.ts**

Open `/Users/kalamaha/dev/medialane-ui/src/index.ts` and add after the existing exports:

```ts
export { MotionCard, FadeIn, Stagger, StaggerItem, KineticWords, SPRING, EASE_OUT } from "./components/motion-primitives.js";
export type { } from "./components/motion-primitives.js";
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/kalamaha/dev/medialane-ui
~/.bun/bin/bun run build
```

Expected: `dist/components/motion-primitives.js` and `dist/components/motion-primitives.d.ts` present.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/motion-primitives.tsx src/index.ts
git commit -m "feat: add MotionCard, FadeIn, Stagger, KineticWords to @medialane/ui"
```

---

## Task 3: Add ScrollSection to @medialane/ui

**Files:**
- Create: `medialane-ui/src/components/scroll-section.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create scroll-section.tsx**

Note: The app versions import shadcn `Button`. The package version replaces this with a plain styled `Link` — same visual result, no shadcn dependency.

Create `/Users/kalamaha/dev/medialane-ui/src/components/scroll-section.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface ScrollSectionProps {
  /** Icon element rendered inside the colored badge */
  icon: React.ReactNode;
  /** Tailwind classes for the icon badge (background + shadow) */
  iconBg: string;
  title: string;
  /** "See all" link destination */
  href: string;
  /** Button label — defaults to "See all" */
  linkLabel?: string;
  /** Scroll items: wrap each in a sized snap-start div */
  children: React.ReactNode;
}

export function ScrollSection({
  icon,
  iconBg,
  title,
  href,
  linkLabel = "See all",
  children,
}: ScrollSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${iconBg}`}>
            {icon}
          </div>
          <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
        >
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="w-full overflow-x-auto scrollbar-hide">
        <div className="flex gap-4 snap-x snap-mandatory pb-2" style={{ width: "max-content" }}>
          {children}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Export from index.ts**

Add to `/Users/kalamaha/dev/medialane-ui/src/index.ts`:

```ts
export { ScrollSection } from "./components/scroll-section.js";
export type { ScrollSectionProps } from "./components/scroll-section.js";
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/kalamaha/dev/medialane-ui
~/.bun/bin/bun run build
```

Expected: build passes with no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/scroll-section.tsx src/index.ts
git commit -m "feat: add ScrollSection to @medialane/ui"
```

---

## Task 4: Add ShareButton to @medialane/ui

**Files:**
- Create: `medialane-ui/src/components/share-button.tsx`
- Modify: `medialane-ui/src/index.ts`

- [ ] **Step 1: Create share-button.tsx**

Note: App versions import shadcn `Button`. Package version uses a plain `<button>` with Tailwind — same variants, no shadcn dependency.

Create `/Users/kalamaha/dev/medialane-ui/src/components/share-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../utils/cn.js";

export interface ShareButtonProps {
  title: string;
  url?: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}

const VARIANT_CLASSES: Record<NonNullable<ShareButtonProps["variant"]>, string> = {
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
};

const SIZE_CLASSES: Record<NonNullable<ShareButtonProps["size"]>, string> = {
  sm: "h-9 px-3 text-xs rounded-md",
  default: "h-10 px-4 py-2 text-sm rounded-md",
  lg: "h-11 px-8 text-sm rounded-md",
  icon: "h-9 w-9 rounded-md",
};

export function ShareButton({
  title,
  url,
  variant = "outline",
  size = "sm",
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {
        // User cancelled — ignore
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-emerald-500" />
        : <Share2 className="h-3.5 w-3.5" />
      }
      {size !== "icon" && (
        <span className="ml-1.5">{copied ? "Copied" : "Share"}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Export from index.ts**

Add to `/Users/kalamaha/dev/medialane-ui/src/index.ts`:

```ts
export { ShareButton } from "./components/share-button.js";
export type { ShareButtonProps } from "./components/share-button.js";
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/kalamaha/dev/medialane-ui
~/.bun/bin/bun run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/share-button.tsx src/index.ts
git commit -m "feat: add ShareButton to @medialane/ui"
```

---

## Task 5: Add CollectionCard to @medialane/ui

**Files:**
- Create: `medialane-ui/src/components/collection-card.tsx`
- Modify: `medialane-ui/src/index.ts`

The unified version merges both app versions:
- `settingsHref?` prop from `medialane-io` (gear icon for portfolio pages)
- `collection.isKnown` verified badge from `medialane-dapp`
- Floor price tooltip implemented with CSS `group-hover` — no Radix dep needed

- [ ] **Step 1: Create collection-card.tsx**

Create `/Users/kalamaha/dev/medialane-ui/src/components/collection-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Settings2, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "../utils/cn.js";
import { ipfsToHttp } from "../utils/ipfs.js";
import { formatDisplayPrice } from "../utils/format.js";
import { MotionCard } from "./motion-primitives.js";
import type { ApiCollection } from "@medialane/sdk";

// Pure CSS tooltip — no Radix/shadcn dependency
function FloorTooltip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span className="relative inline-flex items-center gap-0.5 group/tip cursor-default">
      {children}
      <HelpCircle className="h-2.5 w-2.5 text-white/50 group-hover/tip:text-white/80 transition-colors shrink-0" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] font-normal bg-popover text-popover-foreground border border-border rounded-md shadow-md whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity z-50">
        {label}
      </span>
    </span>
  );
}

export interface CollectionCardProps {
  collection: ApiCollection;
  /** Shows settings gear icon linking to this path — used in portfolio pages */
  settingsHref?: string;
  className?: string;
}

export function CollectionCard({ collection, settingsHref, className }: CollectionCardProps) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = collection.image ? ipfsToHttp(collection.image) : null;
  const showImage = imageUrl && !imgError;
  const initial = (collection.name ?? collection.contractAddress).charAt(0).toUpperCase();
  const hasFloor = !!collection.floorPrice;

  return (
    <MotionCard className={cn("card-base group relative", className)}>
      {settingsHref && (
        <Link
          href={settingsHref}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-colors"
          aria-label="Collection settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Link>
      )}

      <Link href={`/collections/${collection.contractAddress}`} className="block relative h-full">
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
          {showImage ? (
            <Image
              src={imageUrl}
              alt={collection.name ?? "Collection"}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/30 via-brand-blue/20 to-brand-navy/40 flex items-center justify-center">
              <span className="text-8xl font-black text-white/10 select-none tracking-tighter">
                {initial}
              </span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 flex flex-col gap-1.5 items-start">
            {!collection.name && collection.metadataStatus === "PENDING" ? (
              <span className="flex items-center gap-1 text-[10px] text-white/60 backdrop-blur-md bg-black/30 rounded-full px-2 py-0.5">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Indexing…
              </span>
            ) : (
              <p
                className="font-bold text-sm text-white leading-tight backdrop-blur-md bg-black/30 rounded-lg px-2.5 py-1 max-w-full truncate"
                style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
              >
                {collection.name ?? "Unnamed Collection"}
                {collection.isKnown && (
                  <CheckCircle2 className="inline-block h-3 w-3 text-blue-400 ml-1.5 shrink-0 align-middle" />
                )}
              </p>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              {collection.totalSupply != null && (
                <span className="text-[10px] font-medium text-white/80 backdrop-blur-md bg-black/30 rounded-full px-2 py-0.5">
                  {collection.totalSupply.toLocaleString()} items
                </span>
              )}
              {hasFloor && (
                <span className="text-[10px] font-bold text-white/90 backdrop-blur-md bg-black/30 rounded-full px-2 py-0.5">
                  <FloorTooltip label="Lowest active listing price in this collection">
                    Floor {formatDisplayPrice(collection.floorPrice)}
                  </FloorTooltip>
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </MotionCard>
  );
}

export function CollectionCardSkeleton() {
  return (
    <div className="card-base overflow-hidden">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        <div className="absolute inset-0 animate-pulse bg-muted" />
        <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
          <div className="h-4 w-2/3 rounded-md bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-1/3 rounded-md bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from index.ts**

Add to `/Users/kalamaha/dev/medialane-ui/src/index.ts`:

```ts
export { CollectionCard, CollectionCardSkeleton } from "./components/collection-card.js";
export type { CollectionCardProps } from "./components/collection-card.js";
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/kalamaha/dev/medialane-ui
~/.bun/bin/bun run build
```

Expected: build passes.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/collection-card.tsx src/index.ts
git commit -m "feat: add CollectionCard + CollectionCardSkeleton to @medialane/ui"
```

---

## Task 6: Add TokenCard to @medialane/ui

**Files:**
- Create: `medialane-ui/src/components/token-card.tsx`
- Modify: `medialane-ui/src/index.ts`

Design: uses `medialane-io`'s superior action layout (always-visible action bar at bottom, not hover-only overlay). All actions are callbacks — no embedded dialogs or app hooks. `inCart` is a prop (consumer manages cart state). `overflowMenu` slot accepts any ReactNode (apps pass their DropdownMenu trigger here).

- [ ] **Step 1: Create token-card.tsx**

Create `/Users/kalamaha/dev/medialane-ui/src/components/token-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart, Tag, ArrowRightLeft, X, Loader2, HandCoins,
  Check, ArrowUpRight, Zap,
} from "lucide-react";
import { cn } from "../utils/cn.js";
import { ipfsToHttp } from "../utils/ipfs.js";
import { formatDisplayPrice } from "../utils/format.js";
import { CurrencyIcon } from "./currency-icon.js";
import { IpTypeBadge } from "./ip-type-badge.js";
import { MotionCard } from "./motion-primitives.js";
import type { ApiToken } from "@medialane/sdk";

export type RarityTier = "legendary" | "epic" | "rare" | "uncommon" | "common";

const RARITY_STYLE: Record<RarityTier, { label: string; className: string } | null> = {
  legendary: { label: "Legendary", className: "bg-yellow-400/90 text-yellow-900" },
  epic:      { label: "Epic",      className: "bg-purple-500/85 text-white" },
  rare:      { label: "Rare",      className: "bg-blue-500/85 text-white" },
  uncommon:  { label: "Uncommon",  className: "bg-emerald-500/85 text-white" },
  common:    null,
};

const BTN_BASE = "h-8 rounded-[11px] flex items-center justify-center gap-1.5 text-xs font-semibold transition-all active:scale-[0.98] shadow-none border-0";
const BTN_SOLID = cn(BTN_BASE, "text-white hover:brightness-110");
const BTN_OUTLINE = cn(BTN_BASE, "border border-border/60 text-foreground hover:bg-muted/60");

export interface TokenCardProps {
  token: ApiToken;
  /** Whether the current user owns this token. Default: false */
  isOwner?: boolean;
  /** Whether this token's listing is already in the cart. Default: false */
  inCart?: boolean;
  /** Show the Buy button for listed tokens. Default: true */
  showBuyButton?: boolean;
  /** Optional rarity label shown as an overlay badge */
  rarityTier?: RarityTier;
  className?: string;
  /** Callbacks — omit any to hide that button */
  onBuy?: (token: ApiToken) => void;
  onCart?: (token: ApiToken) => void;
  onOffer?: (token: ApiToken) => void;
  onList?: (token: ApiToken) => void;
  onCancel?: (token: ApiToken) => void;
  onTransfer?: (token: ApiToken) => void;
  onRemix?: (token: ApiToken) => void;
  onReport?: (token: ApiToken) => void;
  /** Slot for a DropdownMenu trigger — rendered after primary buttons */
  overflowMenu?: React.ReactNode;
}

export function TokenCard({
  token,
  isOwner = false,
  inCart = false,
  showBuyButton = true,
  rarityTier,
  className,
  onBuy,
  onCart,
  onOffer,
  onList,
  onCancel,
  onTransfer,
  overflowMenu,
}: TokenCardProps) {
  const [imgError, setImgError] = useState(false);

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = ipfsToHttp(token.metadata?.image);
  const activeOrder = token.activeOrders?.[0];
  const assetHref = `/asset/${token.contractAddress}/${token.tokenId}`;

  const renderActions = () => {
    // Non-owner + listed + showBuyButton
    if (!isOwner && activeOrder && showBuyButton) {
      return (
        <>
          {onBuy && (
            <button
              className={cn(BTN_SOLID, "flex-1 bg-brand-purple")}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onBuy(token); }}
            >
              <Zap className="h-3.5 w-3.5 shrink-0" />
              Buy
            </button>
          )}
          {onCart && (
            <button
              className={cn(
                BTN_OUTLINE, "w-8 shrink-0",
                inCart && "border-brand-orange/50 bg-brand-orange/10 text-brand-orange"
              )}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCart(token); }}
              disabled={inCart}
              aria-label={inCart ? "In cart" : "Add to cart"}
            >
              {inCart ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
            </button>
          )}
          {onOffer && (
            <button
              className={cn(BTN_OUTLINE, "w-8 shrink-0 text-brand-orange border-brand-orange/40 hover:bg-brand-orange/10")}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOffer(token); }}
              aria-label="Make an offer"
            >
              <HandCoins className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      );
    }

    // Non-owner + no listing (or showBuyButton=false)
    if (!isOwner) {
      if (!onOffer) return null;
      return (
        <>
          <Link href={assetHref} className={cn(BTN_OUTLINE, "flex-1")}>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            View
          </Link>
          <button
            className={cn(BTN_OUTLINE, "w-8 shrink-0 text-brand-orange border-brand-orange/40 hover:bg-brand-orange/10")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOffer(token); }}
            aria-label="Make an offer"
          >
            <HandCoins className="h-3.5 w-3.5" />
          </button>
        </>
      );
    }

    // Owner + listed
    if (isOwner && activeOrder) {
      if (!onCancel) return null;
      return (
        <>
          <button
            className={cn(BTN_SOLID, "flex-1 bg-brand-rose")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onCancel(token); }}
          >
            <X className="h-3.5 w-3.5 shrink-0" />
            Cancel listing
          </button>
          {onTransfer && (
            <button
              className={cn(BTN_OUTLINE, "w-8 shrink-0")}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTransfer(token); }}
              aria-label="Transfer"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      );
    }

    // Owner + unlisted
    if (isOwner && !activeOrder) {
      if (!onList) return null;
      return (
        <>
          <button
            className={cn(BTN_SOLID, "flex-1 bg-brand-blue")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onList(token); }}
          >
            <Tag className="h-3.5 w-3.5 shrink-0" />
            List for sale
          </button>
          {onTransfer && (
            <button
              className={cn(BTN_OUTLINE, "w-8 shrink-0")}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTransfer(token); }}
              aria-label="Transfer"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      );
    }

    return null;
  };

  const actionContent = renderActions();
  const showActionBar = actionContent != null || !!overflowMenu;

  return (
    <MotionCard className={cn("card-base group relative overflow-hidden flex flex-col", className)}>
      <Link href={assetHref} className="block relative shrink-0">
        <div className="relative aspect-square bg-muted overflow-hidden">
          {!imgError ? (
            <Image
              src={image}
              alt={name}
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 22vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-purple/15 to-brand-blue/15">
              <span className="text-2xl font-mono text-muted-foreground">#{token.tokenId}</span>
            </div>
          )}

          {token.metadata?.ipType && (
            <div className="absolute top-2 left-2">
              <IpTypeBadge ipType={token.metadata.ipType as any} size="sm" />
            </div>
          )}

          {rarityTier && RARITY_STYLE[rarityTier] && (
            <div className="absolute top-2 right-2 z-10">
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded-md backdrop-blur-sm text-[10px] font-bold leading-none",
                RARITY_STYLE[rarityTier]!.className
              )}>
                {RARITY_STYLE[rarityTier]!.label}
              </span>
            </div>
          )}

          {(token.metadataStatus === "PENDING" || token.metadataStatus === "FETCHING") && (
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1.5 bg-black/50 backdrop-blur-sm py-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-white/70" />
              <span className="text-[10px] text-white/70">Indexing…</span>
            </div>
          )}
        </div>
      </Link>

      <div className="px-3 pt-2.5 pb-1 flex-1">
        <Link href={assetHref} className="block space-y-0.5 mb-2">
          <p className="text-xl font-bold line-clamp-2 leading-tight">{name}</p>
          {activeOrder && (
            <p className="flex items-center gap-1 text-[11px] font-semibold text-foreground/80">
              <CurrencyIcon symbol={activeOrder.price.currency} size={11} />
              {formatDisplayPrice(activeOrder.price.formatted)}
              <span className="font-normal text-muted-foreground">{activeOrder.price.currency}</span>
            </p>
          )}
          {token.metadata?.description ? (
            <p className="text-[10px] text-muted-foreground truncate leading-snug">
              {token.metadata.description}
            </p>
          ) : token.metadata?.ipType ? (
            <p className="text-[10px] text-muted-foreground opacity-70">{token.metadata.ipType}</p>
          ) : null}
        </Link>
      </div>

      {showActionBar && (
        <div className="flex items-center gap-1.5 px-2 pb-2">
          {actionContent}
          {overflowMenu}
        </div>
      )}
    </MotionCard>
  );
}

export function TokenCardSkeleton() {
  return (
    <div className="card-base overflow-hidden">
      <div className="aspect-square w-full animate-pulse bg-muted" />
      <div className="px-3 pt-2.5 pb-2 space-y-1.5">
        <div className="h-5 w-3/4 rounded-md animate-pulse bg-muted" />
        <div className="h-2.5 w-2/5 rounded-md animate-pulse bg-muted" />
      </div>
      <div className="px-2 pb-2 flex gap-1.5">
        <div className="h-8 flex-1 rounded-[11px] animate-pulse bg-muted" />
        <div className="h-8 w-8 rounded-[11px] animate-pulse bg-muted shrink-0" />
        <div className="h-8 w-8 rounded-[11px] animate-pulse bg-muted shrink-0" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export from index.ts**

Add to `/Users/kalamaha/dev/medialane-ui/src/index.ts`:

```ts
export { TokenCard, TokenCardSkeleton } from "./components/token-card.js";
export type { TokenCardProps, RarityTier } from "./components/token-card.js";
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/kalamaha/dev/medialane-ui
~/.bun/bin/bun run build
```

Expected: build passes, all `.d.ts` files generated.

- [ ] **Step 4: Commit**

```bash
cd /Users/kalamaha/dev/medialane-ui
git add src/components/token-card.tsx src/index.ts
git commit -m "feat: add callback-driven TokenCard + TokenCardSkeleton + RarityTier to @medialane/ui"
```

---

## Task 7: Publish @medialane/ui v0.2.0

**Files:** None (publish only)

- [ ] **Step 1: Run a clean build**

```bash
cd /Users/kalamaha/dev/medialane-ui
~/.bun/bin/bun run build
```

Expected: `dist/` contains `.js`, `.cjs`, and `.d.ts` for each component.

- [ ] **Step 2: Verify dist contents**

```bash
ls /Users/kalamaha/dev/medialane-ui/dist/components/
```

Expected output includes:
```
motion-primitives.js
motion-primitives.d.ts
scroll-section.js
scroll-section.d.ts
share-button.js
share-button.d.ts
collection-card.js
collection-card.d.ts
token-card.js
token-card.d.ts
```

- [ ] **Step 3: Publish**

```bash
cd /Users/kalamaha/dev/medialane-ui
npm publish
```

Expected: `+ @medialane/ui@0.2.0` in output.

- [ ] **Step 4: Verify published**

```bash
npm view @medialane/ui version
```

Expected: `0.2.0`

---

## Task 8: Migrate medialane-dapp to @medialane/ui v0.2.0

**Files:**
- Modify: `medialane-dapp/package.json`
- Modify: `medialane-dapp/tailwind.config.ts`
- Modify: `medialane-dapp/src/components/ui/motion-primitives.tsx`
- Replace: `medialane-dapp/src/components/shared/scroll-section.tsx`
- Replace: `medialane-dapp/src/components/shared/share-button.tsx`
- Replace: `medialane-dapp/src/components/shared/collection-card.tsx`
- Replace: `medialane-dapp/src/components/shared/token-card.tsx`

- [ ] **Step 1: Update @medialane/ui version**

```bash
cd /Users/kalamaha/dev/medialane-dapp
npm install @medialane/ui@0.2.0 --legacy-peer-deps
```

If `npm install` fails due to peer conflicts, use:
```bash
~/.bun/bin/bun add @medialane/ui@0.2.0
```

Expected: `package.json` shows `"@medialane/ui": "0.2.0"` and `node_modules/@medialane/ui` is present.

- [ ] **Step 2: Add @medialane/ui to tailwind content**

Open `/Users/kalamaha/dev/medialane-dapp/tailwind.config.ts` and update the `content` array:

```ts
content: [
  "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  "./node_modules/@medialane/ui/src/**/*.{ts,tsx}",
],
```

This ensures Tailwind scans the package source for class names used in the new components.

- [ ] **Step 3: Update motion-primitives.tsx to re-export from package**

Replace the entire contents of `/Users/kalamaha/dev/medialane-dapp/src/components/ui/motion-primitives.tsx` with:

```tsx
// Re-exported from @medialane/ui — single source of truth
export { MotionCard, FadeIn, Stagger, StaggerItem, KineticWords, SPRING, EASE_OUT } from "@medialane/ui";
```

All existing imports (`import { FadeIn, Stagger } from "@/components/ui/motion-primitives"`) continue to work unchanged.

- [ ] **Step 4: Replace scroll-section.tsx with facade**

Replace the entire contents of `/Users/kalamaha/dev/medialane-dapp/src/components/shared/scroll-section.tsx` with:

```ts
export { ScrollSection } from "@medialane/ui";
export type { ScrollSectionProps } from "@medialane/ui";
```

- [ ] **Step 5: Replace share-button.tsx with facade**

Replace the entire contents of `/Users/kalamaha/dev/medialane-dapp/src/components/shared/share-button.tsx` with:

```ts
export { ShareButton } from "@medialane/ui";
export type { ShareButtonProps } from "@medialane/ui";
```

- [ ] **Step 6: Replace collection-card.tsx with facade**

Replace the entire contents of `/Users/kalamaha/dev/medialane-dapp/src/components/shared/collection-card.tsx` with:

```ts
export { CollectionCard, CollectionCardSkeleton } from "@medialane/ui";
export type { CollectionCardProps } from "@medialane/ui";
```

- [ ] **Step 7: Replace token-card.tsx with facade**

Replace the entire contents of `/Users/kalamaha/dev/medialane-dapp/src/components/shared/token-card.tsx` with:

```ts
export { TokenCard, TokenCardSkeleton } from "@medialane/ui";
export type { TokenCardProps, RarityTier } from "@medialane/ui";
```

Note: The dapp's `src/lib/rarity.ts` still defines its own `RarityTier` type and rarity calculation logic — leave it untouched. Pages that use rarity calculation still import `RarityTier` from there. Pages that only import `TokenCard` and pass a `rarityTier` prop can optionally update to import `RarityTier` from `@/components/shared/token-card` (which re-exports from `@medialane/ui`), but this is not required now.

- [ ] **Step 8: Run the build**

```bash
cd /Users/kalamaha/dev/medialane-dapp
npm run build
```

Expected: build passes with no TypeScript or module resolution errors.

If you see `Module not found: Can't resolve '@medialane/ui'`, ensure step 1 completed and the package is in `node_modules/@medialane/ui`.

If you see `Type error: Property 'X' does not exist`, check that the prop name in the calling code matches the `TokenCardProps` interface in the new package (e.g., dapp used `isOwner` — that prop is still present).

- [ ] **Step 9: Commit**

```bash
cd /Users/kalamaha/dev/medialane-dapp
git add package.json package-lock.json tailwind.config.ts \
  src/components/ui/motion-primitives.tsx \
  src/components/shared/scroll-section.tsx \
  src/components/shared/share-button.tsx \
  src/components/shared/collection-card.tsx \
  src/components/shared/token-card.tsx
git commit -m "feat: migrate shared components to @medialane/ui v0.2.0"
```

---

## Verification Checklist

After Task 8 completes, manually verify in the browser (run `npm run dev`):

- [ ] Home page: `ScrollSection` renders with icon badge + "See all" link + horizontal scroll
- [ ] Home page: `CollectionCard` renders with image, name badge, floor price tooltip (hover to verify)
- [ ] Collection page: `TokenCard` renders correctly in grid — no action bar when no callbacks passed
- [ ] Portfolio/assets page: `TokenCard` shows "List for sale" / "Cancel listing" / Transfer buttons for owned tokens
- [ ] Asset page: `ShareButton` renders and copies URL to clipboard
- [ ] Any page using `FadeIn`/`Stagger`: animations still work (launchpad, creators, discover)
- [ ] Dark mode: all components respect theme correctly (CSS variables intact)
