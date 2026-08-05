"use client";

/**
 * useCoinSupply — total supply of a coin, from the indexed backend.
 *
 * Creator coins are fixed-supply (immutable after deploy) and Coin.totalSupply
 * is populated at index time (see medialane-backend's readTotalSupply). External
 * ERC-20s not yet claimed/added may still come through with totalSupply: null —
 * the caller hides the stat in that case, same as before.
 */

import useSWR from "swr";
import { getMedialaneClient } from "@/lib/medialane-client";

export interface UseCoinSupplyReturn {
  /** Raw total supply in base units, or null until loaded / unavailable. */
  raw: bigint | null;
  /** Human supply (raw / 10^decimals) as a number, or null. */
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
  // Divide the integer part as BigInt first to avoid Number overflow on large
  // (memecoin-scale) raw supplies, then coerce for display/market-cap math.
  const supply = raw !== null ? Number(raw / 10n ** BigInt(decimals)) : null;
  return { raw, supply, isLoading };
}
