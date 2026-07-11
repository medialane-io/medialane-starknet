"use client";

import useSWR from "swr";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { type ApiCreatorProfile } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

export interface UsernameClaim {
  id: string;
  username: string;
  walletAddress: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export type { ApiCreatorProfile as CreatorByUsername };

/** Fetch the current user's username claim status. */
export function useMyUsernameClaim() {
  const { address, isConnected } = useWallet();
  const { token } = useSiwsToken();

  // Gate on token so we never auto-prompt the wallet to sign on mount.
  const { data, error, isLoading, mutate } = useSWR(
    isConnected && address && token ? `username-claim-me-${address}` : null,
    async () => {
      const headers: Record<string, string> = { "x-api-key": MEDIALANE_API_KEY };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${MEDIALANE_BACKEND_URL}/v1/username-claims/me`, { headers });
      if (!res.ok) throw new Error("Failed to fetch username claim");
      return res.json() as Promise<{ username: string | null; claim: UsernameClaim | null }>;
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  return { username: data?.username ?? null, claim: data?.claim ?? null, isLoading, error, mutate };
}

/** Check if a username is available (no auth required). */
export async function checkUsernameAvailability(
  username: string
): Promise<{ available: boolean; reason?: string }> {
  const res = await fetch(`${MEDIALANE_BACKEND_URL}/v1/username-claims/check/${encodeURIComponent(username)}`, {
    headers: { "x-api-key": MEDIALANE_API_KEY },
  });
  return res.json();
}

/** Submit a username claim. */
export async function submitUsernameClaim(
  username: string,
  siwsToken: string | null,
  notifyEmail?: string
): Promise<{ claim?: UsernameClaim; error?: string }> {
  const headers: Record<string, string> = {
    "x-api-key": MEDIALANE_API_KEY,
    "Content-Type": "application/json",
  };
  if (siwsToken) headers["Authorization"] = `Bearer ${siwsToken}`;
  const res = await fetch(`${MEDIALANE_BACKEND_URL}/v1/username-claims`, {
    method: "POST",
    headers,
    body: JSON.stringify({ username, ...(notifyEmail ? { notifyEmail } : {}) }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error ?? "Failed to submit claim" };
  return { claim: json.claim };
}

/** Resolve a username slug to a creator profile (public, no auth). */
export function useCreatorByUsername(username: string | null | undefined) {
  const { data, error, isLoading } = useSWR(
    username ? `creator-by-username-${username}` : null,
    () => getMedialaneClient().api.getCreatorByUsername(username!),
    { revalidateOnFocus: false, revalidateOnMount: true }
  );
  return { creator: data ?? null, isLoading, error };
}
