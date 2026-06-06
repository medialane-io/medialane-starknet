"use client";

/**
 * SHIM over the new wallet store (src/wallet). Preserves the old useUnifiedWallet()
 * shape so existing consumers keep working unchanged.
 */

import { useWallet as useNewWallet } from "@/wallet";
import type { Call } from "starknet";

export type UnifiedWalletType =
  | "argent"
  | "braavos"
  | "injected"
  | "cartridge"
  | "privy"
  | null;

export interface UnifiedWallet {
  address: string | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  walletType: UnifiedWalletType;
  execute: (calls: Call[]) => Promise<string>;
  disconnect: () => void;
}

export function useUnifiedWallet(): UnifiedWallet {
  const w = useNewWallet();
  return {
    address: w.address ?? undefined,
    isConnected: w.isConnected,
    isConnecting: w.isConnecting,
    walletType: (w.method ?? null) as UnifiedWalletType,
    execute: w.execute,
    disconnect: w.disconnect,
  };
}
