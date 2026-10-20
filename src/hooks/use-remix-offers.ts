"use client";

import useSWR from "swr";
import type { ApiRemixOffer, ApiResponse, ConfirmRemixOfferParams, ConfirmSelfRemixParams, CreateRemixOfferParams } from "@medialane/sdk";
import { useTokenRemixes as useTokenRemixesBase } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useSession } from "@/hooks/use-session";
import { requireSignedIn } from "@/lib/account-gate";
import { getMedialaneClient } from "@/lib/medialane-client";

export function useRemixOffers(role: "creator" | "requester", status?: string) {
  const { address: walletAddress } = useWallet();
  const { session } = useSession();

  const key = walletAddress && session ? `remix-offers-${role}-${status ?? "all"}-${walletAddress}` : null;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiRemixOffer[]>>(
    key,
    async () => {
      requireSignedIn(session);
      return getMedialaneClient().api.getRemixOffers({ role, status });
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

  return { offers: data?.data ?? [], total: data?.meta?.total ?? 0, isLoading, error, mutate };
}

export function useTokenRemixes(contract: string | null, tokenId: string | null) {
  return useTokenRemixesBase(contract, tokenId);
}

export async function submitRemixOffer(body: CreateRemixOfferParams): Promise<ApiRemixOffer> {
  return (await getMedialaneClient().api.submitRemixOffer(body)).data;
}

export async function registerRemix(body: ConfirmSelfRemixParams): Promise<ApiRemixOffer> {
  return (await getMedialaneClient().api.confirmSelfRemix(body)).data;
}

export async function confirmRemixOffer(id: string, body: ConfirmRemixOfferParams): Promise<ApiRemixOffer> {
  return (await getMedialaneClient().api.confirmRemixOffer(id, body)).data;
}
