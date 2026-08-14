"use client";

import { CoinsExplorer as UICoinsExplorer, type CoinFilter, type CoinSort, type CoinCollectionLike } from "@medialane/ui";
import { useCoins as useCoinsData } from "@/hooks/use-coins";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { useUsdPrices, usdPriceFor } from "@/hooks/use-usd-prices";
import { coinHref as buildCoinHref } from "@/lib/routes";

function usePrice(coin: CoinCollectionLike) {
  const { price, isLoading } = useCoinPrice(coin.contractAddress);
  const usdPrices = useUsdPrices();
  const quoteUsdRate = price?.quoteSymbol ? usdPriceFor(usdPrices, price.quoteSymbol) : undefined;
  return { price: price ? { ...price, quoteUsdRate } : price, isLoading };
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
