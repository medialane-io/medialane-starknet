"use client";

import { useState, useMemo } from "react";
import { Coins, LayoutGrid, List, Search } from "lucide-react";
import { useCollections, type CollectionSort } from "@/hooks/use-collections";
import { CoinCard, CoinRow, CoinCardSkeleton } from "@/components/shared/coin-card";
import { cn } from "@/lib/utils";

type Filter = "all" | "creator" | "memecoin";
type View = "grid" | "table";

const FILTER_TABS: { label: string; value: Filter }[] = [
  { label: "All", value: "all" },
  { label: "Creator Coins", value: "creator" },
  { label: "Memecoins", value: "memecoin" },
];

// Default sort is recency, never raw swap volume (05 §11 anti-wash hygiene).
const SORT_OPTIONS: { label: string; value: CollectionSort }[] = [
  { label: "Recently launched", value: "recent" },
  { label: "Name", value: "name" },
];

export function CoinsExplorer({ heading = true }: { heading?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<CollectionSort>("recent");
  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");

  // "all" → standard=ERC20 (both coin services); per-kind → service filter.
  const service =
    filter === "creator" ? "creator-coin" : filter === "memecoin" ? "external-erc20" : undefined;
  const standard = filter === "all" ? "ERC20" : undefined;

  const { collections, isLoading } = useCollections(
    1, 24, undefined, sort, false, service, standard
  );

  const items = useMemo(() => {
    const all = collections ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(q) ||
        (c.symbol ?? "").toLowerCase().includes(q)
    );
  }, [collections, query]);

  return (
    <div className="space-y-6">
      {heading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Coins className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Tokens</span>
          </div>
          <h1 className="text-3xl font-bold">Creator coins &amp; memecoins</h1>
          <p className="text-muted-foreground">
            Trade creator-issued social tokens and claimed Starknet memecoins.
          </p>
        </div>
      )}

      {/* Filter + sort toolbar */}
      <div className="space-y-3 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {FILTER_TABS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as CollectionSort)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="inline-flex rounded-lg border border-border p-0.5">
              {([
                { v: "grid", Icon: LayoutGrid },
                { v: "table", Icon: List },
              ] as const).map(({ v, Icon }) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-label={v === "grid" ? "Grid view" : "Table view"}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    view === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coins by name or symbol…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/50"
          />
        </div>
      </div>

      {/* Results */}
      {isLoading && items.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <CoinCardSkeleton key={i} />)}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border/60 py-16 text-center text-muted-foreground">
          {query.trim() ? `No coins match "${query.trim()}".` : "No coins yet. Launch one from the Launchpad."}
        </div>
      ) : view === "table" ? (
        <div className="space-y-2">
          {items.map((c) => <CoinRow key={c.contractAddress} collection={c} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((c) => <CoinCard key={c.contractAddress} collection={c} />)}
        </div>
      )}
    </div>
  );
}
