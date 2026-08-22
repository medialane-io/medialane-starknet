# Audit Findings Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. (Subagent-driven execution is disabled for this user — do not dispatch subagents for this plan.)

**Goal:** Fix the five actionable findings from the 2026-08-16 full-codebase audit of `medialane-starknet`.

**Architecture:** Five independent, single-file-scoped fixes — no shared state between tasks, any order is safe. No new abstractions; each task removes or corrects something that already exists.

**Tech Stack:** Next.js 15 App Router, TypeScript, Bun (package manager + test runner), ESLint.

**Spec:** This plan is self-contained — findings and decisions are recorded inline per task (no separate spec doc; the audit was conversational).

## Global Constraints

- No code comments (project-wide rule; do not add any while editing).
- `bunx tsc --noEmit` and `bun run lint` must stay clean (0 errors) after every task.
- Do not touch the `GET` wildcard in `src/app/api/proxy/v1/[...path]/allowlist.ts` — confirmed intentional, documented by an existing test (`allowlist.test.ts`), out of scope for this plan.
- `working directory: /Users/medialane/dev/medialane-starknet` for every command below.

---

### Task 1: Fix `.env.example` to match actual env vars read by the code

**Files:**
- Modify: `.env.example`

**Interfaces:** None (static documentation file, no code consumes it).

The current file lists variable names the code never reads, including `NEXT_PUBLIC_` prefixed variants of what must be server-only secrets — a dev following it could leak a keyed RPC URL or the backend API key into the browser bundle. Ground truth for what's actually read is `src/lib/constants.ts` plus the swap/Pinata routes.

- [ ] **Step 1: Replace the file contents**

Write `.env.example` as:

```
# Medialane App Environment Variables

NEXT_PUBLIC_APP_URL=https://starknet.medialane.io
# ── Contracts ────────────────────────────────────────────────────────────────
# Marketplace contract addresses are sourced from @medialane/sdk.
# Do not add dapp env overrides for marketplace contracts.
NEXT_PUBLIC_STARKNET_NETWORK=mainnet
NEXT_PUBLIC_EXPLORER_URL=https://voyager.online
# ── Starknet RPC ──────────────────────────────────────────────────────────────
# Both are SERVER-ONLY. The browser only ever talks to /api/rpc.
STARKNET_RPC_URL=
STARKNET_RPC_FALLBACK_URL=

NEXT_PUBLIC_MEDIALANE_BACKEND_URL=https://api.medialane.io
# Server-only: injected by /api/proxy and other server routes, never sent to the browser.
MEDIALANE_API_KEY=

NEXT_PUBLIC_STARKNET_USDC=0x033068F6539f8e6e6b131e6B2B814e6c34A5224bC66947c47DaB9dFeE93b35fb
NEXT_PUBLIC_STARKNET_STRK=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
NEXT_PUBLIC_STARKNET_WBTC=0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac

NEXT_PUBLIC_PINATA_GATEWAY=
PINATA_JWT=
PINATA_DEDICATED_GATEWAY=

NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY=
```

Removed (never read anywhere in `src`): `NEXT_PUBLIC_STARKNET_RPC_URL`, `NEXT_PUBLIC_STARKNET_PROVIDER_URL`, `ALCHEMY_RPC_URL`, `NEXT_PUBLIC_MEDIALANE_API_KEY`, `NEXT_PUBLIC_GATEWAY_URL`, `PINATA_SECRET`, `PINATA_API_KEY`, `NEXT_PUBLIC_PINATA_HOST`, `PINATA_HOST`.
Added (read in code but previously missing): `STARKNET_RPC_URL`, `STARKNET_RPC_FALLBACK_URL`, `NEXT_PUBLIC_PINATA_GATEWAY`, `PINATA_DEDICATED_GATEWAY`, `NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY`.

- [ ] **Step 2: Verify every remaining name is actually read in code**

Run: `grep -oE '^[A-Z_]+=' .env.example | sed 's/=//' | while read v; do grep -rq "process\.env\.$v" src || echo "STALE: $v"; done`
Expected: no output (empty — every name in the file has at least one matching `process.env.<NAME>` read in `src`).

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs: fix .env.example to match actual env vars read by the code"
```

---

### Task 2: Delete dead `src/components/ui/card.tsx`

**Files:**
- Delete: `src/components/ui/card.tsx`

**Interfaces:** None — confirmed zero importers.

The file is a one-line re-export shim (`export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "@medialane/ui";`) left over from the migration to `@medialane/ui` primitives. Nothing imports from `@/components/ui/card`.

- [ ] **Step 1: Confirm zero importers (safety check before deleting)**

Run: `grep -rn 'components/ui/card"' src`
Expected: no output.

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/ui/card.tsx
```

