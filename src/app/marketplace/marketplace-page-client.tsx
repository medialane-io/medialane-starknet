"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { PageContainer } from "@medialane/ui";
import { getTokenBySymbol } from "@medialane/sdk";
import type { ApiOrder } from "@medialane/sdk";
import { ListingsGrid } from "@/components/marketplace/listings-grid";
import { PlatformStatsBar } from "@/components/marketplace/platform-stats-bar";
import { MarketplaceSearch, SearchInput } from "@/components/marketplace/marketplace-search";
import { ActiveFilters, FiltersButton, FiltersDialog, useMarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import { ActivityTicker } from "@/components/shared/activity-ticker";
import { CoinsScanList } from "@/components/coins/coins-scan-list";
import { cn } from "@/lib/utils";

export default function MarketplacePageClient({ initialOrders }: { initialOrders?: ApiOrder[] }) {
  const [view, setView] = useState<"nfts" | "tokens">("nfts");
  const [coinQuery, setCoinQuery] = useState("");
  const filters = useMarketplaceFilters();

  return (
    <PageContainer className="box-border max-w-full pt-20 pb-8 space-y-6">

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-primary shrink-0" />
          <h1 className="text-3xl sm:text-4xl font-bold">Marketplace</h1>
        </div>
        <PlatformStatsBar />
      </div>

      {view === "nfts" && <ActivityTicker limit={12} />}

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">

          <div className="flex-1 min-w-0">
            {view === "nfts" ? (
              <MarketplaceSearch />
            ) : (
              <SearchInput
                placeholder="Search tokens by name or symbol"
                value={coinQuery}
                onChange={(e) => setCoinQuery(e.target.value)}
                onClear={() => setCoinQuery("")}
              />
            )}
          </div>

          <div className="inline-flex rounded-lg border border-border p-0.5 shrink-0">
            {([["nfts", "NFTs"], ["tokens", "Tokens"]] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {view === "nfts" && <FiltersButton filters={filters} />}
        </div>

        {view === "nfts" && <ActiveFilters filters={filters} />}
      </div>

      <FiltersDialog filters={filters} />

      {view === "nfts" ? (
        <ListingsGrid
          sort={filters.sort}
          currency={filters.currency ? getTokenBySymbol(filters.currency)?.address : undefined}
          orderType={filters.orderType}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          initialOrders={initialOrders}
        />
      ) : (
        <CoinsScanList query={coinQuery} />
      )}
    </PageContainer>
  );
}
