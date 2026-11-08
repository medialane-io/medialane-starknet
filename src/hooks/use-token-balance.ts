"use client";

import useSWR from "swr";
import { getTokenBySymbol } from "@medialane/sdk";
import { erc20Balance } from "@medialane/sdk/starknet";
import { getMedialaneClient } from "@/lib/medialane-client";
import { formatTokenAmount } from "@/utils/swap-tokens";

export interface TokenBalanceResult {
  raw: bigint | null;
  formatted: string | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export async function readBalance(symbol: string, owner: string): Promise<bigint> {
  const token = getTokenBySymbol(symbol);
  if (!token) throw new Error(`Unknown token symbol: ${symbol}`);
  return erc20Balance(getMedialaneClient().provider, token.address, owner);
}

export function tokenBalanceKey(tokenSymbol: string, walletAddress: string | undefined) {
  return walletAddress ? (["token-balance", tokenSymbol, walletAddress] as const) : null;
}

export function useTokenBalance(
  tokenSymbol: string,
  walletAddress: string | undefined
): TokenBalanceResult {
  const { data, error, isLoading, mutate } = useSWR(
    tokenBalanceKey(tokenSymbol, walletAddress),
    ([, symbol, owner]) => readBalance(symbol, owner),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const raw = data ?? null;
  const decimals = getTokenBySymbol(tokenSymbol)?.decimals ?? 18;

  return {
    raw,
    formatted: raw !== null ? formatTokenAmount(raw, decimals) : null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to fetch balance") : null,
    refresh: () => void mutate(),
  };
}
