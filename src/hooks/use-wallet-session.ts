"use client";

/**
 * SHIM over the new wallet store (src/wallet). Preserves the old useWalletSession()
 * shape so existing consumers keep working unchanged.
 */

import { useWallet as useNewWallet } from "@/wallet";
import type { WalletSession, WalletSessionStatus, WalletSessionType } from "@/lib/wallet-session";

export interface ActiveWalletSession {
  session: WalletSession;
  address: string | null;
  walletType: WalletSessionType | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

function toOldStatus(s: string): WalletSessionStatus {
  return (s === "deploying" ? "deploying-account" : s) as WalletSessionStatus;
}

export function useWalletSession(): ActiveWalletSession {
  const w = useNewWallet();
  const walletType = (w.method ?? null) as WalletSessionType | null;
  const session: WalletSession = {
    status: toOldStatus(w.status),
    walletType,
    address: w.address,
    error: w.error,
  };
  return {
    session,
    address: w.address,
    walletType,
    isConnected: w.isConnected,
    isConnecting: w.isConnecting,
    error: w.error,
  };
}
