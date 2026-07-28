"use client";

import React, { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { makeInjectedExecute } from "@/lib/wallet-adapters";
import { assertCorrectNetwork } from "@/lib/wallet-error";
import { useNetwork } from "@/components/starknet-provider";
import {
  clearPersistedWallet,
  writePersistedWallet,
  readPersistedWallet,
  type ActiveWallet,
  type WalletType,
} from "@/lib/wallet-types";

interface WalletContextValue {
  active: ActiveWallet | null;
  isConnecting: boolean;
  connect: (connector: Connector) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Injected (Argent/Braavos) via starknet-react. autoConnect (set in
  // StarknetProvider) restores the last injected connector on reload.
  const {
    account: injectedAccount,
    address: injectedAddress,
    isConnected: injectedConnectedRaw,
    connector: injectedConnector,
    status: injectedStatus,
    chainId,
  } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect: injectedDisconnect } = useDisconnect();
  const { networkConfig } = useNetwork();
  const injectedConnected = injectedConnectedRaw ?? false;

  const injectedType: WalletType = useMemo(() => {
    const id = injectedConnector?.id?.toLowerCase();
    if (id === "argentx" || id === "argent") return "argent";
    if (id === "braavos") return "braavos";
    return "injected";
  }, [injectedConnector]);

  // The slot. Injected (Argent/Braavos) only.
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

  // True while our manual injected-reconnect retry loop (below) is running. The
  // loop is bounded (~6s), so this can never stick on. Folding it into
  // isConnecting lets <ConnectGate> show a skeleton (not the connect panel) for
  // a returning user whose extension hasn't finished re-injecting yet —
  // starknet-react's own injectedStatus reads "disconnected" during this window.
  const [reconnecting, setReconnecting] = useState(false);

  const isConnecting =
    injectedStatus === "connecting" ||
    injectedStatus === "reconnecting" ||
    reconnecting;

  // ── Robust injected reconnect ──────────────────────────────────────────────
  // starknet-react's `autoConnect` makes a SINGLE one-shot attempt on mount.
  // Browser wallet extensions inject `window.starknet_*` asynchronously, so on a
  // fresh/slow page load the extension often isn't ready when that one shot
  // fires — autoConnect silently gives up and never retries, leaving an
  // actually-authorized wallet showing "disconnected" (reported as the dapp
  // dropping the wallet on navigation). We retry the reconnect ourselves, keyed
  // on the persisted choice (ml_wallet), until the connector reports ready.
  // `ready()` only returns true when the extension is present AND the `accounts`
  // permission is still granted, so this never prompts.
  const liveConnectedRef = useRef(injectedConnected);
  liveConnectedRef.current = injectedConnected;
  const reconnectRan = useRef(false);

  useEffect(() => {
    if (reconnectRan.current) return;
    const persisted = readPersistedWallet();
    if (persisted !== "argent" && persisted !== "braavos") return;
    if (liveConnectedRef.current) return;
    reconnectRan.current = true;
    setReconnecting(true);

    let cancelled = false;
    const targetId = persisted === "braavos" ? "braavos" : "argentX";

    (async () => {
      // Let starknet-react's own one-shot autoConnect try first (warm loads
      // where the extension is already injected) so we don't double-connect.
      await new Promise((r) => setTimeout(r, 500));
      // Up to ~6s of retries (15 × 400ms) to outlast slow extension injection.
      for (let i = 0; i < 15 && !cancelled; i++) {
        if (liveConnectedRef.current) { setReconnecting(false); return; }
        const connector = connectors.find((c) => c.id === targetId);
        if (connector) {
          try {
            const isReady = await connector.ready();
            if (isReady) {
              await connectAsync({ connector });
              setReconnecting(false);
              return;
            }
          } catch {
            // extension not ready / transient — retry on the next tick
          }
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      setReconnecting(false);
    })();

    return () => {
      cancelled = true;
      setReconnecting(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors]);

  const connect = useCallback(
    async (connector: Connector) => {
      await connectAsync({ connector });
      // Persist the injected choice as the restore target.
      const id = connector.id.toLowerCase();
      writePersistedWallet(id === "braavos" ? "braavos" : "argent");
    },
    [connectAsync],
  );

  const disconnect = useCallback(() => {
    injectedDisconnect();
    clearPersistedWallet();
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
