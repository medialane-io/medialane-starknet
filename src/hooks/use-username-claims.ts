"use client";

import useSWR from "swr";
import { useWallet } from "@/hooks/use-wallet";
import { useSession } from "@/hooks/use-session";
import type { ApiCreatorProfile, ApiUsernameClaim } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";

export type { ApiUsernameClaim as UsernameClaim } from "@medialane/sdk";
export type { ApiCreatorProfile as CreatorByUsername };

export function useMyUsernameClaim() {
  const { address, isConnected } = useWallet();
  const { session } = useSession();

  const { data, error, isLoading, mutate } = useSWR(
    isConnected && address && session ? `username-claim-me-${address}` : null,
    () => getMedialaneClient().api.getMyUsernameClaim(),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { username: data?.username ?? null, claim: data?.claim ?? null, isLoading, error, mutate };
}

export function checkUsernameAvailability(username: string): Promise<{ available: boolean; reason?: string }> {
  return getMedialaneClient().api.checkUsernameAvailability(username);
}

export async function submitUsernameClaim(
  username: string,
  notifyEmail?: string
): Promise<{ claim?: ApiUsernameClaim; error?: string }> {
  try {
    return { claim: await getMedialaneClient().api.submitUsernameClaim(username, undefined, notifyEmail) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to submit claim" };
  }
}

