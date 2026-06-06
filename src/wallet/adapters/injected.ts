"use client";

import { useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { WalletMethod } from "../types";
import type { WalletStoreApi } from "../store";
import { readLastChoice } from "../persistence";

/** starknet-react connector ids → our method. Ready/Argent ships as "argentX". */
function methodOf(connectorId?: string): WalletMethod {
  const id = connectorId?.toLowerCase();
  return id === "braavos" ? "braavos" : "argent";
}

/**
 * Bridges starknet-react (injected: Argent/Ready, Braavos) into the wallet store.
 * - Registers the `injected` bridge (connect/disconnect).
 * - Pushes account changes into the store, GATED: the store only applies them
 *   when `injected` is the active backend.
 * - Adopts a native autoConnect on load ONLY when the last explicit choice was an
 *   injected method — so a Privy-last-choice user is never handed an incidentally
 *   auto-connected extension.
 */
export function useInjectedHost(store: WalletStoreApi) {
  const { address, isConnected, status, connector } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnect: rkDisconnect } = useDisconnect();

  useEffect(() => {
    store.getState().registerBridge("injected", {
      connect: async (method: WalletMethod) => {
        const wantId = method === "braavos" ? "braavos" : "argentX";
        const c = connectors.find((x) => x.id === wantId) ?? connectors[0];
        if (!c) throw new Error("No injected connector available");
        await connectAsync({ connector: c });
      },
      disconnect: () => rkDisconnect(),
    });
  }, [store, connectAsync, connectors, rkDisconnect]);

  useEffect(() => {
    const st = store.getState();
    const connected = (isConnected ?? false) && !!address;

    // Adopt a native autoConnect when nothing is active yet and the last explicit
    // choice was an injected method.
    if (!st.backend && connected) {
      const last = readLastChoice();
      if (last === "argent" || last === "braavos") st.setActive(last);
    }

    const snapStatus =
      status === "connecting" || status === "reconnecting"
        ? "connecting"
        : connected
          ? "ready"
          : "idle";

    store.getState().ingest(
      "injected",
      {
        status: snapStatus,
        method: connected ? methodOf(connector?.id) : null,
        address: address ?? null,
        error: null,
      },
      null, // injected signer is read at call time (Task 8), never stored stale
    );
  }, [store, address, isConnected, status, connector]);
}
