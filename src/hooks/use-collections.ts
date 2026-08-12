"use client";

import useSWR from "swr";
import {
  useCollection as useCollectionBase,
  useCollectionsByOwner as useCollectionsByOwnerBase,
  useCollectionTokens as useCollectionTokensBase,
  useNearbyCollectionTokens as useNearbyCollectionTokensBase,
} from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import type { ApiCollection, ApiResponse, CollectionTokensSort } from "@medialane/sdk";

export type CollectionSort = "recent" | "supply" | "floor" | "volume" | "name";

/**
 * Stays app-local (not the @medialane/ui shared version) — this app needs a
 * `standard` filter and an SSR `fallback` seed that the SDK's `getCollections`
 * method doesn't support, so it hits `/v1/collections` directly instead of
 * going through the shared client.
 */
export function useCollections(
  page = 1,
  limit = 20,
  isFeatured?: boolean,
  sort: CollectionSort = "recent",
  hideEmpty = true,
  service?: string,
  standard?: string,
  fallback?: ApiCollection[]
) {
  const key = `collections-${page}-${limit}-${isFeatured}-${sort}-${hideEmpty}-${service ?? ""}-${standard ?? ""}`;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiCollection[]>>(
    key,
    async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort,
      });
      if (isFeatured !== undefined) params.set("isFeatured", String(isFeatured));
      if (hideEmpty) params.set("hideEmpty", "true");
      if (service) params.set("service", service);
      if (standard) params.set("standard", standard);
      const url = `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/collections?${params}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Collections fetch failed: ${res.status}`);
      return res.json();
    },
    {
      revalidateOnFocus: false,
      // Server-fetched seed (homepage hero) — first render shows real data,
      // SWR still revalidates in the background.
      ...(fallback ? { fallbackData: { data: fallback } as ApiResponse<ApiCollection[]> } : {}),
    }
  );

  return {
    collections: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    error,
    mutate,
  };
}

export function useCollection(contract: string | null) {
  return useCollectionBase(getMedialaneClient, contract);
}

export function useCollectionsByOwner(owner: string | null) {
  return useCollectionsByOwnerBase(getMedialaneClient, owner);
}

export function useCollectionTokens(
  contract: string | null,
  page = 1,
  limit = 24,
  sort: CollectionTokensSort = "recent"
) {
  return useCollectionTokensBase(getMedialaneClient, contract, page, limit, sort);
}

export function useNearbyCollectionTokens(
  contract: string | null,
  currentTokenId: string | null,
  count = 4,
  poolSize = 60
) {
  return useNearbyCollectionTokensBase(getMedialaneClient, contract, currentTokenId, count, poolSize);
}
