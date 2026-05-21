# Gated Content & Collection Slug Routing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the exclusive/holder-gated content system and vanity slug routing from medialane-io to medialane-dapp, adapting auth from Clerk → `useUnifiedWallet`.

**Architecture:** The gated content system has three layers: a hook that calls the backend to verify the connected wallet holds a token, a hero banner shown on the collection page to all visitors, and an "Exclusive" tab revealed only to verified holders. Slug routing is a single server-side redirect page. The settings page gains two new sections: exclusive content management and slug claiming.

**Tech Stack:** Next.js App Router, SWR, Tailwind CSS, `@medialane/sdk`, `useUnifiedWallet`, `useCollectionProfile` (already in dapp)

---

### Task 1: Add CSS — `btn-border-animated` and `card-exclusive-wrapper`

**Files:**
- Modify: `src/app/globals.css` (add after existing `.glass` block)

- [ ] **Step 1: Add the two classes to globals.css**

Open `src/app/globals.css` and append before the final `}` of the file (or after the last utility class block):

```css
/* Animated gradient border used on exclusive-content cards and buy CTAs */
.btn-border-animated {
  background: linear-gradient(270deg, #2563eb, #9333ea, #f43f5e, #ea580c, #2563eb);
  background-size: 300% 300%;
  animation: border-flow 5s ease infinite;
}

/* Wrapper that adds a 2px animated gradient border around a card */
.card-exclusive-wrapper {
  padding: 2px;
  border-radius: calc(var(--radius) * 1.25 + 2px);
}
```

Verify `border-flow` keyframe already exists in the file:
```bash
grep -n "border-flow" src/app/globals.css
```
Expected output: a line showing `@keyframes border-flow`. If missing, add:
```css
@keyframes border-flow {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/app/globals.css
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add btn-border-animated and card-exclusive-wrapper CSS"
```

---

### Task 2: Create `use-gated-content` hook

**Files:**
- Create: `src/hooks/use-gated-content.ts`

The io version uses Clerk `isSignedIn` / `getToken`. The dapp uses `useUnifiedWallet`. Auth is adapted: pass the wallet address as a query param so the backend can verify token ownership on-chain.

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/use-gated-content.ts
"use client";

import useSWR from "swr";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

export interface GatedContent {
  title: string | null;
  url: string;
  type: string | null;
}

export type GatedContentState =
  | { status: "not_connected" }
  | { status: "loading" }
  | { status: "not_holder" }
  | { status: "unlocked"; content: GatedContent }
  | { status: "error" };

