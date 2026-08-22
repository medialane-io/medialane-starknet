"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useCoinsByCreator } from "@/hooks/use-coins";
import { CoinRow, CoinRowSkeleton } from "@/components/shared/coin-row";
import { COIN_GRID } from "@medialane/ui";
import { cn } from "@/lib/utils";
import { EmptyOrError } from "@/components/ui/empty-or-error";
import { Coins } from "lucide-react";
import type { CoinCollectionLike } from "@medialane/ui";
import type { ApiCoin } from "@medialane/sdk";

function toCoinLike(coin: ApiCoin): CoinCollectionLike {
  return {
    contractAddress: coin.contractAddress,
    chain: coin.chain,
    name: coin.name,
    symbol: coin.symbol,
    image: coin.image,
    service: coin.service,
    totalSupply: coin.totalSupply,
    decimals: coin.decimals,
  };
}

export default function PortfolioCoinsPage() {
  const { address: walletAddress } = useWallet();
  const { coins, isLoading, error, mutate } = useCoinsByCreator(walletAddress ?? null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Coins</h2>
        {coins.length > 0 && (
          <span className="text-sm text-muted-foreground">({coins.length})</span>
        )}
      </div>

      <EmptyOrError
        isLoading={isLoading}
        error={error}
        isEmpty={coins.length === 0}
        onRetry={mutate}
        emptyTitle="No coins yet"
        emptyDescription="Coins you launch will appear here, where you can edit their logo and description."
        emptyCta={{ label: "Launch a coin", href: "/launchpad" }}
        emptyIcon={<Coins className="h-7 w-7 text-muted-foreground" />}
      >
        <div>
          <div className={cn(COIN_GRID, "border-b border-border px-2 pb-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground")}>
            <span>Token</span>
            <span className="text-right">Price</span>
          </div>
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <CoinRowSkeleton key={i} />)
            : coins.map((coin) => (
                <CoinRow
                  key={coin.contractAddress}
                  collection={toCoinLike(coin)}
                  href={`/portfolio/coins/${coin.contractAddress}/settings`}
                />
              ))}
        </div>
      </EmptyOrError>
    </div>
  );
}
