"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import type { AccountInterface, Call } from "starknet";
import { waitForReceipt } from "@/lib/wait-for-receipt";
import { assertCorrectNetwork } from "@/lib/wallet-error";
import { useNetwork } from "@/components/starknet-provider";
import type { ActiveWallet, WalletType } from "@/lib/wallet-types";

/** Injected (Argent/Braavos): execute via account.execute, then confirm on-chain. */
function makeInjectedExecute(account: AccountInterface) {
  return async (calls: Call[]): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await account.execute(calls as any);
    const hash: string = response.transaction_hash;
    const result = await waitForReceipt(hash);
    if (!result.ok) throw new Error(result.reason);
    return hash;
  };
}

interface WalletContextValue {
  active: ActiveWallet | null;
  isConnecting: boolean;
  connect: (connector: Connector) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Injected wallets (Argent/Braavos/MetaMask/Keplr/Fordefi/Xverse) via
  // starknet-react. autoConnect (set in StarknetProvider) persists and
  // restores the last-used connector itself (its own "lastUsedConnector"
  // localStorage key) — no app-level persistence needed here.
  const {
    account: injectedAccount,
    address: injectedAddress,
    isConnected: injectedConnectedRaw,
    connector: injectedConnector,
    status: injectedStatus,
    chainId,
  } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect: injectedDisconnect } = useDisconnect();
  const { networkConfig } = useNetwork();
  const injectedConnected = injectedConnectedRaw ?? false;

  const injectedType: WalletType = useMemo(() => {
    const id = injectedConnector?.id?.toLowerCase();
    if (id === "argentx" || id === "argent") return "argent";
    if (id === "braavos") return "braavos";
    return "injected";
  }, [injectedConnector]);

  // The slot. Injected wallets only.
  //
  // IDENTITY (slot existence) depends only on connected + address — NEVER on the
  // starknet-react `account` object, which can be momentarily undefined while
  // the wallet is connected (connector/hydration timing, and it differs per
  // page). Coupling identity to `account` made the asset page read "disconnected"
  // for an actively-connected injected wallet. The account is resolved lazily at
  // execute() time instead.
  const active: ActiveWallet | null = useMemo(() => {
    if (injectedConnected && injectedAddress) {
      return {
        type: injectedType,
        address: injectedAddress,
        execute: async (calls) => {
          if (!injectedAccount) {
            throw new Error("Wallet not ready yet — please try again in a moment");
          }
          assertCorrectNetwork(chainId, networkConfig.chainId);
          return makeInjectedExecute(injectedAccount)(calls);
        },
      };
    }
    return null;
  }, [injectedConnected, injectedAddress, injectedAccount, injectedType, chainId, networkConfig.chainId]);

  const isConnecting = injectedStatus === "connecting" || injectedStatus === "reconnecting";

  const connect = useCallback(
    async (connector: Connector) => {
      await connectAsync({ connector });
    },
    [connectAsync],
  );

  const disconnect = useCallback(() => {
    injectedDisconnect();
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
