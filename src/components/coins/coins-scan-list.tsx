"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoins as useCoinsData } from "@/hooks/use-coins";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { coinKind, formatCoinPrice, type CoinCollectionLike, type CoinKind } from "@medialane/ui";
import { ipfsToHttp, cn } from "@/lib/utils";

type CoinFilter = "all" | "creator" | "memecoin";

const KIND_BADGE: Record<CoinKind, string> = {
  creator: "border-brand-blue/30 bg-brand-blue/10 text-brand-blue",
  memecoin: "border-brand-purple/30 bg-brand-purple/10 text-brand-purple",
};

const KIND_FALLBACK: Record<CoinKind, string> = {
  creator: "from-brand-blue to-brand-purple",
  memecoin: "from-brand-purple to-brand-rose",
};

const KIND_LABEL: Record<CoinKind, string> = {
  creator: "Creator Coin",
  memecoin: "Memecoin",
};

function CoinAvatar({ coin, kind }: { coin: CoinCollectionLike; kind: CoinKind }) {
  const logoUri = coin.profile?.image ?? coin.image;
  const logo = logoUri ? ipfsToHttp(logoUri) : null;
  const initials = (coin.symbol ?? coin.name ?? "?").trim().slice(0, 2).toUpperCase();

  return (
    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
      {logo ? (
        <Image src={logo} alt="" fill sizes="40px" className="object-cover" unoptimized />
      ) : (
        <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br text-xs font-black text-white", KIND_FALLBACK[kind])}>
          {initials}
        </div>
      )}
    </div>
  );
}

function CoinPriceCell({ address }: { address: string }) {
  const { price, isLoading } = useCoinPrice(address);
  if (isLoading) return <Skeleton className="h-4 w-20 ml-auto" />;
  if (!price) return <span className="text-muted-foreground tabular-nums">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-black tabular-nums text-sm">
      <CurrencyIcon symbol={price.quoteSymbol ?? "ETH"} size={13} />
      {formatCoinPrice(price.quotePerCoin)}
    </span>
  );
}

function CoinScanRow({ coin }: { coin: CoinCollectionLike }) {
  const kind = coinKind(coin.service);
  return (
    <Link
      href={`/coins/${coin.contractAddress}`}
      className="group flex items-center gap-3 sm:gap-4 rounded-xl border border-border/40 bg-card px-4 py-3 transition-all hover:border-border/80 hover:bg-muted/20"
    >
      <CoinAvatar coin={coin} kind={kind} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{coin.name ?? "Untitled"}</p>
        <p className="truncate text-xs tabular-nums text-muted-foreground">${coin.symbol ?? "—"}</p>
      </div>

      <span className={cn(
        "hidden shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold sm:inline-block",
        KIND_BADGE[kind]
      )}>
        {KIND_LABEL[kind]}
      </span>

      <div className="shrink-0 text-right">
        <CoinPriceCell address={coin.contractAddress} />
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
    </Link>
  );
}

function CoinScanRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/40 bg-card px-4 py-3">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-4 rounded shrink-0" />
    </div>
  );
}

export function CoinsScanList({ query }: { query: string }) {
  const [filter, setFilter] = useState<CoinFilter>("all");

  const service =
    filter === "creator" ? "creator-coin" :
    filter === "memecoin" ? "external-erc20" : undefined;

  const { coins, isLoading } = useCoinsData({ service });

  const normalized: CoinCollectionLike[] = useMemo(
    () => coins.map((c) => ({ ...c, totalSupply: c.totalSupply != null ? Number(c.totalSupply) : null })),
    [coins]
  );

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.symbol ?? "").toLowerCase().includes(q)
    );
  }, [normalized, query]);

  return (
    <div className="space-y-4">
      {/* Type filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          ["all", "All tokens"],
          ["creator", "Creator Coins"],
          ["memecoin", "Memecoins"],
        ] as [CoinFilter, string][]).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={cn(
              "text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap font-medium",
              filter === v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Scan list */}
      {isLoading && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <CoinScanRowSkeleton key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border/60 py-16 text-center text-sm text-muted-foreground">
          {query.trim() ? `No tokens match "${query.trim()}".` : "No tokens yet."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((c) => (
            <CoinScanRow key={`${c.chain}-${c.contractAddress}`} coin={c} />
          ))}
        </div>
      )}
    </div>
  );
}
