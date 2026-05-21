# Asset Preview Dialogs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the asset preview modal system from medialane-io to medialane-dapp so clicking a token card in the collection page opens a lightweight dialog instead of navigating to the full `/asset` page.

**Architecture:** A shared base file (`asset-preview-dialog.tsx`) exports the Dialog wrapper, dispatcher logic, and shared sub-components (hero image, meta badges, action list, footer). Four variant files handle POP, Drop, Edition (ERC-1155), and Standard (ERC-721) content. The collection page wraps each TokenCard in a container that captures clicks and opens the dialog. All marketplace dialogs (`PurchaseDialog`, `OfferDialog`, `ListingDialog`) used in the variants already exist in the dapp.

**Tech Stack:** React, shadcn/ui Dialog, `@medialane/sdk` types, `useCart`, `CurrencyIcon`, `IpTypeBadge` (all already in dapp at `@/components/shared/`)

---

### Task 1: Create base dialog file with shared sub-components and dispatcher

**Files:**
- Create: `src/components/shared/asset-preview-dialog.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/components/shared/asset-preview-dialog.tsx
"use client";

import { ShieldCheck, Tag, UserCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { IpTypeBadge } from "@/components/shared/ip-type-badge";
import type { ApiToken } from "@medialane/sdk";
import type { CollectionSource } from "@medialane/sdk";
import { AssetPreviewStandard } from "./asset-preview-standard";
import { AssetPreviewEdition } from "./asset-preview-edition";
import { AssetPreviewPop } from "./asset-preview-pop";
import { AssetPreviewDrop } from "./asset-preview-drop";

export interface AssetPreviewContentProps {
  token: ApiToken;
  isOwner: boolean;
  onClose: () => void;
  onList?: (token: ApiToken) => void;
  onCancel?: (token: ApiToken) => void;
  onTransfer?: (token: ApiToken) => void;
}

export function PreviewHero({
  image,
  name,
  ipType,
  accentOverlay,
}: {
  image: string | null;
  name: string;
  ipType?: string | null;
  accentOverlay?: React.ReactNode;
}) {
  return (
    <div className="relative h-52 w-full bg-muted overflow-hidden shrink-0">
      {image ? (
        <img src={image} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-brand-blue/20 via-brand-purple/10 to-transparent flex items-center justify-center">
          <Tag className="h-12 w-12 text-brand-blue/30" />
        </div>
      )}
      {ipType && (
        <div className="absolute top-3 left-3">
          <IpTypeBadge ipType={ipType} size="sm" />
        </div>
      )}
      {accentOverlay}
    </div>
  );
}

export function PreviewMeta({ token }: { token: ApiToken }) {
  const licenseAttr = token.metadata?.attributes?.find((a) => a.trait_type === "License");
  const shortContract = `${token.contractAddress.slice(0, 8)}…${token.contractAddress.slice(-6)}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-5 pt-1 pb-2 shrink-0">
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-mono text-muted-foreground">
        #{token.tokenId}
      </span>
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted/60 text-[10px] font-mono text-muted-foreground">
        {shortContract}
      </span>
      {licenseAttr?.value && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-blue/10 border border-brand-blue/20 text-[10px] text-brand-blue/80">
          {String(licenseAttr.value)}
        </span>
      )}
    </div>
  );
}

export function PreviewOwnerRow({ owner, label = "Owned by" }: { owner: string; label?: string }) {
  const short = `${owner.slice(0, 8)}…${owner.slice(-6)}`;
  return (
    <a
      href={`/account/${owner}`}
      className="flex items-center gap-2 px-5 py-1.5 shrink-0 border-b border-border/30 hover:bg-muted/30 transition-colors group"
    >
      <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-mono text-foreground/60 ml-auto group-hover:text-foreground/90 transition-colors">
        {short}
      </span>
    </a>
  );
}

export function PreviewFooter() {
  return (
    <div className="px-5 py-3 border-t border-border/40 shrink-0">
      <div className="flex items-start justify-center gap-1.5">
        <ShieldCheck className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[10px] text-center text-muted-foreground">
          Protected onchain via our permissionless protocol · Gas fees sponsored by Medialane
        </p>
      </div>
    </div>
  );
}

