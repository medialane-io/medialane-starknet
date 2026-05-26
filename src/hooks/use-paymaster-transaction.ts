"use client";

/**
 * usePaymasterTransaction — generic AVNU Paymaster execution hook.
 *
 * Provides three execution modes for any set of Starknet calls:
 *  1. executeGasless(calls, gasTokenAddress, maxAmount) — user pays with alt token
 *  2. executeSponsored(calls)                           — Medialane pays via API key
 *  3. executeTraditional(calls)                         — normal account.execute()
 *
 * Usage:
 * ```tsx
 * const { executeGasless, executeSponsored, executeTraditional,
 *         isLoading, gasTokenPrices, isGaslessCompatible } = usePaymasterTransaction();
 *
 * // In a handler:
 * const hash = await executeSponsored(mintCalls);
 * // feed hash into useTxTracker(hash)
 * ```
 */

import { useState, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import type { Call } from "starknet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import {
  checkGaslessCompatibility,
  executeGaslessCalls,
  fetchGasTokenEstimatePrices,
  isSponsorshipConfigured,
} from "@/lib/paymaster-adapter";
import type { GasTokenPrice } from "@/types/paymaster";
import { starknetProvider } from "@/lib/starknet";

/**
 * Wait for a tx to reach on-chain finality and detect reverts.
 *
 * The injected-wallet + AVNU paymaster execution paths used to return the
 * tx hash immediately after submission, before any on-chain confirmation
 * — identical bug to use-tx pre-PR#17. A revert would be silently reported
 * as success. This helper centralises the post-submission wait so every
 * execute* method below stays honest about outcomes.
 *
 * StarkZap (Cartridge) path already calls `tx.wait()` from its own SDK, so
 * it does NOT route through this helper (avoid double-waiting).
 *
 * Returns:
 *  - `{ ok: true }` on confirmed success
 *  - `{ ok: false, reason }` on on-chain revert (caller surfaces error)
 *  - `{ ok: true, polledOk: false }` on polling failure — tx may still
 *    confirm; consumers can pair with useTxTracker for streaming finality.
 */
async function waitForReceipt(hash: string): Promise<
  | { ok: true; polledOk?: boolean }
  | { ok: false; reason: string }
