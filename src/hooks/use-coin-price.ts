"use client";

import useSWR from "swr";
import { getCreatorCoinMarket, type CreatorCoinMarket, type CreatorCoinPrice } from "@medialane/sdk/starknet";
import type { CoinMarketStatus } from "@medialane/ui";
import { starknetProvider } from "@/lib/starknet";

export interface UseCoinPriceReturn {
  price: CreatorCoinPrice | null;
  status: CoinMarketStatus;
  isLoading: boolean;
  error: unknown;
  mutate: () => void;
}

export function useCoinPrice(coinAddress?: string | null): UseCoinPriceReturn {
  const { data, error, isLoading, mutate } = useSWR<CreatorCoinMarket>(
    coinAddress ? `coin-market-${coinAddress}` : null,
    () => getCreatorCoinMarket(coinAddress as string, starknetProvider),
    {
      revalidateOnFocus: false,
      refreshInterval: 30_000,
      shouldRetryOnError: false,
    }
  );

  const status: CoinMarketStatus = data?.status === "live"
    ? "live"
    : data?.status === "pre-launch"
      ? "pre-launch"
      : "unavailable";

  return {
    price: data?.status === "live" ? data.price : null,
    status,
    isLoading,
    error,
    mutate,
  };
}
