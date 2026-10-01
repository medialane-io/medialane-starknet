"use client";

import useSWR from "swr";
import type { ApiCollection, ApiDropInfo, ApiDropState, ApiMeta, DropMintStatus } from "@medialane/sdk";
import { getDropStatus, type DropConditions, type DropStatus } from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export { getDropStatus };
export type { DropConditions, DropStatus, DropMintStatus, ApiDropInfo };
export type OnChainDropState = ApiDropState;

export function useDropCollections() {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[]; meta?: ApiMeta }>(
    "drop-collections",
    () => getMedialaneClient().api.listCollections({ service: "drop-collection", hideEmpty: false, limit: 50 }),
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

export function useDropMintStatus(collection: string | null, wallet: string | null) {
  const key = collection && wallet ? `drop-mint-status-${collection}-${wallet}` : null;
  const { data, error, isLoading, mutate } = useSWR<DropMintStatus>(
    key,
    () => getMedialaneClient().api.getDropMintStatus(collection!, wallet!),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return { mintStatus: data ?? null, isLoading, error, mutate };
}

export function useDropInfo(contractAddress: string | null) {
  const key = contractAddress ? `drop-info-${contractAddress}` : null;
  const { data, error, isLoading } = useSWR<ApiDropInfo | null>(
    key,
    () => getMedialaneClient().api.getDropInfo(contractAddress!),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return { dropInfo: data ?? null, isLoading, error };
}

export function useOnChainDropState(contract: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OnChainDropState>(
    contract ? `drop-onchain-${contract}` : null,
    () => getMedialaneClient().api.getDropState(contract!),
    { revalidateOnFocus: false, refreshInterval: 30_000, shouldRetryOnError: false }
  );
  return { state: data ?? null, isLoading, error, mutate };
}
