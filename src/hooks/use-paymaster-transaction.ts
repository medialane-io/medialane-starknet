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
  checkAccountCompatibility,
  getGasTokenPrices,
  executeGaslessTransaction,
  canSponsor,
} from "@/utils/paymaster";
import type { GasTokenPrice } from "@/types/paymaster";

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

  const isSponsorAvailable = canSponsor();

  // ---------------------------------------------------------------------------
  // Init: check account compatibility + fetch gas prices
  // ---------------------------------------------------------------------------

  const refreshGasTokenPrices = useCallback(async () => {
    try {
      const prices = await getGasTokenPrices();
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

      const compatibility = await checkAccountCompatibility(address);
      setIsGaslessCompatible(compatibility.isCompatible);
      if (!compatibility.isCompatible) {
        setError("Account is not compatible with gasless transactions");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await executeGaslessTransaction(
          // starkzap uses starknet v9 Account internally; medialane uses v8.
          // The Account object from starknet-react satisfies the same interface.
          account as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          calls,
          { gasTokenAddress, maxGasTokenAmount }
        );

        if (!response.success) {
          throw new Error(response.error ?? "Gasless execution failed");
        }
        return response.transactionHash;
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
        return response.transaction_hash;
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
        return response.transaction_hash;
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
        return response.transaction_hash;
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
