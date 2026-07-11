"use client";

import useSWR from "swr";
import { useWallet } from "@/hooks/use-wallet";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

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

  const { data, error, isLoading } = useSWR<GatedContent | "not_holder">(
    contract && isConnected && address ? ["gated-content", contract, address] : null,
    async () => {
      const url = new URL(
        `${MEDIALANE_BACKEND_URL}/v1/collections/${contract}/gated-content`
      );
      url.searchParams.set("address", address!);
      const res = await fetch(url.toString(), {
        headers: { "x-api-key": MEDIALANE_API_KEY },
      });
      if (res.status === 403) return "not_holder";
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  if (!isConnected || !address) return { status: "not_connected" };
  if (isLoading) return { status: "loading" };
  if (error) return { status: "error" };
  if (data === "not_holder" || data === undefined) return { status: "not_holder" };
  return { status: "unlocked", content: data };
}
