"use client";

import {
  useOrders as useOrdersBase,
  useTokenListings as useTokenListingsBase,
  useUserOrders as useUserOrdersBase,
  useCounterOffers as useCounterOffersBase,
  useReceivedOffers as useReceivedOffersBase,
} from "@medialane/ui";
import type { ApiOrdersQuery } from "@medialane/sdk";


export function useOrders(query: ApiOrdersQuery = {}) {
  return useOrdersBase(query);
}

export function useTokenListings(contract: string | null, tokenId: string | null) {
  return useTokenListingsBase(contract, tokenId);
}

export function useUserOrders(address: string | null) {
  return useUserOrdersBase(address);
}

export function useCounterOffers(args: { originalOrderHash?: string | null; sellerAddress?: string | null }) {
  return useCounterOffersBase(args);
}

export function useReceivedOffers(address: string | null) {
  return useReceivedOffersBase(address);
}

