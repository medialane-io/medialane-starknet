"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { makeInjectedExecute, makeStarkzapExecute } from "@/lib/wallet-adapters";
import {
  clearPersistedWallet,
  writePersistedWallet,
  type ActiveWallet,
  type WalletType,
} from "@/lib/wallet-types";

interface WalletContextValue {
  active: ActiveWallet | null;
  isConnecting: boolean;
  error: string | null;
  connect: (type: WalletType, connector?: Connector) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Injected (Argent/Braavos) via starknet-react. autoConnect (set in
  // StarknetProvider) restores the last injected connector on reload — safe
  // now that Privy no longer auto-mounts to race it.
  const {
    account: injectedAccount,
    address: injectedAddress,
    isConnected: injectedConnectedRaw,
    connector: injectedConnector,
    status: injectedStatus,
  } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect: injectedDisconnect } = useDisconnect();
  const injectedConnected = injectedConnectedRaw ?? false;

  // StarkZap (Cartridge/Privy) — onboarding + the active WalletInterface.
  const {
    wallet: szWallet,
    walletType: szType,
    address: szAddress,
    isConnecting: szConnecting,
    error: szError,
    connectCartridge,
    connectPrivy,
    disconnect: szDisconnect,
  } = useStarkZapWallet();

  const injectedType: WalletType = useMemo(() => {
    const id = injectedConnector?.id?.toLowerCase();
    if (id === "argentx" || id === "argent") return "argent";
    if (id === "braavos") return "braavos";
    return "injected";
  }, [injectedConnector]);

  // The slot. StarkZap is active ONLY because the user explicitly chose it (its
  // session is set exclusively by connectCartridge/connectPrivy + persisted
  // ml_wallet); there is no background path that sets szWallet anymore.
  //
  // IDENTITY (slot existence) depends only on connected + address — NEVER on the
  // starknet-react `account` object, which can be momentarily undefined while
  // the wallet is connected (connector/hydration timing, and it differs per
  // page). Coupling identity to `account` made the asset page read "disconnected"
  // for an actively-connected injected wallet. The account is resolved lazily at
  // execute() time instead.
  const active: ActiveWallet | null = useMemo(() => {
    if (szWallet && szAddress && (szType === "cartridge" || szType === "privy")) {
      return { type: szType, address: szAddress, execute: makeStarkzapExecute(szWallet) };
    }
    if (injectedConnected && injectedAddress) {
      return {
        type: injectedType,
        address: injectedAddress,
        execute: async (calls) => {
          if (!injectedAccount) {
            throw new Error("Wallet not ready yet — please try again in a moment");
          }
          return makeInjectedExecute(injectedAccount)(calls);
        },
      };
    }
    return null;
  }, [szWallet, szAddress, szType, injectedConnected, injectedAddress, injectedAccount, injectedType]);

  const isConnecting =
    szConnecting ||
    injectedStatus === "connecting" ||
    injectedStatus === "reconnecting";

  const connect = useCallback(
    async (type: WalletType, connector?: Connector) => {
      if (type === "cartridge") {
        await connectCartridge();
        return;
      }
      if (type === "privy") {
        await connectPrivy();
        return;
      }
      // injected: explicit pick supersedes any StarkZap session.
      if (!connector) throw new Error("Injected connect requires a connector");
      await connectAsync({ connector });
      // Retire any active/stale StarkZap session so it can't outrank or
      // silently restore over the wallet the user just picked.
      szDisconnect(); // also clears ml_wallet
      // Persist the injected choice as the restore target.
      const id = connector.id.toLowerCase();
      writePersistedWallet(id === "braavos" ? "braavos" : "argent");
    },
    [connectCartridge, connectPrivy, connectAsync, szDisconnect],
  );

  const disconnect = useCallback(() => {
    if (active?.type === "cartridge" || active?.type === "privy") {
      szDisconnect();
    } else {
      injectedDisconnect();
    }
    clearPersistedWallet();
  }, [active, szDisconnect, injectedDisconnect]);

  const value = useMemo<WalletContextValue>(
    () => ({ active, isConnecting, error: szError, connect, disconnect }),
    [active, isConnecting, szError, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWalletContext(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    return {
      active: null,
      isConnecting: false,
      error: null,
      connect: async () => {},
      disconnect: () => {},
    };
  }
  return ctx;
}
