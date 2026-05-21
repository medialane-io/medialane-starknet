# Dapp Visual Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port all utility CSS classes from medialane-io to medialane-dapp, and restructure the sidebar so Collections/Creators/Activity live at the top level instead of inside a collapsible Explore sub-menu.

**Architecture:** Task 1 appends ~200 lines of utility CSS (scrollbars, glass, gradient-text, aurora blobs, animations, btn-border-animated, etc.) to the end of `globals.css`. Task 2 removes the `CollapsibleNavItem` component and its EXPLORE_SUB constant from the sidebar, replacing them with three flat `SidebarMenuItem` entries for Collections, Creators, and Activity; Docs moves from its own `SidebarGroup` into the utilities group.

**Tech Stack:** Tailwind CSS, shadcn/ui Sidebar, Next.js 15 App Router

---

### Task 1: Port utility CSS classes

**Files:**
- Modify: `src/app/globals.css` (currently 92 lines, append after line 92)

- [ ] **Step 1: Append utility classes to globals.css**

Open `src/app/globals.css` and add the following after the closing `}` of the last `@layer base` block (after line 92):

```css
/* Scrollbars */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 4px; }
.scrollbar-none { scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-hide { scrollbar-width: none; }
.scrollbar-hide::-webkit-scrollbar { display: none; }

/* Glass */
.glass {
  background: rgba(10, 14, 30, 0.60);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.glass-light {
  background: rgba(255, 255, 255, 0.80);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

/* Typography gradients */
.gradient-text {
  background: linear-gradient(135deg, #a855f7 0%, #6366f1 40%, #2563eb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.gradient-text-warm {
  background: linear-gradient(135deg, #f43f5e 0%, #ea580c 60%, #f59e0b 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.gradient-text-gold {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #ea580c 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Price */
.price-value {
  color: hsl(var(--price));
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* Section label */
.section-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

/* Pill badge */
.pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 9999px;
  border: 1px solid hsl(var(--primary) / 0.25);
  background: hsl(var(--primary) / 0.08);
  padding: 0.25rem 0.875rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(var(--primary));
}

/* Aurora blobs */
.aurora-purple { position: absolute; border-radius: 9999px; background: #9333ea; filter: blur(100px); opacity: 0.07; }
.aurora-blue   { position: absolute; border-radius: 9999px; background: #2563eb; filter: blur(120px); opacity: 0.06; }
.aurora-rose   { position: absolute; border-radius: 9999px; background: #f43f5e; filter: blur(100px); opacity: 0.05; }
.aurora-orange { position: absolute; border-radius: 9999px; background: #ea580c; filter: blur(110px); opacity: 0.04; }

.dark .aurora-purple { opacity: 0.15; }
.dark .aurora-blue   { opacity: 0.11; }
.dark .aurora-rose   { opacity: 0.09; }
.dark .aurora-orange { opacity: 0.07; }

/* Card base */
.card-base {
  border-radius: calc(var(--radius) * 1.25);
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  overflow: hidden;
  will-change: transform;
}

/* Bento cell */
.bento-cell {
  border-radius: calc(var(--radius) * 1.25);
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  overflow: hidden;
  position: relative;
}

/* Background grid */
.bg-grid {
  background-image:
    linear-gradient(hsl(var(--border) / 0.4) 1px, transparent 1px),
    linear-gradient(90deg, hsl(var(--border) / 0.4) 1px, transparent 1px);
  background-size: 48px 48px;
}

/* Snap scroll */
.snap-x-mandatory { scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
.snap-start { scroll-snap-align: start; }

/* Animations */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
@keyframes blob-pulse {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.07; }
  50% { transform: scale(1.15) rotate(10deg); opacity: 0.14; }
}
@keyframes blob-pulse-slow {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.05; }
  50% { transform: scale(1.2) rotate(-8deg); opacity: 0.11; }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes pulse-glow {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}
@keyframes spin-slow { to { transform: rotate(360deg); } }
@keyframes digit-in {
  from { transform: translateY(-14px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes scroll-strip {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
@keyframes kenburns {
  0%   { transform: scale(1.0) translate(0%, 0%); }
  100% { transform: scale(1.08) translate(-1.5%, -1%); }
}

.animate-float      { animation: float 5s ease-in-out infinite; }
.animate-blob       { animation: blob-pulse 7s ease-in-out infinite; }
.animate-blob-slow  { animation: blob-pulse-slow 9s ease-in-out infinite 2s; }
.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
.animate-spin-slow  { animation: spin-slow 24s linear infinite; }
.animate-sparkle    { animation: pulse-glow 2.5s ease-in-out infinite; }
.animate-kenburns {
  animation: kenburns 8s ease-in-out infinite alternate;
  transform-origin: center center;
}

@media (prefers-reduced-motion: reduce) {
  .animate-float,
  .animate-blob,
  .animate-blob-slow,
  .animate-pulse-glow,
  .animate-spin-slow,
  .animate-sparkle,
  .animate-kenburns {
    animation: none;
  }
}

/* Hide browser number input spinners */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}

/* Animated gradient border for marketplace action buttons */
@keyframes border-flow {
  0%, 100% { background-position: 0% 50%; }
  50%       { background-position: 100% 50%; }
}
.btn-border-animated {
  background: linear-gradient(270deg, #2563eb, #9333ea, #f43f5e, #ea580c, #2563eb);
  background-size: 300% 300%;
  animation: border-flow 5s ease infinite;
}
```

