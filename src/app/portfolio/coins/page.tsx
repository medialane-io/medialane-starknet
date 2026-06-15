"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useCoinsByCreator } from "@/hooks/use-coins";
import { CoinCard, CoinCardSkeleton } from "@/components/shared/coin-card";
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
    totalSupply: coin.totalSupply != null ? Number(coin.totalSupply) : null,
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <CoinCardSkeleton key={i} />)
            : coins.map((coin) => (
                <CoinCard
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
