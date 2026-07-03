# Launchpad Grid Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (subagent-driven-development is disabled in this environment — work sequentially in the main thread). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regroup the launchpad's 13 services into 5 creator-intent groups, shrink cards to 3-per-row density, and add a dynamic search/filter bar — all in the shared `@medialane/ui` package, then roll the new version out to `medialane-starknet` and `medialane-io`.

**Architecture:** Pure presentation-layer change over the existing static `LAUNCHPAD_SERVICE_DEFINITIONS` array. No backend/API changes. All work happens in one repo (`medialane-ui`); the two consuming apps only need a dependency version bump at the end (they already wire `LaunchpadGroupedSections` via nothing but an `overrides` prop, so no per-app code changes are expected — this plan verifies that assumption in Task 8).

**Tech Stack:** React 19 (function components), Tailwind CSS (no custom CSS), Framer Motion (`motion`, `AnimatePresence`, `useReducedMotion`), TypeScript, `tsup` build, Bun.

## Global Constraints

- No jargon/crypto terms in any new user-facing copy (no "ERC-721", "ERC-1155", "on-chain", "soulbound", "Web3") — plain creator language throughout, per the design spec.
- No negative-framing copy ("no fees", "never takes custody") — state things positively where any new copy is written.
- `bun run typecheck` must stay clean after every task (this repo has no test runner — `tsc --noEmit` + `bun run build` are the verification bar, matching the repo's existing convention).
- Every card must remain keyboard/touch accessible — the stretched-link pattern (`<Link className="absolute inset-0 z-10">`) and existing `active:`/`sm:hover:` split (no hover-only affordances) must be preserved.
- `motion-reduce:` variants must be preserved on any new animation (existing pattern: `motion-reduce:transform-none motion-reduce:transition-none`).

---

## File Map

| File | Change |
|---|---|
| `src/data/launchpad-services.ts` | Rewrite `ServiceGroup` type + `LAUNCHPAD_SERVICE_GROUPS` to 5 groups; reassign `group:` on 4 services |
| `src/components/launchpad-services.tsx` | Shrink `LaunchpadServiceCard` sizing; widen grid to 3 columns; add filtering state + logic + empty state + animations to `LaunchpadGroupedSections` |
| `src/components/launchpad-filter-bar.tsx` | **New** — `LaunchpadFilterBar` component (search input, group pills, coming-soon toggle, result count) |
| `src/index.ts` | Export `LaunchpadFilterBar` + its props type |
| `package.json` (medialane-ui) | Version bump |
| `package.json` + `bun.lock` (medialane-starknet, medialane-io) | Dependency bump to new `@medialane/ui` version |

No new files in either consuming app are expected. If Task 8's verification surfaces a needed app-side change, it gets added as a new task at that point — don't guess at it now.

---

### Task 1: Regroup service data

**Files:**
- Modify: `/Users/medialane/dev/medialane-ui/src/data/launchpad-services.ts`

**Interfaces:**
- Produces: `ServiceGroup` type now has exactly these values: `"single-edition" | "limited-editions" | "coins" | "community" | "claims" | "coming-soon"`. `LAUNCHPAD_SERVICE_GROUPS` array has exactly 6 entries in this order. Every `ServiceDefinition.group` value is one of the above.

- [ ] **Step 1: Replace the `ServiceGroup` type union**

Replace:
```ts
export type ServiceGroup =
  | "single-edition"
  | "limited-editions"
  | "creator-coins"
  | "collection-drop"
  | "pop-protocol"
  | "ip-tickets"
  | "ip-sponsorship"
  | "ip-club"
  | "licensing-remix"
  | "claims"
  | "coming-soon";
```
With:
```ts
export type ServiceGroup =
  | "single-edition"
  | "limited-editions"
  | "coins"
  | "community"
  | "claims"
  | "coming-soon";
```

- [ ] **Step 2: Replace the `LAUNCHPAD_SERVICE_GROUPS` array**

Replace the entire array (currently 11 entries) with:
```ts
export const LAUNCHPAD_SERVICE_GROUPS: ServiceGroupDefinition[] = [
  {
    key: "single-edition",
    title: "Single Edition",
    tagline: "Publish one-of-a-kind pieces — a song, a photo, a film, a timed drop, or a remix — under your own name.",
  },
  {
    key: "limited-editions",
    title: "Limited Editions",
    tagline: "Release your work in numbered copies your fans can collect and trade.",
  },
  {
    key: "coins",
    title: "Coins",
    tagline: "Launch your own coin — or bring one you already made — and let your community back you.",
  },
  {
    key: "community",
    title: "Community",
    tagline: "Connect with the people who show up for you — badges, tickets, memberships, and direct sponsorship.",
  },
  {
    key: "claims",
    title: "Claims",
    tagline: "Quick wins — claim your name and bring in work you have already made.",
  },
  {
    key: "coming-soon",
    title: "Coming soon",
    tagline: "More ways to earn are on the way.",
  },
];
```

- [ ] **Step 3: Reassign `group:` on the 4 moved services**

In the `LAUNCHPAD_SERVICE_DEFINITIONS` array, change exactly these 4 lines (leave everything else about each definition untouched):

- `collection-drop` definition: change `group: "collection-drop",` to `group: "single-edition",`
- `remix-asset` definition: change `group: "licensing-remix",` to `group: "single-edition",`
- `pop-protocol` definition: change `group: "pop-protocol",` to `group: "community",`
- `ip-tickets` definition: change `group: "ip-tickets",` to `group: "community",`
- `ip-club` definition: change `group: "ip-club",` to `group: "community",`
- `ip-sponsorship` definition: change `group: "ip-sponsorship",` to `group: "community",`
- `creator-coins` definition: change `group: "creator-coins",` to `group: "coins",`
- `claim-memecoin` definition: change `group: "creator-coins",` to `group: "coins",`

(That's 8 line changes, not 4 — `coins` absorbs both `creator-coins` and `claim-memecoin`, `single-edition` absorbs `collection-drop` and `remix-asset`, `community` absorbs 4 services. All other `group:` values — `mint-ip-asset`, `create-collection` at `single-edition`; `ip-collection-1155`, `mint-editions` at `limited-editions`; the 3 `claims` services — are already correct and need no change.)

- [ ] **Step 4: Verify typecheck passes**

Run: `cd /Users/medialane/dev/medialane-ui && bun run typecheck`
Expected: `$ tsc --noEmit` with no output (clean). If it fails, the error will point at a `group:` value that doesn't match the new `ServiceGroup` union — check for a typo against Step 3's list.

- [ ] **Step 5: Commit**

```bash
cd /Users/medialane/dev/medialane-ui
git add src/data/launchpad-services.ts
git commit -m "feat(launchpad): regroup services into 5 creator-intent groups

Single Edition now includes Collection Drop and Remix Asset (same
mechanical type: one unique, tradeable item). Coins absorbs Claim
Memecoin. Community is new — POP Protocol, IP Tickets, IP Club, IP
Sponsorship consolidated (audience/event/membership intent, not just
mechanism). Claims and Limited Editions unchanged. 10 groups -> 6
(5 real + coming-soon)."
```

---

### Task 2: Shrink card visual density

**Files:**
- Modify: `/Users/medialane/dev/medialane-ui/src/components/launchpad-services.tsx:96-238` (the `LaunchpadServiceCard` function)

**Interfaces:**
- Consumes: `ServiceDefinition` (unchanged shape from Task 1).
- Produces: `LaunchpadServiceCard` renders at the new, smaller sizing. No prop signature change — `LaunchpadServiceCardProps` (`def`, `override`, `featured`, `index`) is unchanged, so Task 3+ callers don't need updating for this task alone.

- [ ] **Step 1: Shrink the outer card min-height**

In the "Inner surface" div (around line 133-137), change:
```tsx
"relative flex flex-1 flex-col overflow-hidden min-h-[240px]",
```
to:
```tsx
"relative flex flex-1 flex-col overflow-hidden min-h-[200px]",
```

- [ ] **Step 2: Shrink the content padding**

Around line 158, change:
```tsx
<div className="relative flex flex-col flex-1 p-6 sm:p-8 gap-4 sm:gap-5">
```
to:
```tsx
<div className="relative flex flex-col flex-1 p-5 sm:p-6 gap-3 sm:gap-4">
```

- [ ] **Step 3: Shrink the watermark icon and icon tile**

Around line 155, change:
```tsx
<Icon className={cn("h-44 w-44", live ? hue.text : "text-muted-foreground")} />
```
to:
```tsx
<Icon className={cn("h-32 w-32", live ? hue.text : "text-muted-foreground")} />
```

Around lines 163-165, change:
```tsx
<span className={cn("relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg shadow-black/25 transition-transform duration-300 sm:group-hover:scale-105 motion-reduce:transform-none", hue.pill)}>
  <Icon className="h-7 w-7" />
</span>
```
to:
```tsx
<span className={cn("relative flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg shadow-black/25 transition-transform duration-300 sm:group-hover:scale-105 motion-reduce:transform-none", hue.pill)}>
  <Icon className="h-6 w-6" />
</span>
```

Also shrink the non-live icon fallback right above it (was sized to match the old 14/7 tile), changing:
```tsx
<Icon className="h-9 w-9 shrink-0 text-muted-foreground/50" />
```
to:
```tsx
<Icon className="h-8 w-8 shrink-0 text-muted-foreground/50" />
```

- [ ] **Step 4: Shrink the title, drop the example line, cap feature chips at 2**

Around lines 178-188, replace:
```tsx
<div className="space-y-2">
  <h3 className="text-2xl sm:text-3xl font-black tracking-tight leading-snug">{title}</h3>
  <p className={cn("text-[15px] leading-relaxed", live ? "text-muted-foreground" : "text-muted-foreground/60", !featured && "max-w-[36ch]")}>
    {blurb}
  </p>
  {live && example && (
    <p className="text-[13px] leading-relaxed text-muted-foreground/70 italic">
      e.g. {example}
    </p>
  )}
</div>
```
with:
```tsx
<div className="space-y-1.5">
  <h3 className="text-xl sm:text-2xl font-black tracking-tight leading-snug">{title}</h3>
  <p className={cn("text-sm leading-relaxed", live ? "text-muted-foreground" : "text-muted-foreground/60", !featured && "max-w-[36ch]")}>
    {blurb}
  </p>
</div>
```

Note `example` is now unused in this function — leave the destructured `example` out of the next edit's concern (Step 5 touches the destructure line separately if needed; TypeScript will only warn on an actually-unused top-level variable, and `example` is still destructured at the top of the function alongside other fields used elsewhere, so check Step 6's typecheck for an unused-variable error and remove `example` from the destructure at line 97 if it fires).

Around lines 190-203, replace:
```tsx
{/* Feature showcase — plain-language chips */}
{live && features.length > 0 && (
  <div className="flex flex-wrap gap-1.5">
    {features.map((feature) => (
      <span
        key={feature}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/30 text-xs font-medium text-muted-foreground"
      >
        <Check className={cn("h-3 w-3 shrink-0", hue.text)} />
        {feature}
      </span>
    ))}
  </div>
)}
```
with:
```tsx
{/* Feature showcase — plain-language chips, capped at 2 for card density */}
{live && features.length > 0 && (
  <div className="flex flex-wrap gap-1.5">
    {features.slice(0, 2).map((feature) => (
      <span
        key={feature}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/30 text-xs font-medium text-muted-foreground"
      >
        <Check className={cn("h-3 w-3 shrink-0", hue.text)} />
        {feature}
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 5: Verify typecheck — remove `example` from the destructure if it now warns unused**

Run: `cd /Users/medialane/dev/medialane-ui && bun run typecheck`

If it reports `'example' is declared but its value is never read` (or similar) for line 97, change:
```tsx
const { key, icon: Icon, title, browseLinkLabel, features, example } = def;
```
to:
```tsx
const { key, icon: Icon, title, browseLinkLabel, features } = def;
```
and re-run typecheck to confirm it's now clean.

- [ ] **Step 6: Verify build**

Run: `cd /Users/medialane/dev/medialane-ui && bun run build`
Expected: build completes with no errors (warnings about chunk sizes, if any, are pre-existing and fine).

- [ ] **Step 7: Commit**

```bash
cd /Users/medialane/dev/medialane-ui
git add src/components/launchpad-services.tsx
git commit -m "feat(launchpad): shrink service card density for 3-per-row grid

min-h 240px -> 200px, padding p-6/8 -> p-5/6, title 2xl/3xl -> xl/2xl,
watermark icon 44 -> 32, icon tile 14 -> 12, feature chips capped at 2
(was showing all 3), example/e.g. line dropped from the card entirely.
Grid column change comes in the next task."
```

---

### Task 3: Widen grid to 3 columns, gate POP how-it-works on the new group

**Files:**
- Modify: `/Users/medialane/dev/medialane-ui/src/components/launchpad-services.tsx:302-339` (`LaunchpadGroupedSectionsProps` interface and `LaunchpadGroupedSections` function)

**Interfaces:**
- Consumes: `LAUNCHPAD_SERVICE_GROUPS` (6 entries from Task 1), `LAUNCHPAD_SERVICE_DEFINITIONS` (regrouped from Task 1), `LaunchpadServiceCard` (Task 2's smaller version).
- Produces: `LaunchpadGroupedSections({ overrides, className })` unchanged prop signature for this task (filtering props come in Task 5) — this task only changes the grid's column count and which group key triggers `PopHowItWorks`.

- [ ] **Step 1: Widen the grid columns**

Around line 328, change:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-7">
```
to:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
```

- [ ] **Step 2: Re-key the `PopHowItWorks` trigger to the new `community` group**

Around line 332, change:
```tsx
{group.key === "pop-protocol" && <PopHowItWorks />}
```
to:
```tsx
{group.key === "community" && <PopHowItWorks />}
```

(This is a temporary broadening — `community` now has 4 services, not just POP, so `PopHowItWorks` will render alongside all of them for now. Task 5 makes this conditional on POP actually being present in the filtered set; that's a correctness fix, not introduced fresh here, so don't try to solve it in this task.)

- [ ] **Step 3: Verify typecheck and build**

Run: `cd /Users/medialane/dev/medialane-ui && bun run typecheck && bun run build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
cd /Users/medialane/dev/medialane-ui
git add src/components/launchpad-services.tsx
git commit -m "feat(launchpad): widen grid to 3 columns on desktop

grid-cols-1 sm:grid-cols-2 -> grid-cols-1 sm:grid-cols-2 lg:grid-cols-3.
PopHowItWorks now keys off the community group (was pop-protocol) since
POP moved there in the regroup — Task 5 will make it conditional on POP
actually being visible under the active filter."
```

---

### Task 4: Build the `LaunchpadFilterBar` component

**Files:**
- Create: `/Users/medialane/dev/medialane-ui/src/components/launchpad-filter-bar.tsx`

**Interfaces:**
- Consumes: `ServiceGroupDefinition[]` (the 5 real groups, `coming-soon` excluded by the caller — this component does not know about `coming-soon` at all), `ServiceGroup` type (both from `../data/launchpad-services.js`).
- Produces:
  ```ts
  export interface LaunchpadFilterBarProps {
    query: string;
    onQueryChange: (value: string) => void;
    groups: ServiceGroupDefinition[];
    activeGroups: Set<ServiceGroup>;
    onToggleGroup: (key: ServiceGroup) => void;
    showComingSoon: boolean;
    onToggleComingSoon: (value: boolean) => void;
    resultCount: number;
  }
  export function LaunchpadFilterBar(props: LaunchpadFilterBarProps): JSX.Element
  ```
  This is the exact interface Task 5 wires up — the state lives in `LaunchpadGroupedSections`, this component is presentation-only (controlled component, no internal state).

- [ ] **Step 1: Write the component**

Create `/Users/medialane/dev/medialane-ui/src/components/launchpad-filter-bar.tsx`:
```tsx
"use client";

import { Search, X } from "lucide-react";
import { cn } from "../utils/cn.js";
import type { ServiceGroup, ServiceGroupDefinition } from "../data/launchpad-services.js";

export interface LaunchpadFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  groups: ServiceGroupDefinition[];
  activeGroups: Set<ServiceGroup>;
  onToggleGroup: (key: ServiceGroup) => void;
  showComingSoon: boolean;
  onToggleComingSoon: (value: boolean) => void;
  resultCount: number;
}

