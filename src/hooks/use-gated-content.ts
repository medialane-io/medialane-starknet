"use client";

import useSWR from "swr";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { getMedialaneClient } from "@/lib/medialane-client";

export interface GatedContent {
  title: string | null;
  url: string;
  type: string | null;
}

export type GatedContentState =
  | { status: "not_connected" }
  | { status: "loading" }
  | { status: "not_holder" }
  | { status: "unlocked"; content: GatedContent }
  | { status: "error" };

export function useGatedContent(contract: string | undefined): GatedContentState {
  const { address, isConnected } = useWallet();
  const { getValidToken } = useSiwsToken();

  const { data, error, isLoading } = useSWR<GatedContent | "not_holder">(
    contract && isConnected && address ? ["gated-content", contract, address] : null,
    async () => {
      const token = await getValidToken();
      if (!token) throw new Error("Wallet sign-in is required to unlock this content");
      const content = await getMedialaneClient().api.getGatedContent(contract!, token);
      return content ?? "not_holder";
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  if (!isConnected || !address) return { status: "not_connected" };
  if (isLoading) return { status: "loading" };
  if (error) return { status: "error" };
  if (data === "not_holder" || data === undefined) return { status: "not_holder" };
  return { status: "unlocked", content: data };
}