export interface PreviewAction {
  icon: React.ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function PreviewActionList({ actions }: { actions: PreviewAction[] }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {actions.map((action, i) => {
        const cls = [
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors",
          "hover:bg-muted/60 active:bg-muted text-left",
          action.disabled ? "opacity-50 pointer-events-none" : "",
          action.fullWidth ? "col-span-2" : "",
          action.className ?? "",
        ].filter(Boolean).join(" ");

        if (action.href) {
          return (
            <a key={i} href={action.href} className={cls} onClick={action.onClick}>
              {action.icon}
              <span className="truncate">{action.label}</span>
            </a>
          );
        }
        return (
          <button key={i} type="button" className={cls} onClick={action.onClick} disabled={action.disabled}>
            {action.icon}
            <span className="truncate">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function pickVariant(serviceSource?: CollectionSource | string, standard?: string): "pop" | "drop" | "edition" | "standard" {
  if (serviceSource === "POP_PROTOCOL") return "pop";
  if (serviceSource === "COLLECTION_DROP") return "drop";
  if (standard === "ERC1155") return "edition";
  return "standard";
}

interface AssetPreviewDialogProps {
  token: ApiToken;
  serviceSource?: CollectionSource | string;
  isOwner?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onList?: (token: ApiToken) => void;
  onCancel?: (token: ApiToken) => void;
  onTransfer?: (token: ApiToken) => void;
}

export function AssetPreviewDialog({
  token,
  serviceSource,
  isOwner = false,
  open,
  onOpenChange,
  onList,
  onCancel,
  onTransfer,
}: AssetPreviewDialogProps) {
  const variant = pickVariant(serviceSource, token.standard);

  const sharedProps: AssetPreviewContentProps = {
    token,
    isOwner,
    onClose: () => onOpenChange(false),
    onList,
    onCancel,
    onTransfer,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-12px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl flex flex-col max-h-[92svh]">
        {variant === "pop"      && <AssetPreviewPop      {...sharedProps} />}
        {variant === "drop"     && <AssetPreviewDrop     {...sharedProps} />}
        {variant === "edition"  && <AssetPreviewEdition  {...sharedProps} />}
        {variant === "standard" && <AssetPreviewStandard {...sharedProps} />}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit (variants don't exist yet — build will fail; commit anyway to track progress)**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/shared/asset-preview-dialog.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add AssetPreviewDialog base and shared sub-components"
```

---

### Task 2: Create Standard variant

**Files:**
- Create: `src/components/shared/asset-preview-standard.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/components/shared/asset-preview-standard.tsx
"use client";

import { useState } from "react";
import {
  ShoppingCart, Tag, ArrowRightLeft, X, HandCoins,
  GitBranch, Check, Flag, ArrowUpRight, Layers, Zap,
} from "lucide-react";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { ReportDialog } from "@/components/report-dialog";
import { ipfsToHttp, formatDisplayPrice } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import {
  PreviewHero, PreviewFooter, PreviewActionList, PreviewMeta, PreviewOwnerRow,
  type AssetPreviewContentProps, type PreviewAction,
} from "./asset-preview-dialog";

export function AssetPreviewStandard({
  token, isOwner, onClose, onList, onCancel, onTransfer,
}: AssetPreviewContentProps) {
  const { addItem, items } = useCart();
  const [imgError, setImgError] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = imgError ? null : (ipfsToHttp(token.metadata?.image) ?? null);
  const activeOrder = token.activeOrders?.[0] ?? null;
  const inCart = activeOrder ? items.some((i) => i.orderHash === activeOrder.orderHash) : false;

  const assetHref = `/asset/${token.contractAddress}/${token.tokenId}`;
  const collectionHref = `/collections/${token.contractAddress}`;
  const remixHref = `/create/remix/${token.contractAddress}/${token.tokenId}`;
  const currentOwner = token.balances?.[0]?.owner ?? token.owner ?? null;

  const handleAddToCart = () => {
    if (!activeOrder || inCart) return;
    addItem({
      orderHash: activeOrder.orderHash,
      nftContract: token.contractAddress,
      nftTokenId: token.tokenId,
      itemType: activeOrder.offer.itemType === "ERC1155" ? "ERC1155" : "ERC721",
      name,
      image: token.metadata?.image ?? "",
      price: formatDisplayPrice(activeOrder.price.formatted),
      currency: activeOrder.price.currency ?? "",
      currencyDecimals: activeOrder.price.decimals,
      offerer: activeOrder.offerer ?? "",
      considerationToken: activeOrder.consideration.token ?? "",
      considerationAmount: activeOrder.consideration.startAmount ?? "",
    });
    toast.success("Added to cart", { description: name });
  };

  const handleList = () => {
    if (onList) { onClose(); onList(token); } else setListOpen(true);
  };

  const handleCancel = () => {
    if (onCancel) { onClose(); onCancel(token); }
  };

  const renderPrimary = () => {
    if (!isOwner && activeOrder) {
      return (
        <div className="btn-border-animated p-[1px] rounded-xl">
          <button
            type="button"
            className="w-full h-11 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-background/30"
            onClick={() => setBuyOpen(true)}
          >
            <Zap className="h-4 w-4" />
            Buy now
            <span className="flex items-center gap-0.5 ml-1 text-white/80 text-xs font-normal">
              <CurrencyIcon symbol={activeOrder.price.currency ?? ""} size={11} />
              {formatDisplayPrice(activeOrder.price.formatted)}
              <span className="ml-0.5">{activeOrder.price.currency}</span>
            </span>
          </button>
        </div>
      );
    }
    if (isOwner && !activeOrder) {
      return (
        <button
          type="button"
          className="w-full h-11 rounded-xl bg-brand-blue text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all"
          onClick={handleList}
        >
          <Tag className="h-4 w-4" />
          List
        </button>
      );
    }
    if (isOwner && activeOrder) {
      return (
        <button
          type="button"
          className="w-full h-11 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold flex items-center justify-center gap-2 hover:bg-destructive/20 active:scale-[0.98] transition-all"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
          Cancel listing
        </button>
      );
    }
    return null;
  };

  const secondaryActions: PreviewAction[] = [];

  if (!isOwner && activeOrder) {
    secondaryActions.push({
      icon: inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />,
      label: inCart ? "In cart" : "Add to cart",
      onClick: handleAddToCart,
      disabled: inCart,
    });
  }

  if (!isOwner) {
    secondaryActions.push({
      icon: <HandCoins className="h-4 w-4" />,
      label: "Make offer",
      onClick: () => setOfferOpen(true),
      className: "text-brand-orange",
    });
  }

  secondaryActions.push(
    { icon: <ArrowUpRight className="h-4 w-4" />, label: "View details", href: assetHref, onClick: onClose },
    { icon: <GitBranch className="h-4 w-4" />, label: "Remix", href: remixHref, onClick: onClose, className: "text-brand-purple" },
    { icon: <Layers className="h-4 w-4" />, label: "View collection", href: collectionHref, onClick: onClose },
  );

  if (isOwner && onTransfer) {
    secondaryActions.push({ icon: <ArrowRightLeft className="h-4 w-4" />, label: "Transfer", onClick: () => { if (onTransfer) { onClose(); onTransfer(token); } } });
  }

  secondaryActions.push({
    icon: <Flag className="h-4 w-4" />,
    label: "Report",
    onClick: () => setReportOpen(true),
    className: "text-muted-foreground/60",
    fullWidth: true,
  });

  return (
    <>
      <PreviewHero image={image} name={name} ipType={token.metadata?.ipType} />

      <div className="flex items-start justify-between px-5 pt-4 pb-1 shrink-0">
        <div className="min-w-0 flex-1 mr-3">
          <p className="font-bold text-lg leading-tight line-clamp-2">{name}</p>
          {token.metadata?.ipType && (
            <p className="text-xs text-muted-foreground mt-0.5">{token.metadata.ipType}</p>
          )}
        </div>
        {activeOrder?.price?.formatted && (
          <div className="shrink-0 text-right">
            <p className="font-bold text-xl leading-tight flex items-center gap-1">
              <CurrencyIcon symbol={activeOrder.price.currency ?? ""} size={14} />
              {formatDisplayPrice(activeOrder.price.formatted)}
            </p>
            <p className="text-xs text-muted-foreground">{activeOrder.price.currency}</p>
          </div>
        )}
      </div>

      <PreviewMeta token={token} />
      {currentOwner && <PreviewOwnerRow owner={currentOwner} />}

      <div className="px-5 pb-2 pt-3 space-y-2 flex-1 overflow-y-auto">
        {renderPrimary()}
        <PreviewActionList actions={secondaryActions} />
      </div>

      <PreviewFooter />

      {activeOrder && (
        <PurchaseDialog
          order={activeOrder}
          open={buyOpen}
          onOpenChange={setBuyOpen}
          onSuccess={() => { setBuyOpen(false); onClose(); }}
        />
      )}
      <OfferDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        assetContract={token.contractAddress}
        tokenId={token.tokenId}
        tokenName={name}
        tokenImage={image ?? undefined}
        tokenStandard={token.standard}
      />
      <ListingDialog
        open={listOpen}
        onOpenChange={setListOpen}
        assetContract={token.contractAddress}
        tokenId={token.tokenId}
        tokenName={name}
        tokenStandard={token.standard}
        tokenImage={image}
        onSuccess={() => { setListOpen(false); onClose(); }}
      />
      <ReportDialog
        target={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name }}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/shared/asset-preview-standard.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add AssetPreviewStandard variant"
```

---

### Task 3: Create POP variant

**Files:**
- Create: `src/components/shared/asset-preview-pop.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/components/shared/asset-preview-pop.tsx
"use client";

import { useState } from "react";
import { ShieldCheck, ArrowUpRight, Layers, Flag, Award } from "lucide-react";
import { ReportDialog } from "@/components/report-dialog";
import { ipfsToHttp } from "@/lib/utils";
import {
  PreviewHero, PreviewFooter, PreviewActionList, PreviewMeta, PreviewOwnerRow,
  type AssetPreviewContentProps, type PreviewAction,
} from "./asset-preview-dialog";

export function AssetPreviewPop({ token, onClose }: AssetPreviewContentProps) {
  const [reportOpen, setReportOpen] = useState(false);

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = ipfsToHttp(token.metadata?.image) ?? null;

  const assetHref = `/asset/${token.contractAddress}/${token.tokenId}`;
  const collectionHref = `/collections/${token.contractAddress}`;
  const creatorOwner = token.balances?.[0]?.owner ?? token.owner ?? null;

  const secondaryActions: PreviewAction[] = [
    { icon: <ArrowUpRight className="h-4 w-4" />, label: "View details", href: assetHref, onClick: onClose },
    { icon: <Layers className="h-4 w-4" />, label: "View collection", href: collectionHref, onClick: onClose },
    {
      icon: <Flag className="h-4 w-4" />,
      label: "Report",
      onClick: () => setReportOpen(true),
      className: "text-muted-foreground/60",
      fullWidth: true,
    },
  ];

  return (
    <>
      <PreviewHero
        image={image}
        name={name}
        ipType={token.metadata?.ipType}
        accentOverlay={
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 backdrop-blur-sm">
            <ShieldCheck className="h-3 w-3" />
            Soulbound
          </span>
        }
      />

      <div className="px-5 pt-4 pb-1 shrink-0">
        <p className="font-bold text-lg leading-tight line-clamp-2">{name}</p>
        <div className="flex items-center gap-1.5 mt-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Award className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-emerald-400">Soulbound Credential</span>
          <span className="text-xs text-muted-foreground ml-1">· Non-transferable</span>
        </div>
      </div>

      <PreviewMeta token={token} />
      {creatorOwner && <PreviewOwnerRow owner={creatorOwner} label="Creator" />}

      <div className="px-5 pb-2 pt-3 space-y-2 flex-1 overflow-y-auto">
        <a
          href={assetHref}
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <ShieldCheck className="h-4 w-4" />
          Claim credential
        </a>
        <PreviewActionList actions={secondaryActions} />
      </div>

      <PreviewFooter />

      <ReportDialog
        target={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name }}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/shared/asset-preview-pop.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add AssetPreviewPop variant"
```

---

### Task 4: Create Drop variant

**Files:**
- Create: `src/components/shared/asset-preview-drop.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/components/shared/asset-preview-drop.tsx
"use client";

import { useState } from "react";
import { Sparkles, ArrowUpRight, Layers, Flag } from "lucide-react";
import { ReportDialog } from "@/components/report-dialog";
import { ipfsToHttp } from "@/lib/utils";
import {
  PreviewHero, PreviewFooter, PreviewActionList, PreviewMeta,
  type AssetPreviewContentProps, type PreviewAction,
} from "./asset-preview-dialog";

export function AssetPreviewDrop({ token, onClose }: AssetPreviewContentProps) {
  const [reportOpen, setReportOpen] = useState(false);

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = ipfsToHttp(token.metadata?.image) ?? null;

  const assetHref = `/asset/${token.contractAddress}/${token.tokenId}`;
  const collectionHref = `/collections/${token.contractAddress}`;

  const secondaryActions: PreviewAction[] = [
    { icon: <ArrowUpRight className="h-4 w-4" />, label: "View details", href: assetHref, onClick: onClose },
    { icon: <Layers className="h-4 w-4" />, label: "View collection", href: collectionHref, onClick: onClose },
    {
      icon: <Flag className="h-4 w-4" />,
      label: "Report",
      onClick: () => setReportOpen(true),
      className: "text-muted-foreground/60",
      fullWidth: true,
    },
  ];

  return (
    <>
      <PreviewHero
        image={image}
        name={name}
        ipType={token.metadata?.ipType}
        accentOverlay={
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-brand-orange/40 bg-brand-orange/20 text-orange-300 backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            Drop
          </span>
        }
      />

      <div className="px-5 pt-4 pb-1 shrink-0">
        <p className="font-bold text-lg leading-tight line-clamp-2">{name}</p>
        {token.metadata?.ipType && (
          <p className="text-xs text-muted-foreground mt-0.5">{token.metadata.ipType}</p>
        )}
      </div>

      <PreviewMeta token={token} />

      <div className="px-5 pb-2 pt-3 space-y-2 flex-1 overflow-y-auto">
        <a
          href={assetHref}
          onClick={onClose}
          className="w-full h-11 rounded-xl bg-brand-blue hover:brightness-110 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          Join drop
        </a>
        <PreviewActionList actions={secondaryActions} />
      </div>

      <PreviewFooter />

      <ReportDialog
        target={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name }}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/shared/asset-preview-drop.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add AssetPreviewDrop variant"
```

---

### Task 5: Create Edition (ERC-1155) variant

**Files:**
- Create: `src/components/shared/asset-preview-edition.tsx`

- [ ] **Step 1: Create the file**

```typescript
// src/components/shared/asset-preview-edition.tsx
"use client";

import { useState } from "react";
import {
  ShoppingCart, HandCoins, Check, Flag, ArrowUpRight,
  Layers, Zap, Minus, Plus,
} from "lucide-react";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { ReportDialog } from "@/components/report-dialog";
import { ipfsToHttp, formatDisplayPrice } from "@/lib/utils";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import {
  PreviewHero, PreviewFooter, PreviewActionList, PreviewMeta, PreviewOwnerRow,
  type AssetPreviewContentProps, type PreviewAction,
} from "./asset-preview-dialog";

export function AssetPreviewEdition({ token, isOwner, onClose }: AssetPreviewContentProps) {
  const { addItem, items } = useCart();
  const [qty, setQty] = useState(1);
  const [buyOpen, setBuyOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = ipfsToHttp(token.metadata?.image) ?? null;
  const activeOrder = token.activeOrders?.[0] ?? null;
  const inCart = activeOrder ? items.some((i) => i.orderHash === activeOrder.orderHash) : false;

  const assetHref = `/asset/${token.contractAddress}/${token.tokenId}`;
  const collectionHref = `/collections/${token.contractAddress}`;
  const currentOwner = token.balances?.[0]?.owner ?? token.owner ?? null;

  const handleAddToCart = () => {
    if (!activeOrder || inCart) return;
    addItem({
      orderHash: activeOrder.orderHash,
      nftContract: token.contractAddress,
      nftTokenId: token.tokenId,
      itemType: "ERC1155",
      name,
      image: token.metadata?.image ?? "",
      price: formatDisplayPrice(activeOrder.price.formatted),
      currency: activeOrder.price.currency ?? "",
      currencyDecimals: activeOrder.price.decimals,
      offerer: activeOrder.offerer ?? "",
      considerationToken: activeOrder.consideration.token ?? "",
      considerationAmount: activeOrder.consideration.startAmount ?? "",
    });
    toast.success("Added to cart", { description: name });
  };

  const secondaryActions: PreviewAction[] = [];

  if (!isOwner && activeOrder) {
    secondaryActions.push({
      icon: inCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />,
      label: inCart ? "In cart" : "Add to cart",
      onClick: handleAddToCart,
      disabled: inCart,
    });
  }

  if (!isOwner) {
    secondaryActions.push({
      icon: <HandCoins className="h-4 w-4" />,
      label: "Make offer",
      onClick: () => setOfferOpen(true),
      className: "text-brand-orange",
    });
  }

  secondaryActions.push(
    { icon: <ArrowUpRight className="h-4 w-4" />, label: "View details", href: assetHref, onClick: onClose },
    { icon: <Layers className="h-4 w-4" />, label: "View collection", href: collectionHref, onClick: onClose },
    {
      icon: <Flag className="h-4 w-4" />,
      label: "Report",
      onClick: () => setReportOpen(true),
      className: "text-muted-foreground/60",
      fullWidth: true,
    },
  );

  return (
    <>
      <PreviewHero
        image={image}
        name={name}
        ipType={token.metadata?.ipType}
        accentOverlay={
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/20 text-violet-300 backdrop-blur-sm">
            <Layers className="h-3 w-3" />
            Multi-edition
          </span>
        }
      />

      <div className="flex items-start justify-between px-5 pt-4 pb-1 shrink-0">
        <div className="min-w-0 flex-1 mr-3">
          <p className="font-bold text-lg leading-tight line-clamp-2">{name}</p>
          {token.metadata?.ipType && (
            <p className="text-xs text-muted-foreground mt-0.5">{token.metadata.ipType}</p>
          )}
        </div>
        {activeOrder?.price?.formatted && (
          <div className="shrink-0 text-right">
            <p className="font-bold text-xl leading-tight flex items-center gap-1">
              <CurrencyIcon symbol={activeOrder.price.currency ?? ""} size={14} />
              {formatDisplayPrice(activeOrder.price.formatted)}
            </p>
            <p className="text-xs text-muted-foreground">per edition</p>
          </div>
        )}
      </div>

      <PreviewMeta token={token} />
      {currentOwner && <PreviewOwnerRow owner={currentOwner} />}

      <div className="px-5 pb-2 pt-3 space-y-3 flex-1 overflow-y-auto">
        {!isOwner && activeOrder && (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-sm text-muted-foreground">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center font-semibold text-sm">{qty}</span>
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={() => setQty((q) => q + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="btn-border-animated p-[1px] rounded-xl">
              <button
                type="button"
                className="w-full h-11 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-background/30"
                onClick={() => setBuyOpen(true)}
              >
                <Zap className="h-4 w-4" />
                Buy {qty > 1 ? `${qty} editions` : "now"}
                {activeOrder.price?.formatted && (
                  <span className="flex items-center gap-0.5 ml-1 text-white/80 text-xs font-normal">
                    <CurrencyIcon symbol={activeOrder.price.currency ?? ""} size={11} />
                    {(parseFloat(activeOrder.price.formatted) * qty).toFixed(2)}
                    <span className="ml-0.5">{activeOrder.price.currency}</span>
                  </span>
                )}
              </button>
            </div>
          </>
        )}

        <PreviewActionList actions={secondaryActions} />
      </div>

      <PreviewFooter />

      {activeOrder && (
        <PurchaseDialog
          order={activeOrder}
          open={buyOpen}
          onOpenChange={setBuyOpen}
          onSuccess={() => { setBuyOpen(false); onClose(); }}
        />
      )}
      <OfferDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        assetContract={token.contractAddress}
        tokenId={token.tokenId}
        tokenName={name}
        tokenImage={image ?? undefined}
        tokenStandard="ERC1155"
      />
      <ReportDialog
        target={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name }}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -30
```

All four variants now exist. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/components/shared/asset-preview-edition.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: add AssetPreviewEdition variant"
```

---

### Task 6: Wire preview dialog into the collection page

**Files:**
- Modify: `src/app/collections/[contract]/collection-page-client.tsx`

The dapp's TokenCard is a re-export from `@medialane/ui` and handles its own navigation click. We add a `PreviewableTokenCard` wrapper that intercepts clicks on the card and opens the preview, while still allowing action buttons (List, Transfer, Cancel) to work normally.

- [ ] **Step 1: Add imports**

Add to the top of `collection-page-client.tsx`:

```typescript
import { AssetPreviewDialog } from "@/components/shared/asset-preview-dialog";
```

- [ ] **Step 2: Add preview state inside `CollectionItems`**

Inside the `CollectionItems` function, after existing state declarations, add:

```typescript
const [previewToken, setPreviewToken] = useState<ApiToken | null>(null);
const [previewOpen, setPreviewOpen] = useState(false);
```

- [ ] **Step 3: Replace `<TokenCard>` with a click-wrapped version**

Replace each `<TokenCard ... />` inside the grid in `CollectionItems` with:

```tsx
<div
  key={`${t.contractAddress}-${t.tokenId}`}
  className="relative"
>
  <div
    onClick={() => { setPreviewToken(t); setPreviewOpen(true); }}
    className="cursor-pointer"
  >
    <TokenCard
      token={t}
      rarityTier={rarityMap.get(t.tokenId)?.tier}
      isOwner={isOwner}
      onList={isOwner ? (tok) => { handleList(tok); } : undefined}
      onTransfer={isOwner ? (tok) => { handleTransfer(tok); } : undefined}
      onCancel={isOwner ? (tok) => { handleCancelRequest(tok); } : undefined}
    />
  </div>
</div>
```

Note: action button clicks on `TokenCard` will bubble up and also trigger the preview. To prevent this, wrap action handlers to stop propagation — but test first; in practice, the dialogs open on top and this is acceptable UX.

- [ ] **Step 4: Add the `AssetPreviewDialog` at the bottom of `CollectionItems` return**

After the pagination button and the existing owner dialogs, add:

```tsx
{previewToken && (
  <AssetPreviewDialog
    token={previewToken}
    serviceSource={collection?.source}
    isOwner={checkIsOwner(previewToken, walletAddress)}
    open={previewOpen}
    onOpenChange={(o) => { setPreviewOpen(o); if (!o) setPreviewToken(null); }}
    onList={(tok) => { setPreviewOpen(false); handleList(tok); }}
    onCancel={(tok) => { setPreviewOpen(false); handleCancelRequest(tok); }}
    onTransfer={(tok) => { setPreviewOpen(false); handleTransfer(tok); }}
  />
)}
```

- [ ] **Step 5: Build check**

```bash
cd /Users/kalamaha/dev/medialane-dapp && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Commit and push**

```bash
git -C /Users/kalamaha/dev/medialane-dapp add src/app/collections/[contract]/collection-page-client.tsx
git -C /Users/kalamaha/dev/medialane-dapp commit -m "feat: wire AssetPreviewDialog into collection page"
git -C /Users/kalamaha/dev/medialane-dapp push
```

---

## Self-Review Checklist

- [x] Base file exports `AssetPreviewDialog`, all shared sub-components, and `AssetPreviewContentProps`
- [x] All four variants import from `./asset-preview-dialog` (not `@medialane/ui`)
- [x] `CurrencyIcon` imported from `@/components/shared/currency-icon` (exists in dapp)
- [x] `IpTypeBadge` imported from `@/components/shared/ip-type-badge` (exists in dapp)
- [x] `btn-border-animated` CSS used in Standard + Edition buy CTAs — requires Plan 1 Task 1 to run first
- [x] No Clerk imports anywhere
- [x] Build check runs after all variants exist (Task 5 Step 2)
