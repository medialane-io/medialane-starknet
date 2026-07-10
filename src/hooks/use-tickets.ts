"use client";

import useSWR from "swr";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import type { ApiCollection, ApiToken } from "@medialane/sdk";

const BASE = MEDIALANE_BACKEND_URL.replace(/\/$/, "");

async function backendFetch<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Backend fetch failed: ${res.status}`);
  return res.json();
}

// ── useTicketCollections ──────────────────────────────────────────────────────

export function useTicketCollections() {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[]; meta: unknown }>(
    "ip-tickets-collections",
    () => {
      const params = new URLSearchParams({ service: "ip-tickets", limit: "50" });
      return backendFetch(`${BASE}/v1/collections?${params}`);
    },
    { revalidateOnFocus: false }
  );

  return { collections: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

// ── useMyTicketCollections ────────────────────────────────────────────────────

export function useMyTicketCollections(ownerAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiCollection[] }>(
    ownerAddress ? `my-ticket-collections-${ownerAddress}` : null,
    () => {
      const params = new URLSearchParams({ service: "ip-tickets", owner: ownerAddress!, limit: "50" });
      return backendFetch(`${BASE}/v1/collections?${params}`);
    },
    { revalidateOnFocus: false }
  );

  return { collections: data?.data ?? [], isLoading, error, mutate };
}

// ── useTicketEvents ───────────────────────────────────────────────────────────
// Returns indexed tokens for a ticket collection — each token ID = one event.
// Shows events that have had at least one mint (backend indexes TransferSingle).

export function useTicketEvents(contractAddress: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: ApiToken[]; meta: unknown }>(
    contractAddress ? `ticket-events-${contractAddress}` : null,
    () => backendFetch(`${BASE}/v1/collections/${contractAddress}/tokens?limit=50`),
    { revalidateOnFocus: false }
  );

  return { events: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

// ── useTicketValidity ─────────────────────────────────────────────────────────
// Pure on-chain read via the backend — true iff holder has balance > 0 AND within time window.

export function useTicketValidity(
  contractAddress: string | null,
  tokenId: string | null,
  wallet: string | null
) {
  const key =
    contractAddress && tokenId && wallet
      ? `ticket-validity-${contractAddress}-${tokenId}-${wallet}`
      : null;

  const { data, error, isLoading } = useSWR<{ data: { valid: boolean } }>(
    key,
    () => backendFetch(`${BASE}/v1/tickets/${contractAddress}/${tokenId}/validity/${wallet}`),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { valid: data?.data?.valid ?? false, isLoading, error };
}
