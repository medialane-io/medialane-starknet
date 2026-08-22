"use client";

import type { CoinCollectionLike } from "@medialane/ui";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { useUsdPrices, usdPriceFor } from "@/hooks/use-usd-prices";

export function useCoinPriceAdapter(coin: CoinCollectionLike) {
  const { price, isLoading } = useCoinPrice(coin.contractAddress);
  const usdPrices = useUsdPrices();
  const quoteUsdRate = price?.quoteSymbol ? usdPriceFor(usdPrices, price.quoteSymbol) : undefined;
  return { price: price ? { ...price, quoteUsdRate } : price, isLoading };
}
