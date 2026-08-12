"use client";

import useSWR from "swr";
import { useTokenRemixes as useTokenRemixesBase } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import type { RemixOffer, RemixOfferListResponse } from "@/types/remix-offers";

const apiConfig = { baseUrl: MEDIALANE_BACKEND_URL, apiKey: MEDIALANE_API_KEY };

async function apiFetch(
  url: string,
  apiKey: string,
  siwsToken: string | null,
  options?: RequestInit,
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  };
  if (siwsToken) headers["Authorization"] = `Bearer ${siwsToken}`;
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function useRemixOffers(role: "creator" | "requester", status?: string) {
  const { address: walletAddress } = useWallet();
  const { token } = useSiwsToken();

  // Only fetch when a valid SIWS token is already stored — never auto-prompt.
  const key = walletAddress && token ? `remix-offers-${role}-${status ?? "all"}-${walletAddress}` : null;

  const { data, error, isLoading, mutate } = useSWR<RemixOfferListResponse>(
    key,
    async () => {
      const params = new URLSearchParams({ role, ...(status ? { status } : {}) });
      return apiFetch(
        `${MEDIALANE_BACKEND_URL}/v1/remix-offers?${params}`,
        MEDIALANE_API_KEY,
        token,
      ) as Promise<RemixOfferListResponse>;
    },
    {
      refreshInterval: 30000,
      revalidateOnFocus: false,
      onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
        if (retryCount >= 2) return;
        setTimeout(() => revalidate({ retryCount }), 5000);
      },
    }
  );

  return { offers: data?.data ?? [], total: data?.meta.total ?? 0, isLoading, error, mutate };
}

export function useTokenRemixes(contract: string | null, tokenId: string | null) {
  return useTokenRemixesBase(apiConfig, contract, tokenId);
}

async function authedFetch(url: string, token: string | null, options?: RequestInit): Promise<unknown> {
  return apiFetch(url, MEDIALANE_API_KEY, token, options);
}

export async function submitRemixOffer(
  body: {
    originalContract: string;
    originalTokenId: string;
    proposedPrice: string;
    proposedCurrency: string;
    licenseType: string;
    commercial: boolean;
    derivatives: boolean;
    royaltyPct?: number;
    message?: string;
    expiresInDays?: number;
  },
  siwsToken: string | null
): Promise<RemixOffer> {
  const res = await authedFetch(`${MEDIALANE_BACKEND_URL}/v1/remix-offers`, siwsToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (res as { data: RemixOffer }).data;
}

export async function submitAutoRemixOffer(
  body: { originalContract: string; originalTokenId: string },
  siwsToken: string | null
): Promise<RemixOffer> {
  const res = await authedFetch(`${MEDIALANE_BACKEND_URL}/v1/remix-offers/auto`, siwsToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (res as { data: RemixOffer }).data;
}

/** Record a permissionless self-minted remix (provenance). */
export async function registerRemix(
  body: {
    originalContract: string;
    originalTokenId: string;
    remixContract: string;
    remixTokenId: string;
    txHash: string;
    licenseType: string;
    commercial: boolean;
    derivatives: boolean;
    royaltyPct?: number;
  },
  siwsToken: string | null
): Promise<RemixOffer> {
  const res = await authedFetch(`${MEDIALANE_BACKEND_URL}/v1/remix-offers/self/confirm`, siwsToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (res as { data: RemixOffer }).data;
}

export async function confirmRemixOffer(
  id: string,
  body: { remixContract: string; remixTokenId: string; approvedCollection: string; orderHash: string },
  siwsToken: string | null
): Promise<RemixOffer> {
  const res = await authedFetch(`${MEDIALANE_BACKEND_URL}/v1/remix-offers/${id}/confirm`, siwsToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (res as { data: RemixOffer }).data;
}

export async function rejectRemixOffer(id: string, siwsToken: string | null): Promise<RemixOffer> {
  const res = await authedFetch(`${MEDIALANE_BACKEND_URL}/v1/remix-offers/${id}/reject`, siwsToken, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return (res as { data: RemixOffer }).data;
}
