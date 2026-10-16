"use client";

import { useState, useEffect, useCallback } from "react";
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

const readBalance = (tokenAddress: string, owner: string): Promise<bigint> =>
  erc20Balance(getMedialaneClient().provider, tokenAddress, owner);

export function useTokenBalance(
  tokenSymbol: string,
  walletAddress: string | undefined
): TokenBalanceResult {
  const [raw, setRaw] = useState<bigint | null>(null);
  const [decimals, setDecimals] = useState<number>(18);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setRaw(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = getTokenBySymbol(tokenSymbol);
      if (!token) throw new Error(`Unknown token symbol: ${tokenSymbol}`);
      setDecimals(token.decimals);
      const result = await readBalance(token.address, walletAddress);
      setRaw(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balance");
    } finally {
      setIsLoading(false);
    }
  }, [tokenSymbol, walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    raw,
    formatted: raw !== null ? formatTokenAmount(raw, decimals) : null,
    isLoading,
    error,
    refresh: fetchBalance,
  };
}
