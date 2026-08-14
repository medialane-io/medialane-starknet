"use client";

import useSWR from "swr";
import { getCreatorCoinPrice, type CreatorCoinPrice } from "@medialane/sdk/starknet";
import { starknetProvider } from "@/lib/starknet";

export interface UseCoinPriceReturn {
  price: CreatorCoinPrice | null;
  isLoading: boolean;
  error: unknown;
  mutate: () => void;
}

export function useCoinPrice(coinAddress?: string | null): UseCoinPriceReturn {
  const { data, error, isLoading, mutate } = useSWR<CreatorCoinPrice | null>(
    coinAddress ? `coin-price-${coinAddress}` : null,
    () => getCreatorCoinPrice(coinAddress as string, starknetProvider),
    {
      revalidateOnFocus: false,
      refreshInterval: 30_000,
      shouldRetryOnError: false,
    }
  );

  return { price: data ?? null, isLoading, error, mutate };
}
