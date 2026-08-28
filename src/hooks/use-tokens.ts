"use client";

import { useState } from "react";
import useSWR from "swr";
import { useMedialaneClient } from "./use-medialane-client";
import type { ApiToken, ApiResponse } from "@medialane/sdk";

const EMPTY_TOKENS: ApiToken[] = [];

// The backend reads through to the chain on a miss, so a 404 here normally
// means the token really does not exist. It can still appear transiently when
// that chain read times out or the RPC is unavailable, in which case the token
// may well exist and the answer will change on its own. So a 404 is shown as a
// pending state and retried briefly, rather than reported as a missing asset —
// the case that turned a successful mint into "Token not found".
const INDEXING_POLL_MS = 10_000;
const INDEXING_WINDOW_MS = 60_000;

function isNotIndexedYet(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as { status?: unknown }).status === 404,
  );
}

export function useToken(contract: string | null, tokenId: string | null) {
  const client = useMedialaneClient();
  const [startedAt] = useState(() => Date.now());

  const { data, error, isLoading, mutate } = useSWR(
    contract && tokenId ? `token-${contract}-${tokenId}` : null,
    () => client.api.getToken(contract!, tokenId!),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      refreshInterval: (latest) =>
        latest?.data || Date.now() - startedAt > INDEXING_WINDOW_MS ? 0 : INDEXING_POLL_MS,
    }
  );

  const token = data?.data ?? null;
  const withinWindow = Date.now() - startedAt <= INDEXING_WINDOW_MS;

  return {
    token,
    isLoading,
    isIndexing: !token && isNotIndexedYet(error) && withinWindow,
    error: isNotIndexedYet(error) ? undefined : error,
    mutate,
  };
}

export function useTokensByOwner(address: string | null, page = 1, limit = 20) {
  const client = useMedialaneClient();

  const { data, error, isLoading, mutate } = useSWR(
    // limit belongs in the key: it changes the response, and several places
    // read this address and page with different page sizes at the same time —
    // the account panel asks for 1 to show a count while the portfolio grid
    // asks for 20 to render them. Sharing one cache entry let whichever
    // fetched first decide what the other one saw.
    address ? `tokens-owned-${address}-${page}-${limit}` : null,
    () => client.api.getTokensByOwner(address!, page, limit),
    { revalidateOnFocus: false, refreshInterval: 30_000, revalidateOnMount: true }
  );

  return {
    tokens: data?.data ?? EMPTY_TOKENS,
    meta: data?.meta,
    isLoading,
    error,
    mutate,
  };
}

export function useTokenHistory(contract: string | null, tokenId: string | null) {
  const client = useMedialaneClient();

  const { data, error, isLoading } = useSWR(
    contract && tokenId ? `token-history-${contract}-${tokenId}` : null,
    () => client.api.getTokenHistory(contract!, tokenId!),
    { revalidateOnFocus: false }
  );

  return { history: data?.data ?? [], isLoading, error };
}
