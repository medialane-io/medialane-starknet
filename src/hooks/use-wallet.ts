"use client";

import { useWalletContext } from "@/contexts/wallet-context";
import type { WalletType } from "@/lib/wallet-types";

export function useWallet() {
  const { active, isConnecting, connect, disconnect } = useWalletContext();

  return {
    address: active?.address ?? null,
    isConnected: active !== null,
    isConnecting,
    walletType: (active?.type ?? null) as WalletType | null,
    connect,
    disconnect,
  };
}
