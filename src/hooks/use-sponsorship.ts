"use client";

import useSWR from "swr";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

const BASE = MEDIALANE_BACKEND_URL.replace(/\/$/, "");

async function backendFetch<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Backend fetch failed: ${res.status}`);
  return res.json();
}

export interface SponsorshipOffer {
  id: string;
  chain: string;
  sponsorshipContract: string;
  offerId: string;
  author: string;
  nftContract: string;
  tokenId: string;
  minAmount: string;
  duration: string;
  paymentToken: string;
  licenseTermsUri: string;
  transferable: boolean;
  specificSponsor: string | null;
  open: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SponsorshipBid {
  id: string;
  offerId: string;
  sponsor: string;
  amount: string;
  status: "ACTIVE" | "RETRACTED" | "ACCEPTED";
  updatedAt: string;
}

// ── useSponsorshipOffers ──────────────────────────────────────────────────────

export function useSponsorshipOffers(nftContract?: string) {
  const key = nftContract ? `sponsorship-offers-${nftContract}` : "sponsorship-offers";
  const { data, error, isLoading, mutate } = useSWR<{ data: SponsorshipOffer[]; meta: unknown }>(
    key,
    () => {
      const params = new URLSearchParams({ limit: "50" });
      if (nftContract) params.set("nftContract", nftContract);
      return backendFetch(`${BASE}/v1/sponsorship/offers?${params}`);
    },
    { revalidateOnFocus: false }
  );

  return { offers: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

// ── useSponsorshipOffer ───────────────────────────────────────────────────────

export function useSponsorshipOffer(offerId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: SponsorshipOffer }>(
    offerId ? `sponsorship-offer-${offerId}` : null,
    () => backendFetch(`${BASE}/v1/sponsorship/offers/${offerId}`),
    { revalidateOnFocus: false }
  );

  return { offer: data?.data ?? null, isLoading, error, mutate };
}

// ── useSponsorshipBids ────────────────────────────────────────────────────────

export function useSponsorshipBids(offerId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<{ data: SponsorshipBid[] }>(
    offerId ? `sponsorship-bids-${offerId}` : null,
    () => backendFetch(`${BASE}/v1/sponsorship/offers/${offerId}/bids`),
    { revalidateOnFocus: false }
  );

  return { bids: data?.data ?? [], isLoading, error, mutate };
}
