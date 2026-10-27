"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import type { ActiveWallet, WalletType } from "@/lib/wallet-types";
import { signOut } from "@/lib/wallet-session";
import { refreshSession } from "@/hooks/use-session";

interface WalletContextValue {
  active: ActiveWallet | null;
  isConnecting: boolean;
  connect: (connector: Connector) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {

  const {
    address: injectedAddress,
    isConnected: injectedConnectedRaw,
    connector: injectedConnector,
    status: injectedStatus,
  } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect: injectedDisconnect } = useDisconnect();
  const injectedConnected = injectedConnectedRaw ?? false;

  const injectedType: WalletType = useMemo(() => {
    const id = injectedConnector?.id?.toLowerCase();
    if (id === "argentx" || id === "argent") return "argent";
    if (id === "braavos") return "braavos";
    return "injected";
  }, [injectedConnector]);

  const active: ActiveWallet | null = useMemo(() => {
    if (injectedConnected && injectedAddress) {
      return { type: injectedType, address: injectedAddress };
    }
    return null;
  }, [injectedConnected, injectedAddress, injectedType]);

  const isConnecting = injectedStatus === "connecting" || injectedStatus === "reconnecting";

  const connect = useCallback(
    async (connector: Connector) => {
      await connectAsync({ connector });
    },
    [connectAsync],
  );

  const disconnect = useCallback(() => {
    injectedDisconnect();
    void signOut().then(() => refreshSession());
  }, [injectedDisconnect]);

  const value = useMemo<WalletContextValue>(
    () => ({ active, isConnecting, connect, disconnect }),
    [active, isConnecting, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    return {
      active: null,
      isConnecting: false,
      connect: async () => {},
      disconnect: () => {},
    };
  }
  return ctx;
}