- [ ] **Step 3: Verify typecheck and lint still pass**

Run: `bunx tsc --noEmit && bun run lint`
Expected: both exit 0, no new errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete dead ui/card.tsx re-export shim"
```

---

### Task 3: Delete unused `submitAutoRemixOffer` and `rejectRemixOffer`

**Files:**
- Modify: `src/hooks/use-remix-offers.ts:90-99` (delete `submitAutoRemixOffer`), `src/hooks/use-remix-offers.ts:134-140` (delete `rejectRemixOffer`)

**Interfaces:** Both functions have zero call sites anywhere in `src`; removing them changes no other file's imports.

- [ ] **Step 1: Confirm zero call sites (safety check before deleting)**

Run: `grep -rn "submitAutoRemixOffer\|rejectRemixOffer" src`
Expected: only the two `export async function` declaration lines in `use-remix-offers.ts` — no import or call-site elsewhere.

- [ ] **Step 2: Remove `submitAutoRemixOffer`**

Delete this block from `src/hooks/use-remix-offers.ts`:

```typescript
export async function submitAutoRemixOffer(
  body: { originalContract: string; originalTokenId: string },
  siwsToken: string | null
): Promise<RemixOffer> {
  const res = await authedFetch(`${MEDIALANE_BACKEND_URL}/v1/remix-offers/auto`, siwsToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (res as { data: RemixOffer }).data;
}
```

- [ ] **Step 3: Remove `rejectRemixOffer`**

Delete this block from `src/hooks/use-remix-offers.ts`:

```typescript
export async function rejectRemixOffer(id: string, siwsToken: string | null): Promise<RemixOffer> {
  const res = await authedFetch(`${MEDIALANE_BACKEND_URL}/v1/remix-offers/${id}/reject`, siwsToken, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return (res as { data: RemixOffer }).data;
}
```

- [ ] **Step 4: Verify typecheck, lint, and existing tests still pass**

Run: `bunx tsc --noEmit && bun run lint && bun test`
Expected: all pass, no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-remix-offers.ts
git commit -m "chore: remove unused submitAutoRemixOffer and rejectRemixOffer"
```

---

### Task 4: Rate-limit `POST /api/reports`

**Files:**
- Modify: `src/app/api/reports/route.ts`
- Test: `src/app/api/reports/rate-limit.test.ts` (new — mirrors the existing `allowlist.test.ts` pattern of testing the pure limiter logic rather than the Next route handler)

**Interfaces:**
- Consumes: `createRateLimiter(windowMs: number, max: number): (ip: string) => boolean` from `src/lib/rate-limit.ts` (already used identically in `src/app/api/ipfs/[...cid]/route.ts` and `src/app/api/rpc/route.ts`).
- Produces: nothing new consumed elsewhere — this is a leaf route.

Every other write/fetch route in this repo that talks to an external resource on a per-request basis (`/api/ipfs/[...cid]`, `/api/rpc`) rate-limits by IP at 60s windows. `/api/reports` is the one unauthenticated-by-default POST route without one.

- [ ] **Step 1: Write a focused test for the rate limiter's behavior at the exact window/max this route will use**

Create `src/app/api/reports/rate-limit.test.ts`:

```typescript
import { test, expect } from "bun:test";
import { createRateLimiter } from "@/lib/rate-limit";

test("allows up to the configured max requests per IP within the window", () => {
  const check = createRateLimiter(60_000, 5);
  for (let i = 0; i < 5; i++) {
    expect(check("1.2.3.4")).toBe(true);
  }
  expect(check("1.2.3.4")).toBe(false);
});

test("tracks each IP independently", () => {
  const check = createRateLimiter(60_000, 1);
  expect(check("1.2.3.4")).toBe(true);
  expect(check("5.6.7.8")).toBe(true);
  expect(check("1.2.3.4")).toBe(false);
});
```

- [ ] **Step 2: Run the test to confirm it passes against the existing limiter (this proves the limiter itself is correct before wiring it into the route)**

Run: `bun test src/app/api/reports/rate-limit.test.ts`
Expected: PASS (2 tests) — `createRateLimiter` already exists and is unit-correct; this step validates the exact `(windowMs, max)` pair the route will use next.

- [ ] **Step 3: Wire the limiter into the route**

In `src/app/api/reports/route.ts`, add the import and limiter instance above `POST`:

```typescript
import { createRateLimiter } from "@/lib/rate-limit";

const checkRateLimit = createRateLimiter(60_000, 5);
```

Add the check as the first lines inside `export async function POST(req: NextRequest) {`, before the existing `let body: ...` declaration:

```typescript
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: {
```

(This matches the exact pattern already used in `src/app/api/ipfs/[...cid]/route.ts`.)

- [ ] **Step 4: Verify typecheck, lint, and full test suite pass**

Run: `bunx tsc --noEmit && bun run lint && bun test`
Expected: all pass, no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/reports/route.ts src/app/api/reports/rate-limit.test.ts
git commit -m "fix: rate-limit POST /api/reports by IP"
```

---

### Task 5: Clear the fixable dependency vulnerabilities from `bun audit`

**Files:**
- Modify: `package.json` (`devDependencies.postcss`, `overrides.postcss`)

**Interfaces:** None — dependency-only change, no source code touches `postcss` directly (it's a build-time CSS tool wired through `tailwindcss`/`next`).

`bun audit` currently reports 22 advisories. Only `postcss` (pinned at `8.5.14`, vulnerable range `<=8.5.22`) has a same-major patched version (`8.5.26`) available with no breaking-change risk. The rest (`nanoid`, `brace-expansion`, `js-yaml`) only have fixes at a new major version deep inside `eslint`/`tailwindcss`'s own dependency trees — forcing those via `overrides` risks breaking the dev toolchain for advisories that only matter if the build tool itself processes untrusted input (not the case here). `sharp`/`axios`/`image-size`/`react-router` are transitive inside `next` and the `@cartridge/connector`/`starknetkit` wallet-connector chain respectively — the wallet-connector stack is documented elsewhere in this repo as version-fragile (WASM session engine, pinned versions), so bumping those without live wallet-connect testing in a browser is out of scope for this plan. This task fixes what's safely fixable and leaves a clear record of what's deliberately deferred.

- [ ] **Step 1: Bump the postcss pin**

In `package.json`, change both occurrences of `"postcss": "8.5.14"` (in `devDependencies` and in `overrides`) to `"postcss": "8.5.26"`.

- [ ] **Step 2: Reinstall and confirm the lockfile picked up the bump**

Run: `bun install && bun pm ls | grep postcss`
Expected: shows `postcss@8.5.26` resolved (not `8.5.14`).

- [ ] **Step 3: Re-run the audit and confirm the postcss advisories are gone**

Run: `bun audit 2>&1 | grep -A2 "^postcss"`
Expected: no output (the `postcss` block from the earlier audit no longer appears).

- [ ] **Step 4: Verify the build still succeeds with the bumped postcss**

Run: `bun run build`
Expected: build completes successfully (exit 0) — proves the Tailwind/PostCSS pipeline still works at the new version.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: bump postcss to 8.5.26 to fix GHSA-r28c-9q8g-f849 / GHSA-fxqj-rqcc-2cmp"
```

Leave the remaining `bun audit` findings (`nanoid`, `brace-expansion`, `js-yaml`, `sharp`, `axios`, `image-size`, `react-router`) as a known, deliberately-deferred list — they need either a major-version toolchain bump (dev-only exposure, low urgency) or live wallet-connector verification (out of scope here) before touching.

---

## Self-Review

**Spec coverage:** Finding #1 (open GET proxy) — explicitly dropped per user decision, confirmed intentional/tested, not a task. Finding #2 (.env.example) → Task 1. Finding #3 (dead card.tsx) → Task 2. Finding #4 (unrated /api/reports) → Task 4. Finding #5 (dependency audit) → Task 5. Finding #6 (dead remix exports) → Task 3, deletion per user decision.

**Placeholder scan:** No TBD/TODO markers; every step has literal file contents or exact commands.

**Type consistency:** `createRateLimiter(windowMs: number, max: number): (ip: string) => boolean` used identically in Task 4 as it's already used in `src/app/api/ipfs/[...cid]/route.ts` and `src/app/api/rpc/route.ts` — no new signature invented.
