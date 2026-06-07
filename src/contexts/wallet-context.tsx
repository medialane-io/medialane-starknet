"use client";

import React, { createContext, useContext, useMemo, useCallback, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { makeInjectedExecute, makeStarkzapExecute } from "@/lib/wallet-adapters";
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
  const { connectAsync, connectors } = useConnect();
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

  // [ML-WALLET-DIAG] log injected-connection transitions so we can see exactly
  // when/why the slot empties on navigation.
  useEffect(() => {
    console.warn("[ML-WALLET] injected state", {
      injectedConnected,
      hasAddress: Boolean(injectedAddress),
      hasAccount: Boolean(injectedAccount),
      status: injectedStatus,
      connectorId: injectedConnector?.id ?? null,
      szWallet: Boolean(szWallet),
      activeType: szWallet ? szType : injectedConnected ? injectedType : null,
    });
  }, [injectedConnected, injectedAddress, injectedAccount, injectedStatus, injectedConnector, szWallet, szType, injectedType]);

  const isConnecting =
    szConnecting ||
    injectedStatus === "connecting" ||
    injectedStatus === "reconnecting";

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
  const liveSzRef = useRef(Boolean(szWallet));
  liveSzRef.current = Boolean(szWallet);
  const reconnectRan = useRef(false);

  useEffect(() => {
    if (reconnectRan.current) return;
    const persisted = readPersistedWallet();
    if (persisted !== "argent" && persisted !== "braavos") return;
    if (liveConnectedRef.current || liveSzRef.current) return;
    reconnectRan.current = true;

    let cancelled = false;
    const targetId = persisted === "braavos" ? "braavos" : "argentX";

    (async () => {
      // Let starknet-react's own one-shot autoConnect try first (warm loads
      // where the extension is already injected) so we don't double-connect.
      await new Promise((r) => setTimeout(r, 500));
      // Up to ~6s of retries (15 × 400ms) to outlast slow extension injection.
      for (let i = 0; i < 15 && !cancelled; i++) {
        if (liveConnectedRef.current || liveSzRef.current) return;
        const connector = connectors.find((c) => c.id === targetId);
        if (connector) {
          try {
            const ready = await connector.ready();
            console.warn("[ML-WALLET] injected reconnect attempt", { i, targetId, ready });
            if (ready) {
              await connectAsync({ connector });
              return;
            }
          } catch (err) {
            console.warn("[ML-WALLET] injected reconnect error", { i, err });
          }
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors]);

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
