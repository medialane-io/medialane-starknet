"use client";

import useSWR from "swr";
import { getMedialaneClient } from "@/lib/medialane-client";
import type { ApiComment } from "@medialane/sdk";

interface UseCommentsResult {
  comments: ApiComment[];
  total: number;
  isLoading: boolean;
  error: unknown;
  mutate: () => void;
}

export function useComments(
  contract: string,
  tokenId: string,
  page = 1,
  limit = 20,
  /** false = fetch once but don't poll — for count-only callers (badges). The visible comments list keeps the default. */
  active = true
): UseCommentsResult {
  const { data, error, isLoading, mutate } = useSWR(
    contract && tokenId
      ? ["comments", contract, tokenId, page, limit]
      : null,
    () =>
      getMedialaneClient().api.getTokenComments(contract, tokenId, { page, limit }),
    {
      refreshInterval: active ? 15000 : 0,
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  return {
    comments: data?.data ?? [],
    total: data?.meta?.total ?? 0,
    isLoading,
    error,
    mutate,
  };
}
