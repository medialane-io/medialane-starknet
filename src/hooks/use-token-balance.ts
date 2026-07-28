"use client";

/**
 * useTokenBalance — ERC20 token balance queries via direct on-chain reads.
 *
 * Fetches and formats a wallet's balance for a token by symbol (address +
 * decimals resolved from the SDK's SUPPORTED_TOKENS — single source, same as
 * `swap-tokens.ts`). Same failover-covered read provider (RPC path #1) used by
 * `useCoinSupply`.
 *
 * @example
 * ```tsx
 * const { formatted, isLoading, refresh } = useTokenBalance("STRK", address);
 * return <span>{isLoading ? "…" : formatted}</span>;
 * // "42.5 STRK"
 * ```
 */

import { useState, useEffect, useCallback } from "react";
import { getTokenBySymbol } from "@medialane/sdk";
import { starknetProvider } from "@/lib/starknet";
import { formatTokenAmount } from "@/utils/swap-tokens";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenBalanceResult {
  /** Raw bigint value in token base units (wei, fri, etc.) */
  raw: bigint | null;
  /** Human-readable string, e.g. "42.5" (up to 6 significant decimals) */
  formatted: string | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch the balance on demand */
  refresh: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

async function readBalance(tokenAddress: string, owner: string): Promise<bigint> {
  // Cairo ERC-20s expose the balance getter under either name depending on the
  // OpenZeppelin version (camelCase `balanceOf` or snake_case `balance_of`).
  let res: string[];
  try {
    res = await starknetProvider.callContract({ contractAddress: tokenAddress, entrypoint: "balanceOf", calldata: [owner] });
  } catch {
    res = await starknetProvider.callContract({ contractAddress: tokenAddress, entrypoint: "balance_of", calldata: [owner] });
  }
  // ERC-20 returns a u256 as [low, high].
  const low = BigInt(res[0] ?? "0");
  const high = BigInt(res[1] ?? "0");
  return low + (high << 128n);
}

/**
 * Fetch the ERC20 balance for a given token symbol and wallet address.
 *
 * @param tokenSymbol - A symbol from the SDK's SUPPORTED_TOKENS (e.g. "STRK", "ETH", "USDC")
 * @param walletAddress - The Starknet wallet address to query, or undefined
 */
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
