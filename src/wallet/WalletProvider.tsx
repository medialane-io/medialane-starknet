"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

const isMintRoute = (p: string) => p === "/mint" || p === "/airdrop" || p.startsWith("/br/");

function InjectedHostMount({ store }: { store: WalletStoreApi }) {
  useInjectedHost(store);
  return null;
}

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

function ReconnectMount({ store, onWantPrivy }: { store: WalletStoreApi; onWantPrivy: () => void }) {
  usePrivyReconnect(store, onWantPrivy);
  return null;
}

type PrivyStack = {
  Provider: React.ComponentType<{ children: React.ReactNode }>;
  Leaf: React.ComponentType<PrivyLeafProps>;
};

// Lazily import PrivyProvider + PrivyLeaf TOGETHER so Privy is never bundled for
// users who don't use it.
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
 * WalletProvider — single wallet store + the two host bridges + the lazy Privy leaf.
 *
 * Privy mounting is split into the two concerns from the design:
 *  - AVAILABILITY (page-driven): on mint/airdrop routes the Privy stack is eagerly
 *    loaded and wraps `children`, so the inline email-OTP login (PrivyInlineLogin,
 *    which lives in page content) has PrivyProvider as an ancestor. Mounted at
 *    initial render → no mid-session remount.
 *  - ACTIVATION (choice-driven): on any route, an explicit connect("privy") (or the
 *    route-gated reconnect) loads the stack; off mint routes the leaf mounts as a
 *    sibling of `children`, so activating Privy never remounts the content subtree.
 */
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<WalletStoreApi>(undefined);
  if (!storeRef.current) storeRef.current = createWalletStore();
  const store = storeRef.current;

  const pathname = usePathname();
  const mintRoute = isMintRoute(pathname);

  const [privy, setPrivy] = useState<PrivyStack | null>(null);
  const [pending, setPending] = useState(false);
  const [adopt, setAdopt] = useState(false);

  const ensurePrivyLoaded = useCallback(() => {
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

  // AVAILABILITY: eagerly load Privy on mint routes so the inline login works.
  useEffect(() => {
    if (mintRoute) ensurePrivyLoaded();
  }, [mintRoute, ensurePrivyLoaded]);

  // ACTIVATION: explicit connect("privy") / reconnect.
  const requestPrivy = useCallback(
    (adoptSession: boolean) => {
      setAdopt(adoptSession);
      setPending(true);
      ensurePrivyLoaded();
    },
    [ensurePrivyLoaded],
  );

  const hosts = (
    <>
      <InjectedHostMount store={store} />
      <EmbeddedHostMount store={store} requestPrivy={requestPrivy} />
      <ReconnectMount store={store} onWantPrivy={() => requestPrivy(true)} />
    </>
  );

  const leaf = privy ? (
    <privy.Leaf store={store} pending={pending} adopt={adopt} clearPending={() => setPending(false)} />
  ) : null;

  let body: React.ReactNode;
  if (privy && mintRoute) {
    // Privy is an ancestor of content (inline login needs it) — mounted at render.
    body = (
      <privy.Provider>
        {leaf}
        {children}
      </privy.Provider>
    );
  } else if (privy) {
    // Leaf-only Privy (sibling of content) — activating it never remounts children.
    body = (
      <>
        <privy.Provider>{leaf}</privy.Provider>
        {children}
      </>
    );
  } else {
    body = children;
  }

  return (
    <Ctx.Provider value={store}>
      {hosts}
      {body}
    </Ctx.Provider>
  );
}
