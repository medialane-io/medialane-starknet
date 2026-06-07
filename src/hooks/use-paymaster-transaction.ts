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
import { useWalletContext } from "@/contexts/wallet-context";
import {
  checkGaslessCompatibility,
  executeGaslessCalls,
  fetchGasTokenEstimatePrices,
  isSponsorshipConfigured,
} from "@/lib/paymaster-adapter";
import type { GasTokenPrice } from "@/types/paymaster";
import { waitForReceipt } from "@/lib/wait-for-receipt";

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
  // Active wallet slot — owns execution routing (injected vs StarkZap), so
  // executeAuto no longer decides via an `if (szWallet)` branch.
  const { active } = useWalletContext();

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
      // Routing lives in the active-wallet slot — injected executes through the
      // AVNU paymaster, StarkZap (Cartridge/Privy) through its own session keys.
      // executeAuto just delegates; no more `if (szWallet)` priority branch.
      if (!active) {
        setError("Wallet not connected");
        return null;
      }
      setIsLoading(true);
      setError(null);
      try {
        return await active.execute(calls);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [active]
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
