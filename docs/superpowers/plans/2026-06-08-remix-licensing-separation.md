# Remix / Licensing Separation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring medialane-dapp to parity with medialane-io's separation of derivative-rights UX into permissionless **Remix** (`/create/remix`) and the **Licensing** deal (`/create/licensing`), gated by a shared `remix-policy`.

**Architecture:** Frontend-only restructure. The backend is shared and already supports every endpoint (`confirmSelfRemix` == io's `registerRemix`, same `/v1/remix-offers/self/confirm`). Port io's policy + licensing page (adapting auth: SIWS instead of Clerk), refactor the dapp's combined remix page to self-mint-only, add policy-gated asset-page CTAs, rename the portfolio inbox.

**Tech Stack:** Next.js App Router, React, TS, Tailwind, `@medialane/sdk`, SIWS auth (`useSiwsToken`), `useWallet`.

**Spec:** `docs/superpowers/specs/2026-06-08-remix-licensing-separation-design.md`
**Branch:** `feat/remix-licensing-separation` (created).

**Reference files in io (visual/UX source of truth):**
- `medialane-io/src/lib/remix-policy.ts`
- `medialane-io/src/app/create/licensing/[contract]/[tokenId]/page.tsx`
- `medialane-io/src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx` (CTA wiring)

**Auth-adaptation (io → dapp), applied throughout:**
| io | dapp |
|---|---|
| `useAuth().getToken()` (Clerk) | `useSiwsToken().getValidToken()` |
| `useSessionKey().walletAddress` | `useWallet().address` |
| `apiFetch(url, clerkToken, …)` | `authedFetch(url, siwsToken, …)` (already in use-remix-offers) |

No test runner — verification is `npx tsc --noEmit` + `npm run build` + browser checks.

---

### Task 1: Port `remix-policy.ts`

**Files:** Create `src/lib/remix-policy.ts`

- [ ] **Step 1: Write the file** (verbatim from io — pure logic, no auth)

```ts
// Single source for the remix/licensing rule. App-layer only — never enforced
// on-chain (the contracts stay permissionless; this only shapes the dapp frontend).
//
// Permissive by default: only an explicit `Derivatives: Not Allowed` declaration
// suppresses direct remix, and only for non-owners. The licensing deal flow is
// the consent override.

type Attribute = { trait_type?: string; value?: string };

/** The creator's self-declared derivatives term, or null if unset/absent. */
export function getDerivativesTerm(
  attributes: Attribute[] | null | undefined,
): "Allowed" | "Not Allowed" | null {
  const v = (Array.isArray(attributes) ? attributes : []).find(
    (a) => a.trait_type === "Derivatives",
  )?.value;
  return v === "Allowed" || v === "Not Allowed" ? v : null;
}

export interface RemixPolicyInput {
  /** parent asset declared `Derivatives: Not Allowed` */
  parentNoDerivatives: boolean;
  /** connected wallet owns the parent asset */
  viewerIsParentOwner: boolean;
  /** parent has a reachable Medialane counterparty who could grant a license
   *  (v1 approximation: parent lives in a service-backed collection). */
  dealAvailable: boolean;
}

export interface RemixPolicy extends RemixPolicyInput {
  /** show the direct, permissionless self-mint Remix action */
  canRemixDirect: boolean;
  /** show the optional "propose a license deal" action */
  showDealOption: boolean;
}

export function resolveRemixPolicy(input: RemixPolicyInput): RemixPolicy {
  const canRemixDirect = input.viewerIsParentOwner || !input.parentNoDerivatives;
  const showDealOption = input.dealAvailable && !input.viewerIsParentOwner;
  return { ...input, canRemixDirect, showDealOption };
}
```

- [ ] **Step 2:** `npx tsc --noEmit` — clean (baseline 2 errors only).
- [ ] **Step 3:** Commit: `git add src/lib/remix-policy.ts && git commit -m "feat: port remix-policy (remix vs licensing rule)"`

---

### Task 2: Port `create-form-primitives.tsx`

**Files:** Create `src/components/create/create-form-primitives.tsx`

- [ ] **Step 1: Write the file** (verbatim from io)

```tsx
import { cn } from "@/lib/utils";

/** Segmented two/three-option toggle used across the create flows. */
export function ToggleGroup({
  value, options, onChange,
}: { value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden w-full">
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "flex-1 px-3 py-2 text-sm transition-colors",
            i > 0 && "border-l border-border",
            value === opt
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-background hover:bg-muted text-muted-foreground",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/** Titled card section wrapper for the create forms. */
export function Section({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2:** `npx tsc --noEmit` clean. Commit: `"feat: port create-form-primitives (Section, ToggleGroup)"`

---

### Task 3: Rename `confirmSelfRemix` → `registerRemix`

**Files:** Modify `src/hooks/use-remix-offers.ts`

- [ ] **Step 1:** Rename the export. Change `export async function confirmSelfRemix(` to `export async function registerRemix(` (signature/body unchanged — same `/v1/remix-offers/self/confirm` endpoint, same `siwsToken` arg). Add a one-line doc comment above it: `/** Record a permissionless self-minted remix (provenance). */`
- [ ] **Step 2:** Update the single current caller in `src/app/create/remix/[contract]/[tokenId]/page.tsx` (handled in Task 5).
- [ ] **Step 3:** `npx tsc --noEmit` — expect ONE error: the old `confirmSelfRemix` import in create/remix is now unresolved (fixed in Task 5). Note it and proceed; do not commit until Task 5 resolves it.

---

### Task 4: New `/create/licensing/[contract]/[tokenId]` page

**Files:** Create `src/app/create/licensing/[contract]/[tokenId]/page.tsx`

This is io's licensing page with auth adapted to the dapp (SIWS + useWallet). The owner/`dealAvailable` guard redirects to the asset.

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useToken } from "@/hooks/use-tokens";
import { useCollection } from "@/hooks/use-collections";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { submitRemixOffer } from "@/hooks/use-remix-offers";
import { getListableTokens, getTokenBySymbol, getService } from "@medialane/sdk";
import { LICENSE_TYPES } from "@/types/ip";
import { resolveRemixPolicy, getDerivativesTerm } from "@/lib/remix-policy";
import { ipfsToHttp } from "@/lib/utils";
import { ToggleGroup, Section } from "@/components/create/create-form-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConnectWallet } from "@/components/ConnectWallet";
import { ChevronLeft, ChevronDown, Shield, DollarSign, Percent, HandCoins, Loader2, Check } from "lucide-react";

const TOKENS = getListableTokens();

export default function CreateLicensingPage() {
  const { contract, tokenId } = useParams<{ contract: string; tokenId: string }>();
  const router = useRouter();
  const { address: walletAddress, isConnected, isConnecting } = useWallet();
  const { getValidToken } = useSiwsToken();
  const { token, isLoading: tokenLoading } = useToken(contract, tokenId);
  const { collection: parentCollection } = useCollection(contract);

  const walletAddressLower = walletAddress?.toLowerCase() ?? null;
  const viewerIsOwner = !!(
    token && walletAddressLower &&
    (token.owner?.toLowerCase() === walletAddressLower ||
     token.balances?.some((b) => b.owner.toLowerCase() === walletAddressLower))
  );
  const originalName = token?.metadata?.name ?? `Token #${tokenId}`;
  const originalImage = token?.metadata?.image ? ipfsToHttp(token.metadata.image) : null;
  const originalAttributes = Array.isArray(token?.metadata?.attributes)
    ? (token!.metadata!.attributes as { trait_type?: string; value?: string }[])
    : [];

  const policy = resolveRemixPolicy({
    parentNoDerivatives: getDerivativesTerm(originalAttributes) === "Not Allowed",
    viewerIsParentOwner: viewerIsOwner,
    dealAvailable: !!getService(parentCollection?.service),
  });

  const [licenseType, setLicenseType] = useState("CC BY");
  const [commercial, setCommercial] = useState(false);
  const [derivatives, setDerivatives] = useState(true);
  const [royalty, setRoyalty] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string>(TOKENS[0]?.symbol ?? "STRK");
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLicenseChange = (value: string) => {
    setLicenseType(value);
    const preset = LICENSE_TYPES.find((l) => l.value === value);
    if (preset) {
      setCommercial(preset.commercialUse === "Yes");
      setDerivatives(preset.derivatives !== "Not Allowed");
    }
  };

  const handleSubmit = async () => {
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      setError("Enter a valid license fee");
      return;
    }
    const siwsToken = await getValidToken();
    setLoading(true);
    setError(null);
    try {
      const tokenInfo = getTokenBySymbol(currency);
      const decimals = tokenInfo?.decimals ?? 18;
      const rawPrice = BigInt(Math.round(parseFloat(price) * 10 ** decimals)).toString();
      await submitRemixOffer(
        {
          originalContract: contract,
          originalTokenId: tokenId,
          proposedPrice: rawPrice,
          proposedCurrency: tokenInfo?.address ?? "",
          licenseType,
          commercial,
          derivatives,
          royaltyPct: royalty ? parseInt(royalty) : undefined,
          message: message.trim() || undefined,
        },
        siwsToken,
      );
      setStep("success");
    } catch (err: unknown) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Failed to send license request");
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-24">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          {isConnecting ? (
            <><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Connecting your wallet…</p></>
          ) : (
            <>
              <h1 className="text-xl font-bold">Connect your wallet to request a license</h1>
              <ConnectWallet />
            </>
          )}
        </div>
      </div>
    );
  }

  if (tokenLoading) {
    return (
      <div className="container max-w-2xl mx-auto px-4 pt-14 pb-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
      </div>
    );
  }
  if (!token) {
    return (
      <div className="container max-w-2xl mx-auto px-4 py-24 text-center space-y-4">
        <p className="text-2xl font-bold">Asset not found</p>
        <Button asChild variant="outline"><Link href="/">Go home</Link></Button>
      </div>
    );
  }
  // You can't license your own work; licensing needs a reachable Medialane owner.
  if (viewerIsOwner || !policy.dealAvailable) {
    router.replace(`/asset/${contract}/${tokenId}`);
    return null;
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 pt-14 pb-12 space-y-6">
      <div className="space-y-3">
        <Link href={`/asset/${contract}/${tokenId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back to asset
        </Link>
        <div className="flex items-center gap-2 text-primary">
          <HandCoins className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Request a license</span>
        </div>
        <h1 className="text-3xl font-bold">License this asset</h1>
        <p className="text-muted-foreground max-w-xl">
          Propose license terms and a fee to the creator. If they accept, the licensed derivative is minted and listed for you.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
        {originalImage && (
          <Image src={originalImage} alt={originalName} width={48} height={48} className="rounded-lg object-cover" unoptimized />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{originalName}</p>
          <p className="text-xs text-muted-foreground truncate">{parentCollection?.name ?? contract.slice(0, 10) + "…"}</p>
        </div>
      </div>

      {step === "success" ? (
        <div className="rounded-xl border border-border p-8 text-center space-y-4">
          <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-semibold">License request sent</p>
          <p className="text-sm text-muted-foreground">The creator will review it. Track it under Portfolio → Licensing.</p>
          <Button asChild variant="outline"><Link href="/portfolio/licensing">View my requests</Link></Button>
        </div>
      ) : (
        <>
          <Section title="License Terms" icon={<Shield className="h-4 w-4" />}>
            <div className="space-y-1.5">
              <Label>License Type</Label>
              <Select value={licenseType} onValueChange={handleLicenseChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSE_TYPES.map((l) => <SelectItem key={l.value} value={l.value}>{l.value}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Commercial Use</Label>
                <ToggleGroup value={commercial ? "Yes" : "No"} options={["Yes", "No"]} onChange={(v) => setCommercial(v === "Yes")} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Derivatives</Label>
                <ToggleGroup value={derivatives ? "Allowed" : "Not Allowed"} options={["Allowed", "Not Allowed"]} onChange={(v) => setDerivatives(v === "Allowed")} />
              </div>
            </div>
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`} /> Royalty &amp; advanced
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Percent className="h-3.5 w-3.5" /> Royalty %</Label>
                  <Input type="number" min="0" max="50" step="1" placeholder="0" value={royalty} onChange={(e) => setRoyalty(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Percentage of future sales sent back to the creator (0–50%)</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Section>

          <Section title="License fee" icon={<DollarSign className="h-4 w-4" />}>
            <p className="text-xs text-muted-foreground -mt-1">The amount you&apos;re offering to pay the creator for this license.</p>
            <div className="flex gap-2">
              <Input type="number" min="0" step="any" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className="flex-1" />
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TOKENS.map((t) => <SelectItem key={t.symbol} value={t.symbol}>{t.symbol}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section title="Message (optional)" icon={<HandCoins className="h-4 w-4" />}>
            <Textarea placeholder="Add a note for the creator…" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </Section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            className="w-full h-12 rounded-[11px] bg-brand-purple text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <HandCoins className="h-5 w-5" />}
            Send license request
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2:** `npx tsc --noEmit` — clean for this file (Task 3's create/remix error may still show until Task 5).
- [ ] **Step 3:** Commit after Task 5 (they share the `registerRemix` rename context) or standalone if clean: `"feat: /create/licensing request-a-license page"`

---

### Task 5: Refactor `/create/remix` to permissionless self-mint only

**Files:** Modify `src/app/create/remix/[contract]/[tokenId]/page.tsx`

Remove the non-owner license-offer path entirely (it now lives in `/create/licensing`). The page self-mints a derivative into the connected user's own collection, for anyone allowed by policy (`canRemixDirect`). Switch its inline `ToggleGroup`/`Section` to the shared primitives, and `confirmSelfRemix` → `registerRemix`.

- [ ] **Step 1: Imports.** Replace the inline `ToggleGroup`/`Section` definitions (the two `function ToggleGroup` + `function Section` blocks, lines ~44–87) with an import:
```tsx
import { ToggleGroup, Section } from "@/components/create/create-form-primitives";
import { resolveRemixPolicy, getDerivativesTerm } from "@/lib/remix-policy";
```
Change `import { submitRemixOffer, confirmSelfRemix } from "@/hooks/use-remix-offers";` → `import { registerRemix } from "@/hooks/use-remix-offers";` (drop `submitRemixOffer`). Remove now-unused imports: `getTokenBySymbol` (was only for the offer path), `formatDisplayPrice` if unused, `DollarSign` if unused after the fee section is removed.

- [ ] **Step 2: Policy gate.** After computing `isOwner`, add:
```tsx
  const remixPolicy = resolveRemixPolicy({
    parentNoDerivatives: getDerivativesTerm(originalAttributes) === "Not Allowed",
    viewerIsParentOwner: isOwner,
    dealAvailable: true, // not used here; remix gate is canRemixDirect only
  });
```
Then, in the render, after the `!token` guard, redirect non-eligible viewers:
```tsx
  if (!remixPolicy.canRemixDirect) {
    router.replace(`/create/licensing/${contract}/${tokenId}`);
    return null;
  }
```
(A non-owner viewing a `Derivatives: Not Allowed` asset is sent to the licensing deal — their only path.)

- [ ] **Step 3: Drop the offer path.** Remove: `price`, `currency`, `message`, `offerLoading` state that is offer-only (`price`/`currency`/`message` are now unused — remove them and their setters); the entire `handleOfferSubmit` function; the `validate()` non-owner branch (`if (!isOwner && (!price ...))` line — remove it). `validate()` becomes:
```tsx
  const validate = (): string | null => {
    if (!name.trim()) return "Remix name is required";
    if (!collectionId) return "Select a collection";
    return null;
  };
```

- [ ] **Step 4: Collection section always shown.** Remove the `{isOwner && (` wrapper around the Collection `<Section>` (lines ~551–580) so every minter picks their own collection. (Keep the section; just un-gate it.)

- [ ] **Step 5: Remove the License Fee Offer `<Section>`** (the `{!isOwner && ( <Section title="License Fee Offer" …>` block, lines ~665–713) entirely — it was the offer UI.

- [ ] **Step 6: Submit + header copy.** The submit button always self-mints:
```tsx
            <div className="btn-border-animated p-[1px] rounded-xl">
              <button type="button" onClick={handleOwnerSubmit}
                className="w-full h-12 rounded-[11px] flex items-center justify-center gap-2 text-base font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-rose disabled:opacity-50">
                <GitBranch className="h-5 w-5" />
                Mint Remix
              </button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Two operations: IPFS metadata upload + on-chain mint. Gas is free.
            </p>
```
Header: replace the `{isOwner ? … : …}` ternaries (the eyebrow, `<h1>`, and `<p>` at lines ~461–475) with the single self-mint copy:
```tsx
          <div className="flex items-center gap-2 text-primary">
            <GitBranch className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Create Remix</span>
          </div>
          <h1 className="text-3xl font-bold">Mint a Remix</h1>
          <p className="text-muted-foreground max-w-xl">
            Mint a derivative work based on this asset. The parent attribution is embedded in the IPFS metadata.
          </p>
```
And the "What happens next" panel: drop the `isOwner ? … : …` and keep only the mint ol (lines ~800–814 → keep the owner branch list, remove the non-owner branch and the `{price && …}` line since there's no listing).

- [ ] **Step 7: `registerRemix` call.** In `runOwnerMint`, change `await confirmSelfRemix(` → `await registerRemix(` (args unchanged).

- [ ] **Step 8:** `npx tsc --noEmit` — now clean (Task 3's dangling import resolved). Remove any remaining unused vars tsc flags (e.g. `getService` is still used for `eligibleCollections`; keep it).

- [ ] **Step 9:** Commit Tasks 3+4+5 together:
```bash
git add src/hooks/use-remix-offers.ts "src/app/create/licensing/[contract]/[tokenId]/page.tsx" "src/app/create/remix/[contract]/[tokenId]/page.tsx"
git commit -m "feat: split remix (permissionless self-mint) from licensing (deal)"
```

---

### Task 6: Policy-gated asset-page CTAs (Remix + License this IP)

**Files:**
- Modify `src/app/asset/[contract]/[tokenId]/asset-marketplace-panel.tsx`
- Modify `src/app/asset/[contract]/[tokenId]/asset-page-standard.tsx`

- [ ] **Step 1: Panel props.** In `asset-marketplace-panel.tsx`, add to the props interface (near `onOpenRemix?`):
```tsx
  showDealOption?: boolean;
  onProposeDeal?: () => void;
```
Destructure them in the component signature alongside `onOpenRemix`.

- [ ] **Step 2: Render the License CTA.** Next to **each** `{remixEnabled && onOpenRemix ? (<ActionButton label="Remix" …/>) : …}` block (there are two — lines ~172 and ~218), add a sibling:
```tsx
{showDealOption && onProposeDeal ? (
  <ActionButton label="License this IP" icon={<HandCoins className="h-4 w-4" />} onClick={onProposeDeal} />
) : null}
```
Add `HandCoins` to the lucide-react import in this file.

- [ ] **Step 3: Wire policy in the page.** In `asset-page-standard.tsx`:
  - Add imports: `import { resolveRemixPolicy, getDerivativesTerm } from "@/lib/remix-policy";` and `import { getService } from "@medialane/sdk";` (if not already imported).
  - After `isOwner`/ownership is known, compute:
```tsx
  const remixPolicy = resolveRemixPolicy({
    parentNoDerivatives: getDerivativesTerm(token?.metadata?.attributes) === "Not Allowed",
    viewerIsParentOwner: isOwner,
    dealAvailable: !!getService(collection?.service),
  });
  const goToDeal = () => router.push(`/create/licensing/${contract}/${tokenId}`);
```
  - On the `<AssetMarketplacePanel … />`, change/confirm `remixEnabled={remixPolicy.canRemixDirect}` and add `showDealOption={remixPolicy.showDealOption}` + `onProposeDeal={goToDeal}`. (Keep the existing `onOpenRemix={handleAutoRemix}`.)

- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit: `"feat: asset-page License this IP CTA (policy-gated)"`

---

### Task 7: Rename portfolio inbox → `/portfolio/licensing` (+ redirect)

**Files:**
- Move `src/app/portfolio/remix-offers/page.tsx` → `src/app/portfolio/licensing/page.tsx`
- Create `src/app/portfolio/remix-offers/page.tsx` (redirect)
- Modify `src/app/portfolio/layout.tsx`, `src/lib/nav-commands.ts`

- [ ] **Step 1: Move + relabel.** `git mv src/app/portfolio/remix-offers/page.tsx src/app/portfolio/licensing/page.tsx`. In the moved file relabel user-facing copy: "Remix Requests" → "License Requests"; "My Remix Requests" → "My License Requests"; any page title "Remix Offers"/"Remixes" → "Licensing". (Keep the `useRemixOffers`/`RemixOffer`/`ApproveMintSheet` logic unchanged.)

- [ ] **Step 2: Redirect stub** at `src/app/portfolio/remix-offers/page.tsx`:
```tsx
import { redirect } from "next/navigation";
export default function RemixOffersRedirect() {
  redirect("/portfolio/licensing");
}
```

- [ ] **Step 3: Subnav.** In `portfolio/layout.tsx` line ~37 change:
```tsx
      { label: "Licensing",         href: "/portfolio/licensing", badge: { key: "remixes", variant: "primary" } },
```
In `nav-commands.ts` line ~82 change to:
```tsx
      { id: "portfolio-licensing", label: "Licensing", icon: Repeat2, href: "/portfolio/licensing", keywords: ["license", "licensing", "remix", "requests"] },
```

- [ ] **Step 4:** `npx tsc --noEmit` clean. Commit: `"feat: portfolio Licensing inbox (rename remix-offers + redirect)"`

---

### Task 8: Reframe approve-mint-sheet as "Grant license & mint"

**Files:** Modify `src/components/portfolio/approve-mint-sheet.tsx`

- [ ] **Step 1:** Relabel user-facing copy to the licensing framing (logic unchanged):
  - `SheetTitle` "Approve Remix" → "Grant license & mint".
  - Submit button "Mint & List for Buyer" → "Grant license & mint".
  - The intro/explainer line "Mint + listing in one transaction…" → "Grant the license: mint the derivative and list it for the requester. One transaction. Gas is sponsored."
  - Success: keep "Remix minted!" → change to "License granted!"; description "The buyer will see Complete Purchase in their portfolio." stays.
- [ ] **Step 2:** `npx tsc --noEmit` clean. Commit: `"feat: reframe approval as Grant license & mint"`

---

### Task 9: Full build verification

- [ ] **Step 1:** `npx tsc --noEmit` → clean (only the 2 pre-existing `use-register-user` baseline errors).
- [ ] **Step 2:** `npm run build` → compiles, no errors (read full output, no grep filtering).
- [ ] **Step 3: Browser smoke (record results):**
  1. Non-owner on an **open-license** asset (no `Derivatives: Not Allowed`) in a service-backed collection → sees **both** "Remix" and "License this IP" CTAs.
  2. Owner of an asset → sees **only** "Remix" (no License this IP).
  3. Non-owner on a `Derivatives: Not Allowed` asset → sees **only** "License this IP"; navigating to `/create/remix/…` redirects to `/create/licensing/…`.
  4. Submit a license request → success panel → `/portfolio/licensing` shows it under "My License Requests".
  5. Old `/portfolio/remix-offers` redirects to `/portfolio/licensing`.
  6. Creator approves a request via "Grant license & mint" → still mints + lists.
  7. Remix self-mint (owner) → mints into the chosen collection, lands on the new asset.
- [ ] **Step 4:** Confirm both gates passed before declaring complete.

---

## Self-Review

- **Spec coverage:** Tasks 1–8 map to spec items 1–9 (policy, primitives, registerRemix, create/licensing, remix refactor, asset CTAs, portfolio rename+redirect, approve-sheet, nav). Task 9 = spec Verification.
- **Placeholders:** none — full code for new files; surgical line-referenced edits for modifications.
- **Type consistency:** `registerRemix` (Task 3) used in Task 5; `resolveRemixPolicy`/`getDerivativesTerm` (Task 1) used in Tasks 4/5/6; `ToggleGroup`/`Section` (Task 2) used in Tasks 4/5; `showDealOption`/`onProposeDeal` props (Task 6 panel) match the page wiring.