> {
  try {
    const receipt = await starknetProvider.waitForTransaction(hash, {
      retryInterval: 3000,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = receipt as any;
    const executionStatus: string | undefined = r?.execution_status ?? r?.status;
    const isReverted =
      executionStatus === "REVERTED" ||
      executionStatus === "REJECTED" ||
      Boolean(r?.revert_reason);
    if (isReverted) {
      const reason: string =
        r?.revert_reason ?? `Transaction reverted (${executionStatus ?? "unknown"})`;
      return { ok: false, reason };
    }
    return { ok: true, polledOk: true };
  } catch (waitErr) {
    // RPC blip / timeout — the tx may still be on-chain, we just couldn't
    // verify it from this client. Optimistic: return ok so consumers don't
    // throw, but log so a missed revert leaves a trail.
    console.warn("[usePaymasterTransaction] receipt polling failed", {
      hash,
      err: waitErr instanceof Error ? waitErr.message : String(waitErr),
    });
    return { ok: true, polledOk: false };
  }
}

export interface UsePaymasterTransactionResult {
  // ----- Execution -----
  /**
   * Best-effort execution: tries sponsored gas first, silently falls back to
   * traditional if the paymaster rejects or is unavailable.
   * This is the preferred path — zero friction for users.
   */
  executeAuto: (calls: Call[]) => Promise<string | null>;
  /** Execute calls paying gas with an alternative token (USDC, USDT, ETH, STRK). */
  executeGasless: (
    calls: Call[],
    gasTokenAddress: string,
    maxGasTokenAmount: bigint
  ) => Promise<string | null>;
  /** Execute calls with Medialane-sponsored gas (requires API key). */
  executeSponsored: (calls: Call[]) => Promise<string | null>;
  /** Execute calls the normal way (user pays ETH/STRK gas). */
  executeTraditional: (calls: Call[]) => Promise<string | null>;

  // ----- State -----
  isLoading: boolean;
  error: string | null;
  /** Whether the connected account supports gasless txs. */
  isGaslessCompatible: boolean;
  /** Current gas token price list (for showing cost estimates). */
  gasTokenPrices: GasTokenPrice[];
  /** Whether sponsored execution is available (API key is set). */
  isSponsorAvailable: boolean;

  // ----- Utilities -----
  refreshGasTokenPrices: () => Promise<void>;
  clearError: () => void;
}

export function usePaymasterTransaction(): UsePaymasterTransactionResult {
  const { account, address } = useAccount();
  // StarkZap wallet (Cartridge) — manages its own gas via session keys
  const { wallet: szWallet } = useStarkZapWallet();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGaslessCompatible, setIsGaslessCompatible] = useState(false);
  const [gasTokenPrices, setGasTokenPrices] = useState<GasTokenPrice[]>([]);

  const isSponsorAvailable = isSponsorshipConfigured();

  // ---------------------------------------------------------------------------
  // Init: check account compatibility + fetch gas prices
  // ---------------------------------------------------------------------------

  const refreshGasTokenPrices = useCallback(async () => {
    try {
      const prices = await fetchGasTokenEstimatePrices();
      setGasTokenPrices(prices);
    } catch {
      // Non-fatal — gasless UI just won't show price estimates
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Gasless — user pays with alt token
  // ---------------------------------------------------------------------------

  const executeGasless = useCallback(
    async (
      calls: Call[],
      gasTokenAddress: string,
      maxGasTokenAmount: bigint
    ): Promise<string | null> => {
      if (!account || !address) {
        setError("Wallet not connected");
        return null;
      }

      const compatibility = await checkGaslessCompatibility(address);
      setIsGaslessCompatible(compatibility.isCompatible);
      if (!compatibility.isCompatible) {
        setError("Account is not compatible with gasless transactions");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const transactionHash = await executeGaslessCalls(
          // starkzap uses starknet v9 Account internally; medialane uses v8.
          // The Account object from starknet-react satisfies the same interface.
          account as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          calls,
          { gasTokenAddress, maxGasTokenAmount }
        );
        // Wait for on-chain finality so reverts don't silently look like success.
        const result = await waitForReceipt(transactionHash);
        if (!result.ok) {
          setError(result.reason);
          return null;
        }
        return transactionHash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gasless transaction failed";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [account, address]
  );

  // ---------------------------------------------------------------------------
  // Sponsored — Medialane pays gas
  // ---------------------------------------------------------------------------

  const executeSponsored = useCallback(
    async (calls: Call[]): Promise<string | null> => {
      if (!account || !address) {
        setError("Wallet not connected");
        return null;
      }
      if (!isSponsorAvailable) {
        setError("Sponsored transactions are not configured");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // avnuPaymasterProvider in StarknetConfig wraps account.execute automatically
        const response = await account.execute(calls as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        const hash: string = response.transaction_hash;
        const result = await waitForReceipt(hash);
        if (!result.ok) {
          setError(result.reason);
          return null;
        }
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Sponsored transaction failed";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [account, address, isSponsorAvailable]
  );

  // ---------------------------------------------------------------------------
  // Auto — sponsored first, silent fallback to traditional
  // ---------------------------------------------------------------------------

  const executeAuto = useCallback(
    async (calls: Call[]): Promise<string | null> => {
      // StarkZap wallet (Cartridge) handles gas via session keys — bypass paymaster
      if (szWallet) {
        setIsLoading(true);
        setError(null);
        try {
          const tx = await szWallet.execute(calls);
          await tx.wait();
          return tx.hash;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Transaction failed";
          setError(msg);
          throw new Error(msg);
        } finally {
          setIsLoading(false);
        }
      }

      if (!account || !address) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await account.execute(calls as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        const hash: string = response.transaction_hash;
        const result = await waitForReceipt(hash);
        if (!result.ok) {
          setError(result.reason);
          throw new Error(result.reason);
        }
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [szWallet, account, address]
  );

  // ---------------------------------------------------------------------------
  // Traditional — normal account.execute()
  // ---------------------------------------------------------------------------

  const executeTraditional = useCallback(
    async (calls: Call[]): Promise<string | null> => {
      if (!account) {
        setError("Wallet not connected");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await account.execute(calls as any); // eslint-disable-line @typescript-eslint/no-explicit-any
        const hash: string = response.transaction_hash;
        const result = await waitForReceipt(hash);
        if (!result.ok) {
          setError(result.reason);
          return null;
        }
        return hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [account]
  );

  return {
    executeAuto,
    executeGasless,
    executeSponsored,
    executeTraditional,
    isLoading,
    error,
    isGaslessCompatible,
    gasTokenPrices,
    isSponsorAvailable,
    refreshGasTokenPrices,
    clearError: () => setError(null),
  };
}
