"use client";

import type { Call } from "starknet";
import { useWalletContext } from "@/contexts/wallet-context";
import type { WalletType } from "@/lib/wallet-types";

export function useWallet() {
  const { active, isConnecting, connect, disconnect } = useWalletContext();

  const execute = async (calls: Call[]): Promise<string> => {
    if (!active) throw new Error("Wallet not connected");
    return active.execute(calls);
  };

  return {
    address: active?.address ?? null,
    isConnected: active !== null,
    isConnecting,
    walletType: (active?.type ?? null) as WalletType | null,
    connect,
    disconnect,
    execute,
  };
}