/**
 * Search + group-filter bar sitting above the grouped launchpad sections.
 * Fully controlled — all state (query, active groups, coming-soon toggle)
 * lives in the caller (`LaunchpadGroupedSections`) so the grid below can
 * react to the same state without prop-drilling through this component.
 */
export function LaunchpadFilterBar({
  query,
  onQueryChange,
  groups,
  activeGroups,
  onToggleGroup,
  showComingSoon,
  onToggleComingSoon,
  resultCount,
}: LaunchpadFilterBarProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search services"
            className="w-full h-10 rounded-full border border-border bg-card pl-9 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {groups.map((group) => {
            const active = activeGroups.has(group.key);
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => onToggleGroup(group.key)}
                aria-pressed={active}
                className={cn(
                  "h-8 px-3.5 rounded-full text-xs font-semibold transition-colors border",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border active:bg-muted/60 sm:hover:bg-muted/40",
                )}
              >
                {group.title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showComingSoon}
            onChange={(e) => onToggleComingSoon(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          Show coming soon
        </label>
        <p className="text-xs text-muted-foreground">
          {resultCount} {resultCount === 1 ? "service" : "services"}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/medialane/dev/medialane-ui && bun run typecheck`
Expected: clean. (This component isn't imported/used anywhere yet, so a clean typecheck here just confirms the file itself is well-typed in isolation.)

- [ ] **Step 3: Commit**

```bash
cd /Users/medialane/dev/medialane-ui
git add src/components/launchpad-filter-bar.tsx
git commit -m "feat(launchpad): add LaunchpadFilterBar component

Controlled search input + multi-select group pills + coming-soon
toggle + live result count. Not wired up yet (next task lifts the
state into LaunchpadGroupedSections and connects filtering)."
```

---

### Task 5: Wire filter state and filtering logic into `LaunchpadGroupedSections`

**Files:**
- Modify: `/Users/medialane/dev/medialane-ui/src/components/launchpad-services.tsx` (imports, and the `LaunchpadGroupedSections` function body)

**Interfaces:**
- Consumes: `LaunchpadFilterBar` (Task 4's exact props shape), `ServiceGroup`, `ServiceGroupDefinition`, `ServiceDefinition` (from `../data/launchpad-services.js`).
- Produces: `LaunchpadGroupedSections({ overrides, className })` — prop signature is unchanged from the caller's perspective (both apps' existing `<LaunchpadGroupedSections overrides={...} />` call sites keep working with zero changes).

- [ ] **Step 1: Add the new imports**

At the top of `/Users/medialane/dev/medialane-ui/src/components/launchpad-services.tsx`, change:
```tsx
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, ArrowRight, Check } from "lucide-react";
import { cn } from "../utils/cn.js";
import {
  LAUNCHPAD_SERVICE_DEFINITIONS,
  LAUNCHPAD_SERVICE_GROUPS,
  type ServiceDefinition,
  type ServiceGroup,
  type ServiceGroupDefinition,
  type ServiceStatus,
} from "../data/launchpad-services.js";
```
to:
```tsx
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lock, ArrowRight, Check } from "lucide-react";
import { cn } from "../utils/cn.js";
import {
  LAUNCHPAD_SERVICE_DEFINITIONS,
  LAUNCHPAD_SERVICE_GROUPS,
  type ServiceDefinition,
  type ServiceGroup,
  type ServiceGroupDefinition,
  type ServiceStatus,
} from "../data/launchpad-services.js";
import { LaunchpadFilterBar } from "./launchpad-filter-bar.js";
```

- [ ] **Step 2: Replace the `LaunchpadGroupedSections` function body**

Replace the entire function (from `export function LaunchpadGroupedSections` to its closing brace, currently lines ~310-339) with:
```tsx
export function LaunchpadGroupedSections({ overrides, className }: LaunchpadGroupedSectionsProps) {
  const [query, setQuery] = useState("");
  const [activeGroups, setActiveGroups] = useState<Set<ServiceGroup>>(new Set());
  const [showComingSoon, setShowComingSoon] = useState(false);

  const filterableGroups = LAUNCHPAD_SERVICE_GROUPS.filter((g) => g.key !== "coming-soon");

  const toggleGroup = (key: ServiceGroup) => {
    setActiveGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const matches = (def: ServiceDefinition): boolean => {
    if (activeGroups.size > 0 && !activeGroups.has(def.group)) return false;
    if (!showComingSoon && def.status !== "live") return false;
    if (query.trim() === "") return true;
    const haystack = `${def.title} ${def.blurb} ${def.subtitle}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  };

  const totalMatches = useMemo(
    () => LAUNCHPAD_SERVICE_DEFINITIONS.filter(matches).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, activeGroups, showComingSoon],
  );

  return (
    <div className={cn("space-y-8 sm:space-y-10", className)}>
      <LaunchpadFilterBar
        query={query}
        onQueryChange={setQuery}
        groups={filterableGroups}
        activeGroups={activeGroups}
        onToggleGroup={toggleGroup}
        showComingSoon={showComingSoon}
        onToggleComingSoon={setShowComingSoon}
        resultCount={totalMatches}
      />

      {totalMatches === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-lg font-semibold">No services match</p>
          <p className="text-sm text-muted-foreground">Try a different search or clear your filters.</p>
          <button
            type="button"
            onClick={() => { setQuery(""); setActiveGroups(new Set()); }}
            className="inline-flex items-center h-9 px-4 rounded-full text-sm font-semibold bg-primary text-primary-foreground"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-20 sm:space-y-28">
          <AnimatePresence>
            {LAUNCHPAD_SERVICE_GROUPS.map((group) => {
              if (group.key === "coming-soon") {
                const comingSoonDefs = LAUNCHPAD_SERVICE_DEFINITIONS.filter(
                  (d) => d.group === group.key && matches(d),
                );
                if (comingSoonDefs.length === 0) return null;
                return <ComingSoonStrip key={group.key} group={group} defs={comingSoonDefs} />;
              }

              const defs = LAUNCHPAD_SERVICE_DEFINITIONS.filter((d) => d.group === group.key && matches(d));
              if (defs.length === 0) return null;

              const showPopHowItWorks = group.key === "community" && defs.some((d) => d.key === "pop-protocol");

              return (
                <motion.div
                  key={group.key}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="space-y-7 sm:space-y-10"
                >
                  <GroupHeader group={group} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                    {defs.map((def, i) => (
                      <LaunchpadServiceCard key={def.key} def={def} override={overrides[def.key]} index={i} />
                    ))}
                    {showPopHowItWorks && <PopHowItWorks />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add `layout` to each card's motion wrapper so filtering animates smoothly**

In `LaunchpadServiceCard` (around line 107-113), change:
```tsx
<motion.div
  initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-40px" }}
  transition={{ duration: 0.45, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
  className={cn("flex", featured && "sm:col-span-2")}
>
```
to:
```tsx
<motion.div
  layout={!reduceMotion}
  initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0 }}
  viewport={{ once: true, margin: "-40px" }}
  transition={{ duration: 0.45, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
  className={cn("flex", featured && "sm:col-span-2")}
>
```

- [ ] **Step 4: Verify typecheck**

Run: `cd /Users/medialane/dev/medialane-ui && bun run typecheck`
Expected: clean. If `useMemo`'s exhaustive-deps eslint comment causes a typecheck (not lint) issue, it won't — `tsc` doesn't run eslint rules; the comment is inert to `tsc` and only suppresses an eslint warning if this package runs eslint (it doesn't have a lint script per its `package.json`, only `build`/`dev`/`typecheck`, so the comment is precautionary and harmless either way).

- [ ] **Step 5: Verify build**

Run: `cd /Users/medialane/dev/medialane-ui && bun run build`
Expected: clean build.

- [ ] **Step 6: Commit**

```bash
cd /Users/medialane/dev/medialane-ui
git add src/components/launchpad-services.tsx
git commit -m "feat(launchpad): wire dynamic search/filter into grouped sections

LaunchpadGroupedSections now owns query/activeGroups/showComingSoon
state, filters LAUNCHPAD_SERVICE_DEFINITIONS through a single matches()
predicate, hides any group section with zero matches (including the
coming-soon strip), and shows a clear-filters empty state when nothing
matches anywhere. PopHowItWorks is now correctly conditional on POP
actually being in the filtered community group. Cards get layout
animations (via framer-motion's layout prop) so filtering reflows
smoothly instead of hard-cutting. Public LaunchpadGroupedSections prop
signature (overrides, className) is unchanged."
```

---

### Task 6: Export `LaunchpadFilterBar` from the package root

**Files:**
- Modify: `/Users/medialane/dev/medialane-ui/src/index.ts:106-112`

**Interfaces:**
- Produces: `LaunchpadFilterBar` and `LaunchpadFilterBarProps` become part of the package's public API (importable via `@medialane/ui`), matching how every other component in this file is exported.

- [ ] **Step 1: Add the export**

Around line 107-108, change:
```ts
// ── Launchpad (grouped sections — single page-UI source since 0.8.0) ─────────
export { LaunchpadGroupedSections, LaunchpadServiceCard, SERVICE_HUES } from "./components/launchpad-services.js";
```
to:
```ts
// ── Launchpad (grouped sections — single page-UI source since 0.8.0) ─────────
export { LaunchpadGroupedSections, LaunchpadServiceCard, SERVICE_HUES } from "./components/launchpad-services.js";
export { LaunchpadFilterBar } from "./components/launchpad-filter-bar.js";
export type { LaunchpadFilterBarProps } from "./components/launchpad-filter-bar.js";
```

- [ ] **Step 2: Verify typecheck and build**

Run: `cd /Users/medialane/dev/medialane-ui && bun run typecheck && bun run build`
Expected: both clean. Check the build output includes `dist/components/launchpad-filter-bar.js` and its `.d.ts` — confirms the new file is actually bundled, not just typechecked in isolation.

- [ ] **Step 3: Commit**

```bash
cd /Users/medialane/dev/medialane-ui
git add src/index.ts
git commit -m "feat(launchpad): export LaunchpadFilterBar from package root"
```

---

### Task 7: Version bump and publish

**Files:**
- Modify: `/Users/medialane/dev/medialane-ui/package.json`

**Interfaces:**
- Produces: a new published version on npm that both consuming apps bump to in Task 8. Check the currently-published version first — do not assume it's still `0.34.2` (there may be an unpublished bump already sitting in `package.json` from prior work in this session; read the file before editing).

- [ ] **Step 1: Read the current version and bump it**

Run: `cat /Users/medialane/dev/medialane-ui/package.json | grep '"version"'`

Increment the minor version by one from whatever is currently there (this is a feature addition — new exported component, new grouping behavior — not a patch). Edit the `"version"` field in `package.json` accordingly.

- [ ] **Step 2: Rebuild and verify one final time**

Run: `cd /Users/medialane/dev/medialane-ui && bun run typecheck && bun run build`
Expected: both clean.

- [ ] **Step 3: Commit the version bump**

```bash
cd /Users/medialane/dev/medialane-ui
git add package.json
git commit -m "chore: bump @medialane/ui to <new-version> — launchpad grid redesign"
```

- [ ] **Step 4: Push to origin**

Run: `git push origin main`

- [ ] **Step 5: Publish to npm**

This step requires an npm publish token supplied by the user via a local `.npmrc` (per this project's established one-time-token pattern — never a persistent npm login). Ask the user for a token if one hasn't already been provided in the session, write it to `/Users/medialane/dev/medialane-ui/.npmrc`, run `bun publish`, then immediately delete the `.npmrc` file regardless of outcome.

Expected output ends with a line like `+ @medialane/ui@<new-version>`.

---

### Task 8: Bump both apps and verify

**Files:**
- Modify: `/Users/medialane/dev/medialane-starknet/package.json`, `/Users/medialane/dev/medialane-starknet/bun.lock`
- Modify: `/Users/medialane/dev/medialane-io/package.json`, `/Users/medialane/dev/medialane-io/bun.lock`

**Interfaces:**
- Consumes: the new `@medialane/ui` version published in Task 7.
- Produces: both apps' `/launchpad` pages render the new grid with zero source changes beyond the dependency bump — this task's job is to confirm that assumption, not to write new app code. If it doesn't hold, stop and add a new task rather than improvising a fix inline (see the note at the end).

- [ ] **Step 1: Bump medialane-starknet**

```bash
cd /Users/medialane/dev/medialane-starknet
bun add @medialane/ui@<new-version>
```
Expected output ends with `installed @medialane/ui@<new-version>`.

- [ ] **Step 2: Typecheck and build medialane-starknet**

```bash
bunx tsc --noEmit
bun run build
```
Expected: `tsc --noEmit` produces no output (clean). The Next.js build may fail on unrelated missing env vars in this local environment (e.g. `PRIVY_APP_ID`) — if it does, confirm the failure is the same pre-existing `/api/wallet/starknet` env-var error seen earlier in this session and not something new about the launchpad page; if it's a new error, stop and investigate before continuing.

- [ ] **Step 3: Commit medialane-starknet's bump**

```bash
git add package.json bun.lock
git commit -m "chore: bump @medialane/ui to <new-version> — launchpad grid redesign"
git push origin main
```

- [ ] **Step 4: Bump medialane-io**

```bash
cd /Users/medialane/dev/medialane-io
bun add @medialane/ui@<new-version>
```
Expected output ends with `installed @medialane/ui@<new-version>`.

- [ ] **Step 5: Typecheck, lint, and build medialane-io**

```bash
bun run typecheck 2>/dev/null || bunx tsc --noEmit
bun run lint
bun run build
```
Expected: all three clean. (This repo's exact typecheck script name — verify with `cat package.json | grep -A15 '"scripts"'` if the first command isn't recognized; use whatever the repo actually defines, following the pattern already established earlier in this session for this repo.)

- [ ] **Step 6: Commit medialane-io's bump**

```bash
git add package.json bun.lock
git commit -m "chore: bump @medialane/ui to <new-version> — launchpad grid redesign"
git push origin main
```

- [ ] **Step 7: Manual visual verification**

Run each app's dev server (`bun run dev` in each repo) and open `/launchpad` in a browser. Confirm:
- Cards render 3-per-row on a desktop-width viewport, 2-per-row tablet, 1-per-row mobile
- 5 group sections appear in order: Single Edition, Limited Editions, Coins, Community, Claims (plus Coming Soon if any defs ever populate it)
- Single Edition includes Mint singular NFT, Create NFT Collection, Collection Drop, and Remix Asset
- Community includes POP Protocol, IP Tickets, IP Club, and IP Sponsorship, with the POP how-it-works column present
- Typing in the search box narrows the grid live; clearing it restores everything
- Clicking a group pill narrows to just that group; clicking again clears it
- Toggling "Show coming soon" doesn't change anything visible unless a `status: "building"` def exists somewhere (none do today — this is forward-looking, confirm it at least doesn't error)
- A nonsense search query produces the empty state with a working "Clear filters" button

If any of the above doesn't hold, that's a bug in this plan's implementation, not a sign to add scope — fix the specific line, re-verify, and note what was wrong in the commit message for that fix.

**Note on "no per-app changes expected":** if Task 8 surfaces something that genuinely requires an app-side code change (not just the dependency bump), stop before making it. Confirm with the user whether it belongs in this plan or is a follow-up — the spec explicitly scoped this as a shared-package-only change.
