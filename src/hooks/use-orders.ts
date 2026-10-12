"use client";

import {
  useOrders as useOrdersBase,
  useTokenListings as useTokenListingsBase,
  useUserOrders as useUserOrdersBase,
  useCounterOffers as useCounterOffersBase,
  useReceivedOffers as useReceivedOffersBase,
} from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";
import type { ApiOrdersQuery } from "@medialane/sdk";


export function useOrders(query: ApiOrdersQuery = {}) {
  return useOrdersBase(getMedialaneClient, query);
}

export function useTokenListings(contract: string | null, tokenId: string | null) {
  return useTokenListingsBase(getMedialaneClient, contract, tokenId);
}

export function useUserOrders(address: string | null) {
  return useUserOrdersBase(getMedialaneClient, address);
}

export function useCounterOffers(args: { originalOrderHash?: string | null; sellerAddress?: string | null }) {
  return useCounterOffersBase(getMedialaneClient, args);
}

export function useReceivedOffers(address: string | null) {
  return useReceivedOffersBase(getMedialaneClient, address);
}

