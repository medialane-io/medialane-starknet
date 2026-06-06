"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { createWalletStore, type WalletStoreApi } from "./store";
import { useInjectedHost } from "./adapters/injected";
import { useEmbeddedHost } from "./adapters/embedded";
import type { PrivyLeafProps } from "./adapters/privy-leaf";
import { usePrivyReconnect } from "./reconnect";

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

/** Registers the embedded bridge (Cartridge direct; Privy → requestPrivy). */
function EmbeddedHostMount({
  store,
  requestPrivy,
}: {
  store: WalletStoreApi;
  requestPrivy: (adopt: boolean) => void;
}) {
  useEmbeddedHost(store, requestPrivy);
  return null;
}

/** Runs the route-gated Privy reconnect. */
function ReconnectMount({ store, onWantPrivy }: { store: WalletStoreApi; onWantPrivy: () => void }) {
  usePrivyReconnect(store, onWantPrivy);
  return null;
}

type PrivyStack = {
  Provider: React.ComponentType<{ children: React.ReactNode }>;
  Leaf: React.ComponentType<PrivyLeafProps>;
};

// Lazily import PrivyProvider + PrivyLeaf TOGETHER so Privy (and @privy-io/react-auth)
// is never bundled for users who don't use it.
async function loadPrivyStack(): Promise<PrivyStack> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set — Privy onboarding cannot start.");
  const [{ PrivyProvider }, leafMod] = await Promise.all([
    import("@privy-io/react-auth"),
    import("./adapters/privy-leaf"),
  ]);
  const config = {
    loginMethods: ["email", "google", "twitter"] as Array<"email" | "google" | "twitter">,
    appearance: { theme: "dark" as const },
  };
  function Provider({ children }: { children: React.ReactNode }) {
    return (
      <PrivyProvider appId={appId!} config={config}>
        {children}
      </PrivyProvider>
    );
  }
  return { Provider, Leaf: leafMod.PrivyLeaf };
}

/**
 * WalletProvider — owns the single wallet store and mounts the two host bridges
 * (injected + embedded) plus the lazy, route-gated Privy leaf. Mounts once. The
 * Privy provider wraps ONLY its own leaf (a sibling of `children`), so activating
 * Privy never remounts the content subtree (the old silent-disconnect bug).
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<WalletStoreApi>(undefined);
  if (!storeRef.current) storeRef.current = createWalletStore();
  const store = storeRef.current;

  const [privy, setPrivy] = useState<PrivyStack | null>(null);
  const [pending, setPending] = useState(false);
  const [adopt, setAdopt] = useState(false);

  const requestPrivy = useCallback((adoptSession: boolean) => {
    setAdopt(adoptSession);
    setPending(true);
    setPrivy((cur) => {
      if (cur) return cur;
      loadPrivyStack()
        .then((stack) => setPrivy(stack))
        .catch((err) => {
          console.error("[Privy] load failed:", err);
          store.getState().ingest("embedded", {
            status: "error",
            method: "privy",
            address: null,
            error: "Could not start email/social login.",
          });
        });
      return cur;
    });
  }, [store]);

  return (
    <Ctx.Provider value={store}>
      <InjectedHostMount store={store} />
      <EmbeddedHostMount store={store} requestPrivy={requestPrivy} />
      <ReconnectMount store={store} onWantPrivy={() => requestPrivy(true)} />
      {privy ? (
        <privy.Provider>
          <privy.Leaf
            store={store}
            pending={pending}
            adopt={adopt}
            clearPending={() => setPending(false)}
          />
        </privy.Provider>
      ) : null}
      {children}
    </Ctx.Provider>
  );
}
