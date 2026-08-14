"use client";

import { CoinsExplorer as UICoinsExplorer, type CoinFilter, type CoinSort, type CoinCollectionLike } from "@medialane/ui";
import { useCoins as useCoinsData } from "@/hooks/use-coins";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { coinHref as buildCoinHref } from "@/lib/routes";

function usePrice(coin: CoinCollectionLike) {
  const { price, isLoading } = useCoinPrice(coin.contractAddress);
  return { price, isLoading };
}

function useCoins({ filter }: { filter: CoinFilter; sort: CoinSort }) {

  const service = filter === "creator" ? "creator-coin" : filter === "memecoin" ? "external-erc20" : undefined;
  const { coins, isLoading } = useCoinsData({ service });

  const collections = coins.map((c) => ({
    ...c,
    totalSupply: c.totalSupply != null ? Number(c.totalSupply) : null,
  }));
  return { collections, isLoading };
}

export function CoinsExplorer({ heading = true }: { heading?: boolean }) {
  return (
    <UICoinsExplorer
      useCoins={useCoins}
      usePrice={usePrice}
      coinHref={(c) => buildCoinHref("STARKNET", c.contractAddress)}
      heading={heading}
    />
  );
}
