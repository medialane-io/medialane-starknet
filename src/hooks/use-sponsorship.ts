"use client";

import * as ui from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export type {
  ApiSponsorshipOffer as SponsorshipOffer,
  ApiSponsorshipBid as SponsorshipBid,
  ApiSponsorshipProposal as SponsorshipProposal,
  ApiSponsorshipLicense as SponsorshipLicense,
} from "@medialane/sdk";

type OffersQuery = Parameters<typeof ui.useSponsorshipOffers>[1];
type ProposalsQuery = Parameters<typeof ui.useSponsorshipProposals>[1];
type LicensesQuery = Parameters<typeof ui.useSponsorshipLicenses>[1];

export const useSponsorshipOffers = (params?: OffersQuery) => ui.useSponsorshipOffers(getMedialaneClient, params);
export const useSponsorshipOffer = (offerId: string | null) => ui.useSponsorshipOffer(getMedialaneClient, offerId);
export const useSponsorshipBids = (offerId: string | null) => ui.useSponsorshipBids(getMedialaneClient, offerId);
export const useSponsorshipProposals = (params?: ProposalsQuery) => ui.useSponsorshipProposals(getMedialaneClient, params);
export const useSponsorshipProposal = (proposalId: string | null) => ui.useSponsorshipProposal(getMedialaneClient, proposalId);
export const usePendingProposalsForAsset = (nftContract: string | null) =>
  ui.usePendingProposalsForAsset(getMedialaneClient, nftContract);
export const useSponsorshipLicenses = (params?: LicensesQuery) => ui.useSponsorshipLicenses(getMedialaneClient, params);
export const useMySponsorshipDealCounts = (walletAddress: string | null) =>
  ui.useMySponsorshipDealCounts(getMedialaneClient, walletAddress);
