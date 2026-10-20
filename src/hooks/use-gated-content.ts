"use client";

import useSWR from "swr";
import type { GatedContent, GatedContentState } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useAccountSession } from "@/components/wallet-session-sync";
import { getMedialaneClient } from "@/lib/medialane-client";

export function useGatedContent(contract: string | undefined): GatedContentState {
  const { address, isConnected } = useWallet();
  const { session } = useAccountSession();

  const { data, error, isLoading } = useSWR<GatedContent | "not_holder">(
    contract && isConnected && address && session ? ["gated-content", contract, address] : null,
    async () => {
      const content = await getMedialaneClient().api.getGatedContent(contract!);
      return content ?? "not_holder";
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  if (!isConnected || !address) return { status: "signed_out" };
  if (isLoading) return { status: "loading" };
  if (error) return { status: "error" };
  if (data === "not_holder" || data === undefined) return { status: "not_holder" };
  return { status: "unlocked", content: data };
}
