"use client";

import useSWR from "swr";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import type { ApiCollection } from "@medialane/sdk";

const BASE = MEDIALANE_BACKEND_URL.replace(/\/$/, "");

async function backendFetch<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Backend fetch failed: ${res.status}`);
  return res.json();
}

export function usePopCollections() {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[]; meta: unknown }>(
    "pop-collections",
    () => {
      const params = new URLSearchParams({ service: "pop-protocol", hideEmpty: "false", limit: "50" });
      const url = `${BASE}/v1/collections?${params}`;
      return backendFetch(url);
    },
    { revalidateOnFocus: false }
  );

  return {
    collections: data?.data ?? [],
    meta: data?.meta,
    isLoading,
    error,
    mutate,
  };
}

export interface PopClaimStatus {
  isEligible: boolean;
  hasClaimed: boolean;
  tokenId: string | null;
}

export function usePopClaimStatus(collection: string | null, wallet: string | null) {
  const key = collection && wallet ? `pop-eligibility-${collection}-${wallet}` : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: PopClaimStatus }>(
    key,
    () => {
      const url = `${BASE}/v1/pop/eligibility/${collection}/${wallet}`;
      return backendFetch(url);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { claimStatus: data?.data ?? null, isLoading, error, mutate };
}

export function useMyEvents(ownerAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[] }>(
    ownerAddress ? `my-pop-events-${ownerAddress}` : null,
    () => {
      const params = new URLSearchParams({ service: "pop-protocol", owner: ownerAddress!, limit: "50" });
      const url = `${BASE}/v1/collections?${params}`;
      return backendFetch(url);
    },
    { revalidateOnFocus: false }
  );

  return {
    events: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}
