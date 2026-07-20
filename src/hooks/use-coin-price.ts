"use client";

/**
 * useCoinPrice — live Creator Coin spot price, read directly from its Ekubo pool.
 *
 * Thin SWR wrapper over the SDK's `getCreatorCoinPrice` (the single source of the
 * Ekubo price math — see @medialane/sdk). Self-contained and read-only: works
 * day-one for fresh coins that AVNU hasn't indexed yet, because it reads
 * `Core.get_pool_price` straight from the chain via the shared read provider.
 *
 * Returns `price: null` (not an error) when the coin isn't launched on Ekubo.
 */

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
      refreshInterval: 30_000, // spot price refresh; read-only, cheap RPC call
      shouldRetryOnError: false,
    }
  );

  return { price: data ?? null, isLoading, error, mutate };
}
