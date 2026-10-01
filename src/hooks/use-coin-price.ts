"use client";

import { usePriceMap as usePriceMapBase, useCoinPrice as useCoinPriceBase, type CoinCollectionLike } from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export const usePriceMap = () => usePriceMapBase(getMedialaneClient);
export const useCoinPrice = (coin: CoinCollectionLike) => useCoinPriceBase(getMedialaneClient, coin);
