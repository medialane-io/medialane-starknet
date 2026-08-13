# Account Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `account-panel.tsx`'s crypto-balance readout and off-brand colored badges with a compact contextual dashboard — smart-chip Activity/Offers-received/My-assets rows and a Settings/Theme action row — per `docs/superpowers/specs/2026-08-13-account-panel-redesign-design.md`.

**Architecture:** Single-file rewrite of `src/components/account-panel.tsx`. Every data source, route, and reusable component (`NavThemeToggle`, `useActivitiesByAddress`, `useReceivedOffers`, `useTokensByOwner`) already exists in the codebase — no new hooks, no new shared components, no backend changes.

**Tech Stack:** Next.js, React, `@medialane/ui` (`NavThemeToggle`), existing local hooks.

## Global Constraints

- Brand palette is `brand-blue`/`brand-rose`/`brand-purple`/`brand-orange` only — no green, no other ad hoc colors for non-alert UI. Red stays reserved for the wrong-network alert (a real state, not decoration).
- Content priority if the card gets too tall/busy: Activity > Offers received > My assets — cut "My assets" first.
- No skeleton loaders and no empty-state placeholders for the smart chips — a chip that has nothing to show (loading, zero data) simply doesn't render.
- Reuse the existing `bg-foreground/[0.06]` muted circular chip treatment for icons (established this session in `dual-price.tsx`, now used here too) — don't invent a new icon-container style.

---

## Task 1: Redesign account-panel.tsx

**Files:**
- Modify: `src/components/account-panel.tsx`

**Interfaces:**
- Consumes (all pre-existing, no changes needed to any of these):
  - `useActivitiesByAddress(address: string | null)` from `@/hooks/use-activities` → `{ activities: ApiActivity[] }`
  - `useReceivedOffers(address: string | null)` from `@/hooks/use-orders` → `{ orders: ApiOrder[] }`
  - `useTokensByOwner(address: string | null, page: number, limit: number)` from `@/hooks/use-tokens` → `{ meta?: { total?: number } }`
  - `NavThemeToggle` (no props) from `@medialane/ui`
  - `timeAgo(dateStr: string): string` from `@/lib/utils`
  - `assetHref` not needed (chips link to portfolio list pages, not individual assets)
  - `ApiActivity` type from `@medialane/sdk`: `{ type: "mint"|"transfer"|"sale"|"listing"|"offer"|"cancelled"; timestamp: string; token?: { name: string | null } }`

- [ ] **Step 1: Replace the full file contents**

Read the current file first to confirm it still matches this plan's assumptions (it was last touched by the XP-badge-removal commit, `7770f1c`):

```bash
cat src/components/account-panel.tsx
```

Expected: matches the version with `CreatorScoreInline` already removed, still has the `Balance` block and the two colored `Badge`s (the two things this task removes).

Replace the entire file with:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Activity as ActivityIcon, AlertCircle, ChevronRight, Copy, ExternalLink,
  HandCoins, LayoutGrid, LogOut, Settings, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { useNetwork } from "@/components/starknet-provider";
import { useWallet } from "@/hooks/use-wallet";
import { useActivitiesByAddress } from "@/hooks/use-activities";
import { useReceivedOffers } from "@/hooks/use-orders";
import { useTokensByOwner } from "@/hooks/use-tokens";
import { getConnectorIconSrc } from "@/lib/wallet-connectors";
import { isWrongNetwork as computeIsWrongNetwork } from "@/lib/wallet-error";
import { timeAgo } from "@/lib/utils";
import { useNavAccountSheet, NavThemeToggle } from "@medialane/ui";
import type { ApiActivity } from "@medialane/sdk";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const ACTIVITY_VERB: Record<ApiActivity["type"], string> = {
  sale: "Sold",
  listing: "Listed",
  offer: "Offer on",
  transfer: "Transferred",
  mint: "Minted",
  cancelled: "Cancelled listing",
};

function activitySummary(activity: ApiActivity): string {
  if (activity.type === "cancelled") return "Cancelled listing";
  const name = activity.token?.name;
  return name ? `${ACTIVITY_VERB[activity.type]} "${name}"` : ACTIVITY_VERB[activity.type];
}

/** Icon in the same muted circular chip treatment used for currency icons
 *  elsewhere in the app (dual-price.tsx's CoinChip) — keeps smart-chip
 *  icons visually consistent with the rest of the design system. */
function ChipIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground">
      {children}
    </span>
  );
}

function SmartChip({
  href, icon, children, onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
    >
      <ChipIcon>{icon}</ChipIcon>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{children}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </Link>
  );
}

/**
 * The account/wallet panel content — identity, a compact contextual
 * dashboard (last activity, pending offers, asset count — each collapsed
 * to one smart chip, only rendered when there's something real to show),
 * and disconnect. No crypto balance here — the connected wallet already
 * shows that natively. Rendered once, globally, inside `<NavAccountSheet>`.
 */
