"use client";

import useSWR from "swr";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import type { ApiCollection } from "@medialane/sdk";

export interface DropMintStatus {
  mintedByWallet: number;
  totalMinted: number;
}

export interface DropConditions {
  maxSupply: string;
  price: string;
  paymentToken: string;
  startTime: number;
  endTime: number;
  maxPerWallet: string;
}

export interface ApiDropInfo {
  contractAddress: string;
  name: string | null;
  symbol: string | null;
  description: string | null;
  image: string | null;
  owner: string | null;
  totalMinted: number;
  conditions: DropConditions | null;
}

export type DropStatus = "upcoming" | "live" | "ended" | "sold_out";

export function getDropStatus(conditions: DropConditions | null, totalMinted: number): DropStatus {
  if (!conditions) return "live";
  const now = Math.floor(Date.now() / 1000);
  const max = parseInt(conditions.maxSupply, 10);
  if (max > 0 && totalMinted >= max) return "sold_out";
  if (now < conditions.startTime) return "upcoming";
  if (now > conditions.endTime) return "ended";
  return "live";
}

export function useDropCollections() {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[]; meta: any }>(
    "drop-collections",
    async () => {
      const params = new URLSearchParams({ service: "drop-collection", hideEmpty: "false", limit: "50" });
      const url = `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/collections?${params}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Drop collections fetch failed: ${res.status}`);
      return res.json();
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

export function useDropMintStatus(collection: string | null, wallet: string | null) {
  const key = collection && wallet ? `drop-mint-status-${collection}-${wallet}` : null;

  const { data, error, isLoading, mutate } = useSWR<DropMintStatus>(
    key,
    async () => {
      const url = `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/drop/mint-status/${collection}/${wallet}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Drop mint status fetch failed: ${res.status}`);
      const json = await res.json();
      return json.data;
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { mintStatus: data ?? null, isLoading, error, mutate };
}

export function useDropInfo(contractAddress: string | null) {
  const key = contractAddress ? `drop-info-${contractAddress}` : null;

  const { data, error, isLoading } = useSWR<ApiDropInfo>(
    key,
    async () => {
      const url = `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/drop/${contractAddress}/info`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Drop info fetch failed: ${res.status}`);
      const json = await res.json();
      return json.data;
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { dropInfo: data ?? null, isLoading, error };
}

export interface OnChainDropState {
  conditions: DropConditions | null;
  totalMinted: number;
  maxSupply: number;
  allowlistEnabled: boolean;
  paused: boolean;
}

// Reads live drop state (conditions/supply/allowlist/pause) — the chain is the
// only authority for these (architecture 01 §I). Served by the backend's
// metered GET /v1/drop/:contract/state pass-through
// (medialane-backend/src/api/routes/drop-onchain.ts), which does the same
// on-chain read server-side, credited, instead of the browser reading the
// chain directly. Replaces the old direct-RPC read that bypassed the credit
// gate entirely (and, before that, a fragile DB conditions mirror).
export function useOnChainDropState(contract: string | null) {
  const { data, error, isLoading, mutate } = useSWR<OnChainDropState>(
    contract ? `drop-onchain-${contract}` : null,
    async () => {
      const res = await fetch(`/api/proxy/v1/drop/${contract}/state`);
      if (!res.ok) throw new Error(`Drop on-chain state fetch failed: ${res.status}`);
      const json = await res.json();
      return json.data;
    },
    { revalidateOnFocus: false, refreshInterval: 30_000, shouldRetryOnError: false }
  );

  return { state: data ?? null, isLoading, error, mutate };
}
