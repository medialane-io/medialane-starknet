"use client";

import useSWR from "swr";
import type { ApiRemixOffer, ApiResponse, ConfirmRemixOfferParams, ConfirmSelfRemixParams, CreateRemixOfferParams } from "@medialane/sdk";
import { useTokenRemixes as useTokenRemixesBase } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { getMedialaneClient } from "@/lib/medialane-client";

function requireToken(siwsToken: string | null): string {
  if (!siwsToken) throw new Error("Sign in with your wallet to continue.");
  return siwsToken;
}

export function useRemixOffers(role: "creator" | "requester", status?: string) {
  const { address: walletAddress } = useWallet();
  const { token } = useSiwsToken();

  const key = walletAddress && token ? `remix-offers-${role}-${status ?? "all"}-${walletAddress}` : null;

  const { data, error, isLoading, mutate } = useSWR<ApiResponse<ApiRemixOffer[]>>(
    key,
    () => getMedialaneClient().api.getRemixOffers({ role, status }, token!),
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
  return useTokenRemixesBase(getMedialaneClient, contract, tokenId);
}

export async function submitRemixOffer(body: CreateRemixOfferParams, siwsToken: string | null): Promise<ApiRemixOffer> {
  return (await getMedialaneClient().api.submitRemixOffer(body, requireToken(siwsToken))).data;
}

export async function registerRemix(body: ConfirmSelfRemixParams, siwsToken: string | null): Promise<ApiRemixOffer> {
  return (await getMedialaneClient().api.confirmSelfRemix(body, requireToken(siwsToken))).data;
}

export async function confirmRemixOffer(
  id: string,
  body: ConfirmRemixOfferParams,
  siwsToken: string | null
): Promise<ApiRemixOffer> {
  return (await getMedialaneClient().api.confirmRemixOffer(id, body, requireToken(siwsToken))).data;
}
