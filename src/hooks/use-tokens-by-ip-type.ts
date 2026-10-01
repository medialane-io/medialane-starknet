"use client";

import useSWR from "swr";
import { getMedialaneClient } from "@/lib/medialane-client";
import type { ApiToken, ApiResponse } from "@medialane/sdk";

export function useTokensByIpType(
  ipTypeSlug: string | null,
  page = 1,
  limit = 24
) {

  const key = `tokens-by-type-${ipTypeSlug ?? "all"}-${page}-${limit}`;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiToken[]>>(
    key,
    () => getMedialaneClient().api.getTokens({ page, limit, sort: "recent", ipType: ipTypeSlug ?? undefined }),
    { revalidateOnFocus: false, refreshInterval: 30000 }
  );

  return {
    tokens: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    error,
    mutate,
  };
}
