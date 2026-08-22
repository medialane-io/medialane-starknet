"use client";

import { useState, useMemo } from "react";
import { CoinRow, CoinRowSkeleton, COIN_GRID, coinKind, coinServiceIds, type CoinCollectionLike } from "@medialane/ui";
import { useCoins as useCoinsData } from "@/hooks/use-coins";
import { useCoinPriceAdapter } from "./use-coin-price-adapter";
import { cn } from "@/lib/utils";
import { coinHref } from "@/lib/routes";

type CoinFilter = "all" | "creator" | "memecoin";

const FILTERS: [CoinFilter, string][] = [
  ["all", "All tokens"],
  ["creator", "Creator Coins"],
  ["memecoin", "Memecoins"],
];

export function CoinsScanList({ query }: { query: string }) {
  const [filter, setFilter] = useState<CoinFilter>("all");

  const service = filter === "all" ? undefined : coinServiceIds(filter)[0];

  const { coins, isLoading } = useCoinsData({ service });

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const normalized: CoinCollectionLike[] = coins;
    if (!q) return normalized;
    return normalized.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.symbol ?? "").toLowerCase().includes(q)
    );
  }, [coins, query]);

  const showKind = useMemo(() => new Set(items.map((c) => coinKind(c.service))).size > 1, [items]);

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        <div className={cn(COIN_GRID, "border-b border-border px-2 pb-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground")}>
          <span>Token</span>
          <span className="text-right">Price</span>
        </div>

        {isLoading && items.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => <CoinRowSkeleton key={i} />)
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {query.trim() ? `No tokens match "${query.trim()}".` : "No tokens yet."}
          </p>
        ) : (
          items.map((c) => (
            <CoinRow
              key={`${c.chain}-${c.contractAddress}`}
              collection={c}
              usePrice={useCoinPriceAdapter}
              href={coinHref("STARKNET", c.contractAddress)}
              showKind={showKind}
            />
          ))
        )}
      </div>
    </div>
  );
}
