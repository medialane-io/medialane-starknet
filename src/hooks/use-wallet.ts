"use client";

import type { Call } from "starknet";
import type { Connector } from "@starknet-react/core";
import { useWalletContext } from "@/contexts/wallet-context";
import type { WalletType } from "@/lib/wallet-types";

/**
 * The single wallet hook. Reads the one active-wallet slot owned by
 * WalletProvider. Use this everywhere — identity AND execution.
 *
 * Registration side-effect lives in <UserRegistration /> mounted in Providers,
 * not here — this hook stays a pure read of the slot (plus the user actions
 * the provider exposes).
 */
export function useWallet() {
  const { active, isConnecting, error, connect, disconnect } = useWalletContext();

  const execute = async (calls: Call[]): Promise<string> => {
    if (!active) throw new Error("Wallet not connected");
    return active.execute(calls);
  };

  return {
    address: active?.address ?? null,
    isConnected: active !== null,
    isConnecting,
    walletType: (active?.type ?? null) as WalletType | null,
    error,
    connect: (type: WalletType, connector?: Connector) => connect(type, connector),
    disconnect,
    execute,
  };
}
