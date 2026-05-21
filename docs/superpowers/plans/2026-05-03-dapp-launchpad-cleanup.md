# Dapp Launchpad Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the `/launchpad/ip1155` route to `/launchpad/nfteditions` (matching medialane-io), add a redirect so old URLs still work, and update all internal references. Also fix the `DropConditions` type import in use-drops.ts if it is not already exported.

**Architecture:** Git-move the `ip1155` directory to `nfteditions`. Add a Next.js redirect in `next.config.ts`. Update all hrefs and import paths that reference `ip1155`.

**Tech Stack:** Next.js 15 App Router (file-based routing), `next.config.ts` redirects

---

### Task 1: Rename ip1155 → nfteditions

**Files:**
- Rename: `src/app/launchpad/ip1155/` → `src/app/launchpad/nfteditions/`
- Modify: `next.config.ts` (add redirect)
- Modify: `src/app/launchpad/launchpad-content.tsx` (update href)
- Any other files referencing `/launchpad/ip1155`

- [ ] **Step 1: Find all references to ip1155**

Run:
```bash
grep -r "ip1155" /Users/kalamaha/dev/medialane-dapp/src --include="*.tsx" --include="*.ts" -l
```

Note the list of files. You will update each one after the rename.

- [ ] **Step 2: Move the directory**

```bash
mv /Users/kalamaha/dev/medialane-dapp/src/app/launchpad/ip1155 \
   /Users/kalamaha/dev/medialane-dapp/src/app/launchpad/nfteditions
```

- [ ] **Step 3: Update hrefs in launchpad-content.tsx**

In `src/app/launchpad/launchpad-content.tsx`, update the DAPP_HREFS map entry for `"ip-collection-1155"` and `"mint-editions"`:

```typescript
// old
"ip-collection-1155": { href: "/launchpad/ip1155/create", buttonLabel: "Create Collection" },
"mint-editions":      { href: "/launchpad/ip1155",      buttonLabel: "Mint editions"      },
```

```typescript
// new
"ip-collection-1155": { href: "/launchpad/nfteditions/create", buttonLabel: "Create Collection" },
"mint-editions":      { href: "/launchpad/nfteditions",        buttonLabel: "Mint editions"      },
```

- [ ] **Step 4: Update any other internal references**

For each file found in Step 1, replace every occurrence of `/launchpad/ip1155` with `/launchpad/nfteditions` and every occurrence of `launchpad/ip1155` (import paths) with `launchpad/nfteditions`.

Verify with:
```bash
grep -r "ip1155" /Users/kalamaha/dev/medialane-dapp/src --include="*.tsx" --include="*.ts"
```
Expected: no results (all references updated).

- [ ] **Step 5: Add redirect in next.config.ts**

Open `next.config.ts` and add a permanent redirect so bookmarks and external links to the old route still work:

```typescript
// inside the NextConfig object, add or extend the `redirects` async function:
async redirects() {
  return [
    {
      source: "/launchpad/ip1155",
      destination: "/launchpad/nfteditions",
      permanent: true,
    },
    {
      source: "/launchpad/ip1155/:path*",
      destination: "/launchpad/nfteditions/:path*",
      permanent: true,
    },
  ];
},
```

- [ ] **Step 6: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no errors about ip1155 or nfteditions

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: rename launchpad/ip1155 → launchpad/nfteditions with permanent redirects"
```

---

### Task 2: Verify and export DropConditions type from use-drops.ts

The `asset-page-drop.tsx` plan imports `DropConditions` from `@/hooks/use-drops`. This step ensures the type is exported.

**Files:**
- Modify (if needed): `src/hooks/use-drops.ts`

- [ ] **Step 1: Check if DropConditions is exported**

Run:
```bash
grep "DropConditions\|export.*DropConditions" /Users/kalamaha/dev/medialane-dapp/src/hooks/use-drops.ts
```

If the output shows `DropConditions` defined but not exported, add `export` to the interface.

- [ ] **Step 2: Export DropConditions if needed**

If the grep in Step 1 shows `interface DropConditions` or `type DropConditions` without `export`, change it to `export interface DropConditions` or `export type DropConditions`.

If it is already exported, skip to Step 3.

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "DropConditions"`
Expected: no errors

- [ ] **Step 4: Commit (only if a change was made)**

```bash
git add src/hooks/use-drops.ts
git commit -m "fix: export DropConditions type from use-drops.ts"
```

---

### Task 3: Verify CancelOrderDialog accepts tokenStandard prop

The `asset-page-edition.tsx` passes `tokenStandard="ERC1155"` to `CancelOrderDialog`. This step ensures the prop exists.

**Files:**
- Read: `src/components/marketplace/cancel-order-dialog.tsx`
- Modify (if needed): same file

- [ ] **Step 1: Check the CancelOrderDialog props**

Run:
```bash
grep -n "tokenStandard\|CancelOrderDialogProps\|interface.*Props" \
  /Users/kalamaha/dev/medialane-dapp/src/components/marketplace/cancel-order-dialog.tsx | head -10
```

- [ ] **Step 2: Add tokenStandard prop if missing**

If `tokenStandard` is not in the props interface, add it as optional:

Find the props interface (e.g., `interface CancelOrderDialogProps`) and add:
```typescript
tokenStandard?: "ERC721" | "ERC1155";
```

Then ensure the prop is forwarded to the cancel call. Find where `cancelOrder` is called inside the component. If the signature accepts a token standard, pass it; if not, the prop can be accepted and ignored for now (the cancel call uses the orderHash to determine what it's cancelling on the backend).

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep "cancel-order-dialog"`
Expected: no errors

- [ ] **Step 4: Commit (only if a change was made)**

```bash
git add src/components/marketplace/cancel-order-dialog.tsx
git commit -m "fix: accept optional tokenStandard prop in CancelOrderDialog"
```
