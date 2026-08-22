"use client";

import type { CoinCollectionLike } from "@medialane/ui";
import { useCoinPrice } from "@/hooks/use-coin-price";

export function useCoinPriceAdapter(coin: CoinCollectionLike) {
  return useCoinPrice(coin);
}
