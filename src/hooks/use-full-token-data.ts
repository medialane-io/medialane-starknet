"use client";

import useSWR from "swr";
import type { ApiIpNftTokenData } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";

export type { ApiIpNftTokenData as FullTokenData } from "@medialane/sdk";

interface UseFullTokenDataArgs {
  ipNftAddress: string | undefined;
  tokenId: bigint | undefined;
}

export function useFullTokenData({ ipNftAddress, tokenId }: UseFullTokenDataArgs) {
  const enabled = Boolean(ipNftAddress && tokenId !== undefined);

  const { data, error, isLoading } = useSWR<ApiIpNftTokenData | null>(
    enabled ? ["full-token-data", ipNftAddress, tokenId!.toString()] : null,
    () => getMedialaneClient().api.getIpNftTokenData(ipNftAddress!, tokenId!.toString()),
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  return { data: data ?? null, isLoading, error };
}