- [ ] **Step 2: Verify the file now has ~300 lines**

Run: `wc -l src/app/globals.css`
Expected: approximately 300 lines

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: port all utility CSS classes from medialane-io"
```

---

### Task 2: Flatten sidebar navigation

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`

The current sidebar has a collapsible "Explore" item containing Collections/Creators/Activity. These should be flat top-level nav items. Docs should move from its own `SidebarGroup` into the utilities group at the bottom.

- [ ] **Step 1: Replace the imports block**

In `src/components/layout/app-sidebar.tsx`, replace the imports:

```typescript
// old
import {
  Telescope, Compass, Briefcase, Zap, Activity,
  LayoutGrid, Users, Search, Sun, Moon, ShoppingBag,
  BookOpen, ChevronRight,
} from "lucide-react";
```

with:

```typescript
import {
  Telescope, Compass, Briefcase, Zap, Activity,
  LayoutGrid, Users, Search, Sun, Moon, ShoppingBag,
  BookOpen,
} from "lucide-react";
```

- [ ] **Step 2: Remove the EXPLORE_SUB constant and CollapsibleNavItem component**

Delete lines from the file:
- The `const EXPLORE_SUB = [...]` array
- The entire `CollapsibleNavItemProps` interface
- The entire `CollapsibleNavItem` function component

Also remove these imports from the top of the file (they are only used by `CollapsibleNavItem`):
```typescript
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
```

And remove `SidebarMenuSub`, `SidebarMenuSubButton`, `SidebarMenuSubItem` from the sidebar imports (these are only used by `CollapsibleNavItem`).

- [ ] **Step 3: Add flat nav items after Portfolio in the main nav group**

Find the closing `</SidebarMenu>` of the main navigation group (after the Portfolio SidebarMenuItem). Add Collections, Creators, and Activity as flat items before it:

```tsx
{/* Collections */}
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={!!pathname?.startsWith("/collections")}
    tooltip="Collections"
    onClick={closeSidebar}
  >
    <Link href="/collections">
      <LayoutGrid />
      <span>Collections</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>

{/* Creators */}
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={!!pathname?.startsWith("/creators")}
    tooltip="Creators"
    onClick={closeSidebar}
  >
    <Link href="/creators">
      <Users />
      <span>Creators</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>

{/* Activity */}
<SidebarMenuItem>
  <SidebarMenuButton
    asChild
    isActive={pathname === "/activities"}
    tooltip="Activity"
    onClick={closeSidebar}
  >
    <Link href="/activities">
      <Activity />
      <span>Activity</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

- [ ] **Step 4: Remove the Explore SidebarGroup and Docs SidebarGroup**

Delete the entire `{/* ── Explore (Collections, Creators, Activity) ────── */}` SidebarGroup block (which contains the CollapsibleNavItem).

Delete the entire `{/* ── Docs ─────────────────────────────────────────── */}` SidebarGroup block.

Delete the `<SidebarSeparator />` that follows the Docs group.

- [ ] **Step 5: Add Docs to the utilities group**

In the utilities SidebarGroup (which contains Search, ThemeToggleItem, CartItem, NotificationsItem), add a Docs link after NotificationsItem:

```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild tooltip="Docs">
    <a href="https://docs.medialane.io" target="_blank" rel="noopener noreferrer">
      <BookOpen />
      <span>Docs</span>
    </a>
  </SidebarMenuButton>
</SidebarMenuItem>
```

- [ ] **Step 6: Remove the onExplore variable (no longer needed)**

Delete the `const onExplore = ...` block since the collapsible that used it is gone.

- [ ] **Step 7: Verify the file compiles without errors**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: no errors referencing `app-sidebar.tsx`

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat: flatten sidebar nav — Collections/Creators/Activity as top-level items"
```
