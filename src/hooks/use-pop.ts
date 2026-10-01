"use client";

import useSWR from "swr";
import type { ApiCollection, ApiMeta, PopClaimStatus } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";

export type { PopClaimStatus };

export function usePopCollections() {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[]; meta?: ApiMeta }>(
    "pop-collections",
    () => getMedialaneClient().api.listCollections({ service: "pop-protocol", hideEmpty: false, limit: 50 }),
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

export function usePopClaimStatus(collection: string | null, wallet: string | null) {
  const key = collection && wallet ? `pop-eligibility-${collection}-${wallet}` : null;
  const { data, error, isLoading, mutate } = useSWR<PopClaimStatus>(
    key,
    () => getMedialaneClient().api.getPopEligibility(collection!, wallet!),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return { claimStatus: data ?? null, isLoading, error, mutate };
}

export function useMyEvents(ownerAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[] }>(
    ownerAddress ? `my-pop-events-${ownerAddress}` : null,
    () => getMedialaneClient().api.listCollections({ service: "pop-protocol", owner: ownerAddress!, limit: 50 }),
    { revalidateOnFocus: false }
  );

  return {
    events: data?.data ?? [],
    isLoading,
    error,
    mutate,
  };
}
