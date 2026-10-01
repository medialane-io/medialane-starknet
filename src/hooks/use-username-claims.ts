"use client";

import useSWR from "swr";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import type { ApiCreatorProfile, ApiUsernameClaim } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";

export type { ApiUsernameClaim as UsernameClaim } from "@medialane/sdk";
export type { ApiCreatorProfile as CreatorByUsername };

export function useMyUsernameClaim() {
  const { address, isConnected } = useWallet();
  const { token } = useSiwsToken();

  const { data, error, isLoading, mutate } = useSWR(
    isConnected && address && token ? `username-claim-me-${address}` : null,
    () => getMedialaneClient().api.getMyUsernameClaim(token!),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { username: data?.username ?? null, claim: data?.claim ?? null, isLoading, error, mutate };
}

export function checkUsernameAvailability(username: string): Promise<{ available: boolean; reason?: string }> {
  return getMedialaneClient().api.checkUsernameAvailability(username);
}

export async function submitUsernameClaim(
  username: string,
  siwsToken: string | null,
  notifyEmail?: string
): Promise<{ claim?: ApiUsernameClaim; error?: string }> {
  if (!siwsToken) return { error: "Sign in with your wallet to claim a username." };
  try {
    return { claim: await getMedialaneClient().api.submitUsernameClaim(username, siwsToken, notifyEmail) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit claim" };
  }
}

export function useCreatorByUsername(username: string | null | undefined) {
  const { data, error, isLoading } = useSWR(
    username ? `creator-by-username-${username}` : null,
    () => getMedialaneClient().api.getCreatorByUsername(username!),
    { revalidateOnFocus: false, revalidateOnMount: true }
  );
  return { creator: data ?? null, isLoading, error };
}
