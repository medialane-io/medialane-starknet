"use client";

/**
 * useCoinBalance — an owner's ERC-20 balance for an arbitrary Creator Coin.
 *
 * The StarkZap balance hook (`useTokenBalance`) only covers the four preset
 * quote tokens (STRK/ETH/USDC/USDT). A Creator Coin has a dynamic per-coin
 * address, so its balance is read here straight from the chain via the shared
 * failover-covered read provider (RPC path #1) — the same pattern as
 * `useCoinPrice`. Read-only, SWR-cached, refreshes on a slow interval.
 */

import useSWR from "swr";
import { starknetProvider } from "@/lib/starknet";
import { formatTokenAmount } from "@/utils/avnu-swap";

export interface UseCoinBalanceReturn {
  /** Raw balance in token base units (18 decimals), or null until loaded. */
  raw: bigint | null;
  /** Human-formatted balance string, or null until loaded. */
  formatted: string | null;
  isLoading: boolean;
  mutate: () => void;
}

async function readBalance(coinAddress: string, owner: string): Promise<bigint> {
  // Cairo ERC-20s expose the balance getter under either name depending on the
  // OpenZeppelin version (camelCase `balanceOf` or snake_case `balance_of`).
  let res: string[];
  try {
    res = await starknetProvider.callContract({ contractAddress: coinAddress, entrypoint: "balanceOf", calldata: [owner] });
  } catch {
    res = await starknetProvider.callContract({ contractAddress: coinAddress, entrypoint: "balance_of", calldata: [owner] });
  }
  // ERC-20 returns a u256 as [low, high].
  const low = BigInt(res[0] ?? "0");
  const high = BigInt(res[1] ?? "0");
  return low + (high << 128n);
}

export function useCoinBalance(
  coinAddress?: string | null,
  owner?: string | null
): UseCoinBalanceReturn {
  const { data, isLoading, mutate } = useSWR<bigint>(
    coinAddress && owner ? `coin-balance-${coinAddress}-${owner}` : null,
    () => readBalance(coinAddress as string, owner as string),
    { revalidateOnFocus: false, refreshInterval: 30_000, shouldRetryOnError: false }
  );

  const raw = data ?? null;
  return {
    raw,
    formatted: raw !== null ? formatTokenAmount(raw, 18) : null,
    isLoading,
    mutate,
  };
}
