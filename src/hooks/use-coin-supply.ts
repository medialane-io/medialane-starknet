"use client";

import useSWR from "swr";
import { getMedialaneClient } from "@/lib/medialane-client";

export interface UseCoinSupplyReturn {

  raw: bigint | null;

  supply: number | null;
  isLoading: boolean;
}

export function useCoinSupply(coinAddress?: string | null, decimals = 18): UseCoinSupplyReturn {
  const { data, isLoading } = useSWR<bigint | null>(
    coinAddress ? `coin-supply-${coinAddress}` : null,
    async () => {
      const res = await getMedialaneClient().api.getCoin(coinAddress as string);
      return res.data.totalSupply ? BigInt(res.data.totalSupply) : null;
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const raw = data ?? null;

  const supply = raw !== null ? Number(raw / 10n ** BigInt(decimals)) : null;
  return { raw, supply, isLoading };
}