export function AccountPanel() {
  const { chainId, connector } = useAccount();
  const { networkConfig } = useNetwork();
  const { address, disconnect } = useWallet();
  const { close } = useNavAccountSheet();
  // The connector's own display name (e.g. "Ready Wallet (formerly Argent)",
  // "Braavos", "Cartridge Controller") — same source connect-dialog.tsx uses,
  // so this never drifts out of sync with what a wallet actually calls itself.
  const walletName = connector?.name ?? "Browser Wallet";
  const walletIconSrc = getConnectorIconSrc(connector?.icon);

  const { activities } = useActivitiesByAddress(address ?? null);
  const { orders: receivedOffers } = useReceivedOffers(address ?? null);
  const { meta: assetsMeta } = useTokensByOwner(address ?? null, 1, 1);

  if (!address) return null;

  const isWrongNetwork = computeIsWrongNetwork(chainId, networkConfig.chainId);
  const lastActivity = activities[0];
  const offersCount = receivedOffers.length;
  const assetsCount = assetsMeta?.total ?? 0;

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  const handleDisconnect = () => {
    disconnect();
    close();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted">
          {walletIconSrc ? (
            <Image src={walletIconSrc} alt="" fill className="object-cover" unoptimized />
          ) : (
            <Wallet className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{truncate(address)}</h3>
            <button onClick={copyAddress} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Copy address">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {walletName} · {networkConfig.name}
          </p>
        </div>
        <Link
          href={`${networkConfig.explorerUrl}/address/${address}`}
          target="_blank"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-all hover:text-foreground"
          aria-label="View on explorer"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2 py-1.5">
        <Link
          href="/settings"
          onClick={close}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <NavThemeToggle />
      </div>

      {(lastActivity || offersCount > 0 || assetsCount > 0) && (
        <div className="space-y-1">
          {lastActivity && (
            <SmartChip href="/portfolio/activity" icon={<ActivityIcon className="h-4 w-4" />} onNavigate={close}>
              {activitySummary(lastActivity)} · {timeAgo(lastActivity.timestamp)}
            </SmartChip>
          )}
          {offersCount > 0 && (
            <SmartChip href="/portfolio/received" icon={<HandCoins className="h-4 w-4" />} onNavigate={close}>
              {offersCount} offer{offersCount > 1 ? "s" : ""} received
            </SmartChip>
          )}
          {assetsCount > 0 && (
            <SmartChip href="/portfolio/assets" icon={<LayoutGrid className="h-4 w-4" />} onNavigate={close}>
              {assetsCount} asset{assetsCount > 1 ? "s" : ""}
            </SmartChip>
          )}
        </div>
      )}

      {isWrongNetwork && (
        <div className="flex gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-red-200">Switch network needed</p>
            <p className="text-[10px] leading-relaxed text-red-200/60">
              Switch to {networkConfig.name} in your wallet to interact with Medialane.
            </p>
          </div>
        </div>
      )}

      <Button
        variant="outline"
        onClick={handleDisconnect}
        className="group h-11 w-full border-border/40 transition-all hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Disconnect
      </Button>
    </div>
  );
}
```

Notes on what changed vs. the spec's ASCII mock: the header keeps its existing top-right Explorer icon-button unchanged (proven, already there) rather than duplicating it into the new action row — the action row below the header holds only Settings + Theme toggle, not Explorer a second time. No close (✕) button was added — `AccountPanel` never rendered its own; it's rendered inside `<NavAccountSheet>`, which owns the sheet's own close chrome (confirmed: original file had no `close`-triggered X button either, only `handleDisconnect` called `close()`).

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: no new warnings/errors in `account-panel.tsx` (pre-existing warnings elsewhere in the repo are unrelated and not a blocker).

- [ ] **Step 4: Full test suite**

Run: `bun test`
Expected: all existing tests still pass (this file has no dedicated test — this just confirms nothing else broke).

- [ ] **Step 5: Manual verification**

Since there's no test file for this component, verify by hand with a connected wallet:
- Header shows avatar, address, copy button, muted `WalletName · NetworkName` caption line (no colored badges), explorer icon-button.
- Action row shows Settings icon-button + Theme toggle (Sun/Moon segmented control).
- Activity chip appears if the connected address has any activity, showing the most recent event only, correctly worded per its `type`.
- Offers-received chip appears only if `useReceivedOffers` returns at least one order, and disappears when it's zero.
- Assets chip appears only if the address owns at least one token, showing the total count.
- Wrong-network banner and Disconnect button behave exactly as before (unchanged code paths).
- Clicking Settings, or any smart chip, navigates and closes the sheet.

- [ ] **Step 6: Commit**

```bash
git add src/components/account-panel.tsx
git commit -m "$(cat <<'EOF'
refactor: redesign account panel as a compact contextual dashboard

Drops the crypto balance (the connected wallet already shows it) and
the off-brand emerald-green badges, replacing them with: a single
muted wallet/network caption line, a Settings + Theme action row, and
up to three smart chips (last activity, offers received, asset count)
that only render when there's real content — no skeletons, no empty
states. Per docs/superpowers/specs/2026-08-13-account-panel-redesign-design.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:** Every spec section maps to this task — identity header restyle, icon-action row (Settings + Theme; Explorer stays in its existing header slot per the note above, a deliberate deviation from the literal ASCII mock to avoid duplicating it), the three conditional smart chips in priority order, wrong-network banner kept, Disconnect kept, balance and colored badges removed.

**Placeholder scan:** None. The one open note (Explorer placement, no invented close button) is explained inline as an intentional, justified deviation from the spec's illustrative mock — not a gap.

**Type consistency:** `ApiActivity["type"]` union used directly as the `ACTIVITY_VERB` record key type, so it can't drift from the SDK's actual type values. Hook return shapes (`activities`, `orders`, `meta`) match what Step 1's Interfaces section declares, verified against each hook's real source during spec-writing.

---

Plan complete and saved to `docs/superpowers/plans/2026-08-13-account-panel-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
