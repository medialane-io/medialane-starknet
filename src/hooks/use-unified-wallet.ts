"use client";

/**
 * useUnifiedWallet — single hook that normalises across all wallet types:
 *   • starknet-react injected wallets (Argent, Braavos)
 *   • StarkZap Cartridge wallet
 *   • StarkZap Privy wallet
 *
 * Priority: StarkZap wallet (Cartridge / Privy) > starknet-react injected.
 *
 * @example
 * ```tsx
 * const { address, isConnected, walletType, execute } = useUnifiedWallet();
 *
 * const txHash = await execute([{ contractAddress, entrypoint, calldata }]);
 * // feed into useTxTracker(txHash)
 * ```
 */

import { useCallback } from "react";
import { useAccount, useDisconnect } from "@starknet-react/core";
import type { Call } from "starknet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useWalletSession } from "@/hooks/use-wallet-session";

export type UnifiedWalletType =
  | "argent"
  | "braavos"
  | "injected"
  | "cartridge"
  | "privy"
  | null;

export interface UnifiedWallet {
  /** Connected address (hex string) or undefined */
  address: string | undefined;
  isConnected: boolean;
  /** True while a wallet is rehydrating on reload (injected autoConnect /
   *  StarkZap session restore) — distinct from a settled disconnected state. */
  isConnecting: boolean;
  /** Which wallet stack provided the connection */
  walletType: UnifiedWalletType;
  /**
   * Execute contract calls.
   * Returns the transaction hash so callers can pass it to useTxTracker().
   */
  execute: (calls: Call[]) => Promise<string>;
  /** Disconnect / clear the active wallet */
  disconnect: () => void;
}

export function useUnifiedWallet(): UnifiedWallet {
  // StarkZap context (Cartridge / Privy)
  const {
    disconnect: szDisconnect,
  } = useStarkZapWallet();
  const {
    address,
    isConnected,
    isConnecting,
    walletType,
  } = useWalletSession();

  // starknet-react injected (Argent / Braavos)
  const {
    isConnected: injectedConnectedRaw,
  } = useAccount();
  const { disconnect: injectedDisconnect } = useDisconnect();
  const injectedConnected = injectedConnectedRaw ?? false;

  const { executeAuto } = usePaymasterTransaction();

  const hasStarkZap = walletType === "cartridge" || walletType === "privy";

  const execute = useCallback(
    async (calls: Call[]): Promise<string> => {
      // executeAuto now throws on failure, so errors propagate with real messages.
      // If it returns null for any unexpected reason, throw a generic fallback.
      const hash = await executeAuto(calls);
      if (!hash) {
        throw new Error("Transaction failed");
      }
      return hash;
    },
    [executeAuto]
  );

  const disconnect = useCallback(() => {
    if (hasStarkZap) {
      szDisconnect();
    } else if (injectedConnected) {
      injectedDisconnect();
    }
  }, [hasStarkZap, szDisconnect, injectedConnected, injectedDisconnect]);

  return {
    address: address ?? undefined,
    isConnected,
    isConnecting,
    walletType: walletType as UnifiedWalletType,
    execute,
    disconnect,
  };
}
