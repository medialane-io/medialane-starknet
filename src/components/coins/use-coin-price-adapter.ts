"use client";

import type { CoinCollectionLike } from "@medialane/ui";
import { useCoinPrice } from "@medialane/ui";

export function useCoinPriceAdapter(coin: CoinCollectionLike) {
  return useCoinPrice(coin);
}
