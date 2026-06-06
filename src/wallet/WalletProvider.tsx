"use client";

import { createContext, useContext, useRef } from "react";
import { createWalletStore, type WalletStoreApi } from "./store";
import { useInjectedHost } from "./adapters/injected";

const Ctx = createContext<WalletStoreApi | null>(null);

export function useWalletStore(): WalletStoreApi {
  const s = useContext(Ctx);
  if (!s) throw new Error("useWallet must be used within <WalletProvider>");
  return s;
}

/** Runs the injected (starknet-react) bridge. Must render inside StarknetProvider. */
function InjectedHostMount({ store }: { store: WalletStoreApi }) {
  useInjectedHost(store);
  return null;
}

/**
 * WalletProvider — owns the single wallet store and mounts the two host bridges
 * (injected + embedded) plus the lazy, route-gated Privy leaf. Mounts once; the
 * content subtree's identity never changes when Privy activates (no remount).
 *
 * Hosts are added in subsequent tasks (injected: T5, embedded + Privy leaf: T6/T7).
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<WalletStoreApi>(undefined);
  if (!storeRef.current) storeRef.current = createWalletStore();

  return (
    <Ctx.Provider value={storeRef.current}>
      <InjectedHostMount store={storeRef.current} />
      {children}
    </Ctx.Provider>
  );
}
