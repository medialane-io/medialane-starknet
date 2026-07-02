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

// ── useTicketStatus ────────────────────────────────────────────────────────────

export interface TicketStatus {
  hasValidTicket: boolean;
  activeBalance: number;
}

export function useTicketStatus(
  collectionAddress: string | null,
  ticketCollectionId: string | null,
  wallet: string | null
) {
  const key =
    collectionAddress && ticketCollectionId && wallet
      ? `ticket-status-${collectionAddress}-${ticketCollectionId}-${wallet}`
      : null;

  const { data, error, isLoading, mutate } = useSWR<{ data: TicketStatus }>(
    key,
    () => backendFetch(`${BASE}/v1/tickets/${collectionAddress}/${ticketCollectionId}/status/${wallet}`),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { status: data?.data ?? null, isLoading, error, mutate };
}
