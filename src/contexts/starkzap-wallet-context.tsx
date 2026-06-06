"use client";

/**
 * SHIM over the new wallet store (src/wallet). Preserves the old useStarkZapWallet()
 * shape so the existing consumers keep working unchanged. Reads the store DIRECTLY
 * (not via useWallet) — usePaymasterTransaction calls this hook, and useWallet calls
 * usePaymasterTransaction, so going through useWallet here would recurse infinitely.
 *
 * The real provider is now <WalletProvider> (src/wallet). StarkZapWalletProvider is a
 * passthrough kept only so any lingering import still renders.
 */

import { useCallback } from "react";
import { useStore } from "zustand";
import type { User } from "@privy-io/react-auth";
import type { WalletInterface } from "starkzap";
import { useWalletStore } from "@/wallet/WalletProvider";
import { METHOD_BACKEND, type WalletMethod } from "@/wallet/types";
import { writeLastChoice, clearLastChoice } from "@/wallet/persistence";
import type { WalletSession, WalletSessionStatus } from "@/lib/wallet-session";

export type StarkZapWalletType = "cartridge" | "privy";

export function StarkZapWalletProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function toOldStatus(s: string): WalletSessionStatus {
  return (s === "deploying" ? "deploying-account" : s) as WalletSessionStatus;
}

export interface StarkZapWalletCtx {
  wallet: WalletInterface | null;
  session: WalletSession;
  walletType: StarkZapWalletType | null;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  privyUser: User | null;
  connectCartridge: () => Promise<void>;
  connectPrivy: () => Promise<void>;
  disconnect: () => void;
}

export function useStarkZapWallet(): StarkZapWalletCtx {
  const store = useWalletStore();
  const s = useStore(store, (st) => ({
    status: st.status,
    method: st.method,
    address: st.address,
    error: st.error,
    signer: st.signer,
    privyUser: st.privyUser,
  }));

  const connect = useCallback(
    async (method: WalletMethod) => {
      store.getState().setActive(method);
      writeLastChoice(method);
      await store.getState().bridges[METHOD_BACKEND[method]]?.connect(method);
    },
    [store],
  );

  const disconnect = useCallback(() => {
    const st = store.getState();
    if (st.backend) st.bridges[st.backend]?.disconnect();
    clearLastChoice();
    st.clearActive();
  }, [store]);

  const isEmbedded = s.method === "cartridge" || s.method === "privy";

  return {
    wallet: isEmbedded ? (s.signer as WalletInterface | null) : null,
    session: {
      status: toOldStatus(s.status),
      walletType: (s.method ?? null) as WalletSession["walletType"],
      address: s.address,
      error: s.error,
    },
    walletType: isEmbedded ? (s.method as StarkZapWalletType) : null,
    address: s.address,
    isConnecting: s.status === "connecting" || s.status === "deploying",
    error: s.error,
    privyUser: (s.privyUser ?? null) as User | null,
    connectCartridge: () => connect("cartridge"),
    connectPrivy: () => connect("privy"),
    disconnect,
  };
}
