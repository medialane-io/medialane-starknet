"use client";

import React, { createContext, useContext, useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { Connector } from "@starknet-react/core";
import { useCartridgeWallet } from "@/contexts/cartridge-wallet-context";
import { makeInjectedExecute, makeStarkzapExecute } from "@/lib/wallet-adapters";
import { withTimeout } from "@/lib/wallet-error";
import { getConnectorDisplayName } from "@/lib/starknet-connectors";
import {
  clearPersistedWallet,
  writePersistedWallet,
  readPersistedWallet,
  type ActiveWallet,
  type WalletType,
} from "@/lib/wallet-types";

/** How long an explicit injected connect can hang before we give up and
 *  surface "wallet not responding" instead of leaving the UI stuck. Long
 *  enough to cover a PIN/passkey prompt the user is actively answering. */
const INJECTED_CONNECT_TIMEOUT_MS = 20_000;
/** Shorter bound for the silent background reconnect-on-load probe — this
 *  path is invisible to the user, so a hang here should fail fast and let
 *  the loop's own retry cadence take over rather than eating the whole
 *  ~6s budget on one stuck call. */
const INJECTED_RECONNECT_PROBE_TIMEOUT_MS = 3_000;

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
  // StarknetProvider) restores the last injected connector on reload.
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

  // StarkZap (Cartridge) — onboarding + the active WalletInterface.
  const {
    wallet: szWallet,
    walletType: szType,
    address: szAddress,
    isConnecting: szConnecting,
    error: szError,
    connectCartridge,
    disconnect: szDisconnect,
  } = useCartridgeWallet();

  const injectedType: WalletType = useMemo(() => {
    const id = injectedConnector?.id?.toLowerCase();
    if (id === "argentx" || id === "argent") return "argent";
    if (id === "braavos") return "braavos";
    return "injected";
  }, [injectedConnector]);

  // The slot. StarkZap is active ONLY because the user explicitly chose it (its
  // session is set exclusively by connectCartridge + persisted ml_wallet);
  // there is no background path that sets szWallet anymore.
  //
  // IDENTITY (slot existence) depends only on connected + address — NEVER on the
  // starknet-react `account` object, which can be momentarily undefined while
  // the wallet is connected (connector/hydration timing, and it differs per
  // page). Coupling identity to `account` made the asset page read "disconnected"
  // for an actively-connected injected wallet. The account is resolved lazily at
  // execute() time instead.
  const active: ActiveWallet | null = useMemo(() => {
    if (szWallet && szAddress && szType === "cartridge") {
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

  // True while our manual injected-reconnect retry loop (below) is running. The
  // loop is bounded (~6s), so this can never stick on. Folding it into
  // isConnecting lets <ConnectGate> show a skeleton (not the connect panel) for
  // a returning user whose extension hasn't finished re-injecting yet —
  // starknet-react's own injectedStatus reads "disconnected" during this window.
  const [reconnecting, setReconnecting] = useState(false);

  const isConnecting =
    szConnecting ||
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
  const liveSzRef = useRef(Boolean(szWallet));
  liveSzRef.current = Boolean(szWallet);
  const reconnectRan = useRef(false);

  useEffect(() => {
    if (reconnectRan.current) return;
    const persisted = readPersistedWallet();
    if (persisted !== "argent" && persisted !== "braavos") return;
    if (liveConnectedRef.current || liveSzRef.current) return;
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
        if (liveConnectedRef.current || liveSzRef.current) { setReconnecting(false); return; }
        const connector = connectors.find((c) => c.id === targetId);
        if (connector) {
          try {
            // Same hang risk as the explicit connect path below, but this
            // probe is silent (no user-facing error) — fail fast per call so
            // a single stuck extension can't eat the whole retry budget.
            const isReady = await withTimeout(
              connector.ready(),
              INJECTED_RECONNECT_PROBE_TIMEOUT_MS,
              targetId,
            );
            if (isReady) {
              await withTimeout(
                connectAsync({ connector }),
                INJECTED_RECONNECT_PROBE_TIMEOUT_MS,
                targetId,
              );
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
    async (type: WalletType, connector?: Connector) => {
      if (type === "cartridge") {
        await connectCartridge();
        return;
      }
      // injected: explicit pick supersedes any StarkZap session.
      if (!connector) throw new Error("Injected connect requires a connector");
      // Injected wallets talk over window.postMessage / a content script — if
      // the extension itself is stuck (crashed background worker, a wedged
      // connection), connectAsync can hang forever with no error and no
      // rejection, leaving isConnecting stuck true indefinitely (reported:
      // Ready hanging mid-connect broke wallet UI state app-wide). Bound it.
      await withTimeout(
        connectAsync({ connector }),
        INJECTED_CONNECT_TIMEOUT_MS,
        getConnectorDisplayName(connector.id, connector.name ?? "Your wallet"),
      );
      // Retire any active/stale StarkZap session so it can't outrank or
      // silently restore over the wallet the user just picked.
      szDisconnect(); // also clears ml_wallet
      // Persist the injected choice as the restore target.
      const id = connector.id.toLowerCase();
      writePersistedWallet(id === "braavos" ? "braavos" : "argent");
    },
    [connectCartridge, connectAsync, szDisconnect],
  );

  const disconnect = useCallback(() => {
    if (active?.type === "cartridge") {
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
