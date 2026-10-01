"use client";

import useSWR from "swr";
import { useMedialaneClient } from "./use-medialane-client";
import { getMedialaneClient } from "@/lib/medialane-client";
import type { ApiCoin, ApiResponse } from "@medialane/sdk";

export function useCoins(opts: { service?: string; sort?: string; page?: number; limit?: number } = {}) {
  const { service, sort, page = 1, limit = 24 } = opts;
  const key = `coins-${page}-${limit}-${service ?? ""}-${sort ?? ""}`;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiCoin[]>>(
    key,
    () => getMedialaneClient().api.getCoins({ page, limit, service, sort }),
    { revalidateOnFocus: false }
  );

  return { coins: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

export function useCoin(contract: string | null) {
  const client = useMedialaneClient();

  const { data, error, isLoading, mutate } = useSWR(
    contract ? `coin-${contract}` : null,
    () => client.api.getCoin(contract!),
    { revalidateOnFocus: false }
  );

  return { coin: data?.data ?? null, isLoading, error, mutate };
}

export function useCoinsByCreator(address: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiCoin[]>>(
    address ? `coins-by-creator-${address}` : null,
    () => getMedialaneClient().api.getCoins({ creator: address!, limit: 100 }),
    { revalidateOnFocus: false }
  );
  return { coins: data?.data ?? [], isLoading, error, mutate };
}

export async function updateCoinProfile(
  contract: string,
  data: { image?: string | null; description?: string | null },
  siwsToken: string
): Promise<ApiCoin> {
  return (await getMedialaneClient().api.updateCoinProfile(contract, data, siwsToken)).data;
}
