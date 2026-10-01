"use client";

import useSWR from "swr";
import type { ApiSponsorshipOffer, ApiSponsorshipBid, ApiSponsorshipProposal, ApiSponsorshipLicense, ApiResponse } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";

export type {
  ApiSponsorshipOffer as SponsorshipOffer,
  ApiSponsorshipBid as SponsorshipBid,
  ApiSponsorshipProposal as SponsorshipProposal,
  ApiSponsorshipLicense as SponsorshipLicense,
} from "@medialane/sdk";

const api = () => getMedialaneClient().api;

export function useSponsorshipOffers(params?: { nftContract?: string; author?: string; owner?: string; open?: boolean }) {
  const key = `sponsorship-offers-${JSON.stringify(params ?? {})}`;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiSponsorshipOffer[]>>(
    key,
    () => api().getSponsorshipOffers({ ...params, limit: 50 }),
    { revalidateOnFocus: false }
  );

  return { offers: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

export function useSponsorshipOffer(offerId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiSponsorshipOffer | null>(
    offerId ? `sponsorship-offer-${offerId}` : null,
    () => api().getSponsorshipOffer(offerId!),
    { revalidateOnFocus: false }
  );

  return { offer: data ?? null, isLoading, error, mutate };
}

export function useSponsorshipBids(offerId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiSponsorshipBid[]>(
    offerId ? `sponsorship-bids-${offerId}` : null,
    () => api().getSponsorshipBids(offerId!),
    { revalidateOnFocus: false }
  );

  return { bids: data ?? [], isLoading, error, mutate };
}

export function useSponsorshipProposals(params?: { nftContract?: string; proposer?: string; owner?: string; open?: boolean }) {
  const key = `sponsorship-proposals-${JSON.stringify(params ?? {})}`;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiSponsorshipProposal[]>>(
    key,
    () => api().getSponsorshipProposals({ ...params, limit: 50 }),
    { revalidateOnFocus: false }
  );

  return { proposals: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

export function useSponsorshipProposal(proposalId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<ApiSponsorshipProposal | null>(
    proposalId ? `sponsorship-proposal-${proposalId}` : null,
    () => api().getSponsorshipProposal(proposalId!),
    { revalidateOnFocus: false }
  );

  return { proposal: data ?? null, isLoading, error, mutate };
}

export function usePendingProposalsForAsset(nftContract: string | null) {
  const { proposals, isLoading, error, mutate } = useSponsorshipProposals(
    nftContract ? { nftContract, open: true } : undefined
  );
  return { proposals: nftContract ? proposals : [], isLoading, error, mutate };
}

export function useSponsorshipLicenses(params?: { holder?: string; author?: string }) {
  const key = `sponsorship-licenses-${JSON.stringify(params ?? {})}`;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiSponsorshipLicense[]>>(
    key,
    () => api().getSponsorshipLicenses({ ...params, limit: 50 }),
    { revalidateOnFocus: false }
  );

  return { licenses: data?.data ?? [], meta: data?.meta, isLoading, error, mutate };
}

export function useMySponsorshipDealCounts(walletAddress: string | null) {
  const { proposals, isLoading: proposalsLoading } = useSponsorshipProposals(
    walletAddress ? { owner: walletAddress, open: true } : undefined
  );
  const { offers, isLoading: offersLoading } = useSponsorshipOffers(
    walletAddress ? { author: walletAddress, open: true } : undefined
  );

  void offers;
  return { pendingCount: proposals.length, isLoading: proposalsLoading || offersLoading };
}
