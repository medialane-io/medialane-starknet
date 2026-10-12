"use client";

import useSWR from "swr";
import type { ApiSession, ApiSwapQuote } from "@medialane/sdk";
import { getMedialaneClient } from "@/lib/medialane-client";
import { useSession } from "@/hooks/use-session";

export type SwapQuoteSummary = ApiSwapQuote;

function fetchQuote(
  sellSymbol: string,
  buySymbol: string,
  buyAmountRaw: string,
  takerAddress: string | null
): Promise<SwapQuoteSummary> {
  return getMedialaneClient().api.getSwapQuote({ sellSymbol, buySymbol, buyAmountRaw, takerAddress: takerAddress ?? undefined });
}

export function swapQuoteKey(
  session: ApiSession | null,
  sellSymbol: string | null,
  buySymbol: string | null,
  buyAmountRaw: string | null,
  takerAddress: string | null
) {
  return session && sellSymbol && buySymbol && buyAmountRaw
    ? (["swap-quote", sellSymbol, buySymbol, buyAmountRaw, takerAddress] as const)
    : null;
}

export function useSwapQuote(
  sellSymbol: string | null,
  buySymbol: string | null,
  buyAmountRaw: string | null,
  takerAddress: string | null
) {
  const { session } = useSession();
  const { data, error, isLoading } = useSWR(
    swapQuoteKey(session, sellSymbol, buySymbol, buyAmountRaw, takerAddress),
    ([, sell, buy, amount, taker]) => fetchQuote(sell, buy, amount, taker),
    {
      refreshInterval: 20_000,
      dedupingInterval: 15_000,
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );
  return { quote: data ?? null, isLoading, error: error as Error | undefined };
}
