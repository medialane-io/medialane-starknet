"use client";

import useSWR from "swr";
import { useMedialaneClient } from "./use-medialane-client";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import type { ApiCoin, ApiResponse } from "@medialane/sdk";

/**
 * List fungible coins from /v1/coins (the Coin model — separate from
 * Collections since the 2026-06-14 split). Price is read separately (Ekubo).
 */
export function useCoins(opts: { service?: string; page?: number; limit?: number } = {}) {
  const { service, page = 1, limit = 24 } = opts;
  const key = `coins-${page}-${limit}-${service ?? ""}`;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiCoin[]>>(
    key,
    async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (service) params.set("service", service);
      const url = `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/coins?${params}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Coins fetch failed: ${res.status}`);
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  return { coins: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

/** Single coin from /v1/coins/:contract. Pass null to skip the fetch. */
export function useCoin(contract: string | null) {
  const client = useMedialaneClient();

  const { data, error, isLoading, mutate } = useSWR(
    contract ? `coin-${contract}` : null,
    () => client.api.getCoin(contract!),
    { revalidateOnFocus: false }
  );

  return { coin: data?.data ?? null, isLoading, error, mutate };
}

/** Coins created by `address` — the "my coins" list (→ /v1/coins?creator=). */
export function useCoinsByCreator(address: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiCoin[]>>(
    address ? `coins-by-creator-${address}` : null,
    async () => {
      const params = new URLSearchParams({ creator: address!, limit: "100" });
      const url = `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/coins?${params}`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Coins fetch failed: ${res.status}`);
      return res.json();
    },
    { revalidateOnFocus: false }
  );
  return { coins: data?.data ?? [], isLoading, error, mutate };
}

/** PATCH a coin's creator-editable profile (image/description) via the BFF proxy. */
export async function updateCoinProfile(
  contract: string,
  data: { image?: string | null; description?: string | null },
  siwsToken: string
): Promise<ApiCoin> {
  const url = `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/coins/${contract}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${siwsToken}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body?.error ?? `Coin update failed: ${res.status}`);
  }
  return ((await res.json()) as { data: ApiCoin }).data;
}
