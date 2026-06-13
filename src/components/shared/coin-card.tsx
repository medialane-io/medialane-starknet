"use client";

/**
 * CoinCard — discovery tile for an ERC-20 Creator Coin / claimed memecoin.
 * Sibling to CollectionCard (which is NFT-shaped). A coin has no per-token grid;
 * the card shows live Ekubo spot price + FDV + holders and links to the coin page,
 * whose embedded swap is the actual trade affordance.
 */

import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Users } from "lucide-react";
import type { ApiCollection } from "@medialane/sdk";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { coinKind, formatCoinPrice, formatFdv } from "@/lib/coins";
import { Skeleton } from "@/components/ui/skeleton";
import { ipfsToHttp, cn } from "@/lib/utils";

export function CoinCard({ collection }: { collection: ApiCollection }) {
  const contract = collection.contractAddress;
  const { price, isLoading: priceLoading } = useCoinPrice(contract);
  const kind = coinKind(collection.service);
  const verified = collection.claimedBy != null || kind === "creator";
  // Studio-uploaded feature image lives on the profile (platform layer);
  // fall back to the indexed collection image.
  const logoUri = collection.profile?.image ?? collection.image;
  const logo = logoUri ? ipfsToHttp(logoUri) : null;
  const fdv = formatFdv(price?.quotePerCoin, collection.totalSupply, price?.quoteSymbol ?? null);

  return (
    <Link
      href={`/coins/${contract}`}
      className="flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden transition-transform active:scale-[0.99]"
    >
      {/* Header: logo + identity */}
      <div className="flex items-center gap-3 p-4">
        <div className="relative h-12 w-12 shrink-0 rounded-full overflow-hidden bg-muted">
          {logo ? (
            <Image src={logo} alt="" fill sizes="48px" className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-blue to-brand-purple">
              <span className="text-sm font-bold text-white">
                {(collection.symbol ?? collection.name ?? "?").trim().slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate font-semibold">{collection.name ?? "Untitled coin"}</span>
            {verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Verified" />}
          </div>
          <span className="text-sm text-muted-foreground">{collection.symbol ?? "—"}</span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            kind === "creator"
              ? "border-brand-purple/30 bg-brand-purple/10 text-brand-purple"
              : "border-brand-rose/30 bg-brand-rose/10 text-brand-rose"
          )}
        >
          {kind === "creator" ? "Creator Coin" : "Memecoin"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 border-t border-border/60 px-4 py-3 text-sm">
        <Stat label="Price">
          {priceLoading ? (
            <Skeleton className="h-4 w-12" />
          ) : price ? (
            <span className="font-semibold">{formatCoinPrice(price.quotePerCoin)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Stat>
        <Stat label="FDV">
          {priceLoading ? <Skeleton className="h-4 w-12" /> : <span className="font-semibold">{fdv ?? "—"}</span>}
        </Stat>
        <Stat label="Holders">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Users className="h-3 w-3 text-muted-foreground" />
            {collection.holderCount || "—"}
          </span>
        </Stat>
      </div>

      {/* Affordance */}
      <div className="border-t border-border/60 px-4 py-2.5 text-center text-sm font-medium text-primary">
        Trade
      </div>
    </Link>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Compact row variant of CoinCard for the Tokens "Table" view. */
export function CoinRow({ collection }: { collection: ApiCollection }) {
  const contract = collection.contractAddress;
  const { price, isLoading: priceLoading } = useCoinPrice(contract);
  const kind = coinKind(collection.service);
  const verified = collection.claimedBy != null || kind === "creator";
  const logoUri = collection.profile?.image ?? collection.image;
  const logo = logoUri ? ipfsToHttp(logoUri) : null;
  const initials = (collection.symbol ?? collection.name ?? "?").trim().slice(0, 2).toUpperCase();

  return (
    <Link
      href={`/coins/${contract}`}
      className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors hover:border-primary/40"
    >
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-muted">
        {logo ? (
          <Image src={logo} alt="" fill sizes="36px" className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-blue to-brand-purple text-[11px] font-bold text-white">
            {initials}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold">{collection.name ?? "Untitled coin"}</span>
          {verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Verified" />}
        </div>
        <span className="text-xs text-muted-foreground">{collection.symbol ?? "—"}</span>
      </div>
      <span
        className={cn(
          "hidden shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-block",
          kind === "creator"
            ? "border-brand-purple/30 bg-brand-purple/10 text-brand-purple"
            : "border-brand-rose/30 bg-brand-rose/10 text-brand-rose"
        )}
      >
        {kind === "creator" ? "Creator Coin" : "Memecoin"}
      </span>
      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
        {priceLoading ? (
          <Skeleton className="ml-auto h-4 w-12" />
        ) : price ? (
          formatCoinPrice(price.quotePerCoin)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
      <span className="hidden shrink-0 text-sm font-medium text-primary sm:inline-block">Trade</span>
    </Link>
  );
}

export function CoinCardSkeleton() {
  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border/60 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