export function useGatedContent(contract: string | undefined): GatedContentState {
  const { address, isConnected } = useUnifiedWallet();

  const { data, error, isLoading } = useSWR<GatedContent | "not_holder">(
    contract && isConnected && address ? ["gated-content", contract, address] : null,
    async () => {
      const url = new URL(
        `${MEDIALANE_BACKEND_URL}/v1/collections/${contract}/gated-content`
      );
      url.searchParams.set("address", address!);
      const res = await fetch(url.toString(), {
        headers: { "x-api-key": MEDIALANE_API_KEY },
      });
      if (res.status === 403) return "not_holder";
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  if (!isConnected || !address) return { status: "not_connected" };
  if (isLoading) return { status: "loading" };
  if (error) return { status: "error" };
  if (data === "not_holder" || data === undefined) return { status: "not_holder" };
  return { status: "unlocked", content: data };
}
```

- [ ] **Step 2: Verify `MEDIALANE_BACKEND_URL` and `MEDIALANE_API_KEY` are exported from constants**

```bash
grep -n "MEDIALANE_BACKEND_URL\|MEDIALANE_API_KEY" /Users/kalamaha/dev/medialane-dapp/src/lib/constants.ts | head -5
```

Expected: both constants are defined and exported. If either is missing, add them:
```typescript
export const MEDIALANE_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL ?? "http://localhost:3001";
export const MEDIALANE_API_KEY =
  process.env.NEXT_PUBLIC_MEDIALANE_API_KEY ?? "";
```

- [ ] **Step 3: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/hooks/use-gated-content.ts src/lib/constants.ts
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add use-gated-content hook (wallet-based auth)"
```

---

### Task 3: Create `GatedContentHero` component

**Files:**
- Create: `src/components/collection/gated-content-hero.tsx`

This component is identical to io — no Clerk dependency. Copied verbatim.

- [ ] **Step 1: Create the component**

```typescript
// src/components/collection/gated-content-hero.tsx
"use client";

import { Lock, Unlock, Sparkles, Play, Music, Radio, FileText, Link2 } from "lucide-react";
import type { GatedContentState } from "@/hooks/use-gated-content";
import type { ApiCollectionProfile } from "@medialane/sdk";

const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  VIDEO: Play,
  AUDIO: Music,
  STREAM: Radio,
  DOCUMENT: FileText,
  LINK: Link2,
};

interface GatedContentHeroProps {
  profile: ApiCollectionProfile | null;
  gatedState: GatedContentState;
  onViewExclusive: () => void;
}

export function GatedContentHero({ profile, gatedState, onViewExclusive }: GatedContentHeroProps) {
  if (!profile?.hasGatedContent) return null;

  const title = profile.gatedContentTitle ?? "Exclusive content for holders";

  if (gatedState.status === "unlocked") {
    const { content } = gatedState;
    const Icon = content.type ? (CONTENT_TYPE_ICONS[content.type] ?? Link2) : Link2;
    return (
      <div className="mx-4 sm:mx-6 mt-3">
        <button
          onClick={onViewExclusive}
          className="w-full flex items-center gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/15 px-5 py-4 transition-colors text-left group"
        >
          <div className="h-11 w-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-500">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none">
              ✓ You&apos;re a holder — unlocked
            </p>
            <p className="text-sm font-bold text-foreground leading-snug mt-1 truncate">
              {content.title ?? title}
            </p>
          </div>
          <Unlock className="h-4 w-4 text-emerald-500 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 sm:mx-6 mt-3">
      <div className="card-exclusive-wrapper btn-border-animated">
        <button
          onClick={onViewExclusive}
          className="w-full flex items-center gap-4 rounded-[calc(var(--radius)*1.25)] bg-card hover:bg-muted/60 px-5 py-4 transition-colors text-left group"
        >
          <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-widest leading-none mb-1"
              style={{
                background: "linear-gradient(90deg, #2563eb, #9333ea, #f43f5e)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Holder exclusive
            </p>
            <p className="text-sm font-bold text-foreground leading-snug truncate">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Own a token from this collection to unlock</p>
          </div>
          <Sparkles className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify `ApiCollectionProfile` has `hasGatedContent` and `gatedContentTitle`**

```bash
grep -n "hasGatedContent\|gatedContentTitle" /Users/kalamaha/dev/medialane-dapp/node_modules/@medialane/sdk/dist/index.d.ts 2>/dev/null | head -5
```

If not found, check via the SDK types used in io (they share the same SDK version). If missing, cast with `(profile as any)?.hasGatedContent`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/collection/gated-content-hero.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add GatedContentHero component"
```

---

### Task 4: Create `OwnerSetupPanel` component

**Files:**
- Create: `src/components/collection/owner-setup-panel.tsx`

Identical to io — no Clerk dependency. Copied verbatim.

- [ ] **Step 1: Create the component**

```typescript
// src/components/collection/owner-setup-panel.tsx
"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiCollectionProfile } from "@medialane/sdk";

interface SetupItem {
  label: string;
  done: boolean;
}

interface OwnerSetupPanelProps {
  contract: string;
  profile: ApiCollectionProfile | null;
}

export function OwnerSetupPanel({ contract, profile }: OwnerSetupPanelProps) {
  const items: SetupItem[] = [
    { label: "Display name",      done: !!profile?.displayName },
    { label: "Description",       done: !!profile?.description },
    { label: "Cover image",       done: !!profile?.image },
    { label: "Banner image",      done: !!profile?.bannerImage },
    { label: "Social links",      done: !!(profile?.twitterUrl || profile?.discordUrl || profile?.websiteUrl) },
    { label: "Exclusive content", done: !!(profile as any)?.hasGatedContent },
  ];

  const doneCount = items.filter((i) => i.done).length;

  if (doneCount === items.length) return null;

  return (
    <div className="mx-4 sm:mx-6 mt-3 rounded-2xl border border-border bg-card/80 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Set up your collection</p>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {doneCount}/{items.length} complete
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full btn-border-animated transition-all duration-500"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {items.map(({ label, done }) => (
          <div key={label} className="flex items-center gap-1.5">
            {done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            )}
            <span className={cn("text-xs", done ? "text-muted-foreground line-through" : "text-foreground")}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <Link
        href={`/portfolio/collections/${contract}/settings`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
      >
        <Sparkles className="h-3 w-3" />
        Complete your collection profile
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/collection/owner-setup-panel.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add OwnerSetupPanel component"
```

---

### Task 5: Wire gated content into the collection page

**Files:**
- Modify: `src/app/collections/[contract]/collection-page-client.tsx`

The dapp's collection page currently has no profile, gated content, or owner setup panel. We need to:
1. Import and call `useCollectionProfile` and `useGatedContent`
2. Add `activeTab` state so the hero button can jump to the "Exclusive" tab
3. Add `GatedContentHero` and `OwnerSetupPanel` in the meta section
4. Add the "Exclusive" tab and `GatedContentPanel` inside the Tabs component
5. Convert `defaultValue="items"` to `value={activeTab}` controlled tabs

- [ ] **Step 1: Add imports at the top of the file**

Add these imports after the existing import block (around line 30):

```typescript
import { useCollectionProfile } from "@/hooks/use-profiles";
import { useGatedContent, type GatedContentState } from "@/hooks/use-gated-content";
import { GatedContentHero } from "@/components/collection/gated-content-hero";
import { OwnerSetupPanel } from "@/components/collection/owner-setup-panel";
import { Lock, Loader2 as GatedLoader, Unlock, Sparkles as GatedSparkles, ShoppingBag, Play, Music, Radio, FileText, Link2 } from "lucide-react";
```

Note: if `Loader2`, `Unlock`, `Sparkles`, etc. are already imported, just add `Lock`, `ShoppingBag`, `Play`, `Music`, `Radio`, `FileText`, `Link2` to the existing lucide import.

- [ ] **Step 2: Add state and hooks inside `CollectionPageClient`**

Inside the `CollectionPageClient` function, after the existing state declarations (around line 237), add:

```typescript
const [activeTab, setActiveTab] = useState("items");
const { profile } = useCollectionProfile(contract);
const gatedState = useGatedContent(
  (profile as any)?.hasGatedContent ? contract : undefined
);
```

- [ ] **Step 3: Add GatedContentHero and OwnerSetupPanel after the meta section**

Find the closing `</div>` of the meta section (the block ending with `<ReportDialog ... />`). After that closing div and before the Tabs section, insert:

```tsx
{/* Gated content hero — shown to all visitors when collection has exclusive content */}
{!colLoading && collection && profile && (
  <GatedContentHero
    profile={profile as any}
    gatedState={gatedState}
    onViewExclusive={() => setActiveTab("exclusive")}
  />
)}

{/* Owner setup checklist — shown only to the collection owner */}
{!colLoading && collection && walletAddress &&
  collection.owner?.toLowerCase() === walletAddress.toLowerCase() && (
  <OwnerSetupPanel
    contract={contract}
    profile={profile as any ?? null}
  />
)}
```

- [ ] **Step 4: Convert Tabs to controlled and add Exclusive tab**

Replace `<Tabs defaultValue="items">` with `<Tabs value={activeTab} onValueChange={setActiveTab}>`.

Inside `<TabsList>`, after the existing three TabsTriggers, add:

```tsx
{(profile as any)?.hasGatedContent && (
  <TabsTrigger value="exclusive" className="flex-1 sm:flex-none gap-1.5">
    <Lock className="h-3.5 w-3.5" />
    Exclusive
  </TabsTrigger>
)}
```

After the last `</TabsContent>` (offers tab), add:

```tsx
{(profile as any)?.hasGatedContent && (
  <TabsContent value="exclusive" className="mt-4">
    <GatedContentPanel state={gatedState} contract={contract} />
  </TabsContent>
)}
```

- [ ] **Step 5: Add `GatedContentPanel` component at the bottom of the file**

After the `EmptyState` function (around line 565), add:

```typescript
const CONTENT_TYPE_CONFIG: Record<string, { icon: React.ReactNode; cta: string }> = {
  VIDEO:    { icon: <Play className="h-5 w-5" />,     cta: "Watch now" },
  AUDIO:    { icon: <Music className="h-5 w-5" />,    cta: "Listen now" },
  STREAM:   { icon: <Radio className="h-5 w-5" />,    cta: "Watch live" },
  DOCUMENT: { icon: <FileText className="h-5 w-5" />, cta: "Open document" },
  LINK:     { icon: <Link2 className="h-5 w-5" />,    cta: "Access content" },
};

function GatedContentPanel({ state, contract }: { state: GatedContentState; contract: string }) {
  if (state.status === "not_connected") {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-center max-w-sm mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-base font-semibold">Connect wallet to unlock</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            This collection has exclusive content for holders. Connect your wallet so we can verify.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="py-16 flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Verifying your holdings…</p>
      </div>
    );
  }

  if (state.status === "not_holder") {
    return (
      <div className="py-16 flex flex-col items-center gap-5 text-center max-w-sm mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-base font-semibold">Holders only</p>
          <p className="text-sm text-muted-foreground mt-1">
            You need at least one token from this collection to access exclusive content.
          </p>
        </div>
        <a
          href="#listings"
          onClick={(e) => {
            e.preventDefault();
            document.querySelector('[data-value="listings"]')?.dispatchEvent(
              new MouseEvent("click", { bubbles: true })
            );
          }}
          className="inline-flex items-center gap-2 bg-foreground text-background hover:opacity-90 font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
        >
          <ShoppingBag className="h-4 w-4" />
          Browse listings
        </a>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center max-w-sm mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium">Couldn&apos;t verify your holdings</p>
        <p className="text-xs text-muted-foreground">Try refreshing the page.</p>
      </div>
    );
  }

  const { content } = state;
  const typeConfig = content.type
    ? (CONTENT_TYPE_CONFIG[content.type] ?? CONTENT_TYPE_CONFIG.LINK)
    : CONTENT_TYPE_CONFIG.LINK;

  return (
    <div className="py-8 flex flex-col items-center gap-6 text-center max-w-md mx-auto">
      <div className="relative">
        <div className="h-20 w-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
          <Unlock className="h-10 w-10" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xl font-bold">You&apos;re in</p>
        {content.title && (
          <p className="text-sm text-muted-foreground">{content.title}</p>
        )}
      </div>

      <a
        href={content.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm active:scale-[0.98]"
      >
        {typeConfig.icon}
        {typeConfig.cta}
      </a>

      <p className="text-xs text-muted-foreground/60">
        This link is exclusive to holders of this collection.
      </p>
    </div>
  );
}
```

Note: `Loader2`, `Unlock`, `Sparkles`, `ShoppingBag` must be in scope — verify they were added in Step 1 imports.

- [ ] **Step 6: Build check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors. The most likely issue is `ApiCollectionProfile` missing `hasGatedContent` — cast with `(profile as any)?.hasGatedContent` wherever needed.

- [ ] **Step 7: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/app/collections/[contract]/collection-page-client.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: wire gated content into collection page"
```

---

### Task 6: Add exclusive content + slug sections to settings page

**Files:**
- Modify: `src/app/portfolio/collections/[contract]/settings/page.tsx`

The existing dapp settings page has Identity, Media, and Links sections. We're adding: Exclusive Content section, Slug Claim section, and updating the save payload to include gated content fields.

- [ ] **Step 1: Add imports**

Add these to the existing imports at the top:

```typescript
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Lock, Gem, CheckCircle2, ExternalLink,
  Video, Music, Radio, FileText, Link2,
} from "lucide-react";
```

- [ ] **Step 2: Add constants**

After the imports, add:

```typescript
const CONTENT_TYPES = [
  { value: "VIDEO",    label: "Video",       icon: Video,    hint: "YouTube, Vimeo, or any video URL" },
  { value: "AUDIO",    label: "Audio",        icon: Music,    hint: "Spotify, SoundCloud, MP3 link…" },
  { value: "STREAM",   label: "Live stream",  icon: Radio,    hint: "Twitch, YouTube Live, etc." },
  { value: "DOCUMENT", label: "Document",     icon: FileText, hint: "PDF, Notion, Google Doc…" },
  { value: "LINK",     label: "Link",         icon: Link2,    hint: "Any URL" },
];
```

- [ ] **Step 3: Expand the `form` state**

Change the existing `form` useState to include gated content fields:

```typescript
const [form, setForm] = useState({
  displayName: "", description: "", image: "", bannerImage: "",
  websiteUrl: "", twitterUrl: "", discordUrl: "", telegramUrl: "",
  gatedEnabled: false,
  gatedContentTitle: "",
  gatedContentUrl: "",
  gatedContentType: "",
});
```

- [ ] **Step 4: Update the `useEffect` that populates `form` from `profile`**

Replace the existing `useEffect` body with:

```typescript
useEffect(() => {
  if (profile) {
    setForm(f => ({
      ...f,
      displayName: profile.displayName ?? "",
      description: profile.description ?? "",
      image: profile.image ?? "",
      bannerImage: profile.bannerImage ?? "",
      websiteUrl: profile.websiteUrl ?? "",
      twitterUrl: profile.twitterUrl ?? "",
      discordUrl: profile.discordUrl ?? "",
      telegramUrl: profile.telegramUrl ?? "",
      gatedEnabled: !!(profile as any).hasGatedContent,
      gatedContentTitle: (profile as any).gatedContentTitle ?? "",
    }));
  }
}, [profile]);
```

- [ ] **Step 5: Update `handleSave` to send gated content fields**

Replace the existing `handleSave` function:

```typescript
async function handleSave() {
  setSaving(true);
  try {
    const payload = {
      displayName: form.displayName || null,
      description: form.description || null,
      image: form.image || null,
      bannerImage: form.bannerImage || null,
      websiteUrl: form.websiteUrl || null,
      twitterUrl: form.twitterUrl || null,
      discordUrl: form.discordUrl || null,
      telegramUrl: form.telegramUrl || null,
      gatedContentTitle: form.gatedEnabled ? (form.gatedContentTitle || null) : null,
      gatedContentUrl: form.gatedEnabled ? (form.gatedContentUrl || null) : null,
      gatedContentType: form.gatedEnabled ? (form.gatedContentType || null) : null,
    };
    await getMedialaneClient().api.updateCollectionProfile(contract, payload, "");
    await mutate();
    toast.success("Collection profile updated");
  } catch {
    toast.error("Failed to save changes");
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 6: Add Exclusive Content section to the JSX**

After the Links section `</div>` and before the save `<Button>`, insert:

```tsx
{/* Exclusive content */}
<div className="space-y-4">
  <div>
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <Lock className="h-4 w-4 text-muted-foreground" />
      Exclusive content
    </h3>
    <p className="text-xs text-muted-foreground mt-0.5">
      Reward your holders with exclusive access — video, audio, documents, or any link.
      Only verified token holders can access this content.
    </p>
  </div>
  <div className="border-t border-border pt-4 space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Enable exclusive content</p>
        <p className="text-xs text-muted-foreground">Adds a locked tab visible only to token holders</p>
      </div>
      <Switch
        checked={form.gatedEnabled}
        onCheckedChange={(checked) => setForm(f => ({ ...f, gatedEnabled: checked }))}
      />
    </div>

    {form.gatedEnabled && (
      <>
        <div className="space-y-1.5">
          <Label htmlFor="gatedContentTitle">Content title</Label>
          <Input
            id="gatedContentTitle"
            placeholder="e.g. Behind-the-scenes footage"
            value={form.gatedContentTitle}
            onChange={(e) => setForm(f => ({ ...f, gatedContentTitle: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gatedContentUrl">Content URL</Label>
          <Input
            id="gatedContentUrl"
            placeholder="https://…"
            value={form.gatedContentUrl}
            onChange={(e) => setForm(f => ({ ...f, gatedContentUrl: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Only holders will see this URL. Use a private or unlisted link.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Content type</Label>
          <Select
            value={form.gatedContentType}
            onValueChange={(v) => setForm(f => ({ ...f, gatedContentType: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </>
    )}
  </div>
</div>
```

- [ ] **Step 7: Add Slug Claim section**

After the Exclusive content section and before the Save button, add:

```tsx
{/* Collection URL slug */}
<div className="space-y-4">
  <div>
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
      <Gem className="h-4 w-4 text-muted-foreground" />
      Collection URL
    </h3>
    <p className="text-xs text-muted-foreground mt-0.5">
      Claim a vanity URL — medialane.io/collection/your-name
    </p>
  </div>
  <CollectionSlugClaimSection contract={contract} profile={profile} />
</div>
```

- [ ] **Step 8: Add `CollectionSlugClaimSection` component inside the file**

Add this component **above** `export default function CollectionSettingsPage`:

```typescript
function CollectionSlugClaimSection({
  contract,
  profile,
}: {
  contract: string;
  profile: { slug?: string | null } | null;
}) {
  const [slugInput, setSlugInput] = useState("");
  const [checkState, setCheckState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [checkReason, setCheckReason] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleCheck = async () => {
    const slug = slugInput.toLowerCase().trim();
    if (!slug) return;
    setCheckState("checking");
    setCheckReason(null);
    try {
      const result = await getMedialaneClient().api.checkCollectionSlugAvailability(slug);
      setCheckState(result.available ? "available" : "taken");
      if (!result.available) setCheckReason(result.reason ?? "That slug is not available.");
    } catch {
      setCheckState("invalid");
      setCheckReason("Unable to check availability. Try again.");
    }
  };

  const handleSubmit = async () => {
    const slug = slugInput.toLowerCase().trim();
    if (!slug || checkState !== "available") return;
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      await getMedialaneClient().api.submitCollectionSlugClaim(contract, slug, "");
      setSubmitState("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit claim.";
      setSubmitError(msg);
      setSubmitState("error");
    }
  };

  if (profile?.slug) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">Active URL</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-600 border-emerald-500/30">
            Active
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground font-mono">
          medialane.io/collection/{profile.slug}
        </p>
      </div>
    );
  }

  if (submitState === "done") {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Claim submitted</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-500/30">
            Pending review
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Your claim for{" "}
          <span className="font-mono text-foreground">medialane.io/collection/{slugInput}</span>{" "}
          is under review.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            medialane.io/collection/
          </span>
          <input
            type="text"
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50 min-w-0"
            placeholder="your-name"
            value={slugInput}
            onChange={(e) => {
              setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
              setCheckState("idle");
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCheck(); }}
            maxLength={20}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={!slugInput.trim() || checkState === "checking"}
          className="shrink-0"
        >
          {checkState === "checking" ? "Checking…" : "Check"}
        </Button>
      </div>

      {checkState === "available" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-600 font-medium truncate">
            ✓ Available — <span className="font-mono">medialane.io/collection/{slugInput}</span>
          </p>
          <Button size="sm" onClick={handleSubmit} disabled={submitState === "submitting"} className="shrink-0">
            {submitState === "submitting" ? "Claiming…" : "Claim this URL"}
          </Button>
        </div>
      )}

      {(checkState === "taken" || checkState === "invalid") && (
        <p className="text-xs text-destructive">{checkReason ?? "That slug is not available."}</p>
      )}

      {submitState === "error" && (
        <p className="text-xs text-destructive">{submitError}</p>
      )}

      <p className="text-xs text-muted-foreground px-1 pb-3">
        3–20 characters, lowercase letters, numbers, underscores or hyphens. Claims are reviewed before going live.
      </p>
    </div>
  );
}
```

- [ ] **Step 9: Build check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -30
```

Fix any type errors — the most common will be `profile` type not matching `{ slug?: string | null }`. Cast with `profile as any` where needed.

- [ ] **Step 10: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add "src/app/portfolio/collections/[contract]/settings/page.tsx"
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add exclusive content and slug claim to collection settings"
```

---

### Task 7: Add vanity slug route `/collection/[slug]`

**Files:**
- Create: `src/app/collection/[slug]/page.tsx`

This is a server-side redirect. No client code needed.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "/Users/kalamaha/dev/medialane-dapp/src/app/collection/[slug]"
```

```typescript
// src/app/collection/[slug]/page.tsx
import { redirect, notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CollectionSlugPage({ params }: Props) {
  const { slug } = await params;

  const backendUrl = process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL ?? "http://localhost:3001";
  const apiKey = process.env.NEXT_PUBLIC_MEDIALANE_API_KEY ?? "";

  let res: Response;
  try {
    res = await fetch(
      `${backendUrl}/v1/collections/by-slug/${encodeURIComponent(slug.toLowerCase().trim())}`,
      { headers: { "x-api-key": apiKey }, cache: "no-store" }
    );
  } catch {
    notFound();
  }

  if (!res.ok) notFound();

  const body = await res.json();
  const contractAddress = body?.data?.contractAddress;
  if (!contractAddress) notFound();

  redirect(`/collections/${contractAddress}`);
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit and push**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add "src/app/collection/[slug]/page.tsx"
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add /collection/[slug] vanity routing"
git -C /Users/kalamaha/dev/medialane-dapp push
```

---

## Self-Review Checklist

- [x] CSS classes for animated border added (Task 1)
- [x] `useGatedContent` adapted for wallet auth instead of Clerk (Task 2)
- [x] `GatedContentHero` renders locked/unlocked states with animated border (Task 3)
- [x] `OwnerSetupPanel` includes "Exclusive content" checklist item (Task 4)
- [x] Collection page wires profile, gatedState, hero, panel, Exclusive tab (Task 5)
- [x] Settings page saves gated content fields and slug claim (Task 6)
- [x] Vanity slug redirect route (Task 7)
- [x] No Clerk imports anywhere in this plan — all auth via `useUnifiedWallet`
- [x] `(profile as any)` cast used for `hasGatedContent` / `gatedContentTitle` where SDK types may not yet include them
