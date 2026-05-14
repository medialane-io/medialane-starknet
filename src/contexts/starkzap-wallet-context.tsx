"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import type { WalletInterface } from "starkzap";
import { toast } from "sonner";
import { getStarkZapSdk } from "@/lib/starkzap";
import type { PrivyConnectorProps } from "./privy-connector";
import {
  IDLE_WALLET_SESSION,
  isWalletSessionBusy,
  walletConnecting,
  walletError,
  walletReady,
  walletAuthenticating,
  type WalletSession,
} from "@/lib/wallet-session";
import {
  COLLECTION_721_CONTRACT,
  MARKETPLACE_721_CONTRACT,
  MARKETPLACE_1155_CONTRACT,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Cartridge session policies for Medialane contracts
// ---------------------------------------------------------------------------

export const CARTRIDGE_POLICIES = [
  { target: COLLECTION_721_CONTRACT, method: "mint" },
  { target: COLLECTION_721_CONTRACT, method: "create_collection" },
  { target: COLLECTION_721_CONTRACT, method: "burn" },
  { target: COLLECTION_721_CONTRACT, method: "transfer_token" },
  { target: MARKETPLACE_721_CONTRACT, method: "register_order" },
  { target: MARKETPLACE_721_CONTRACT, method: "fulfill_order" },
  { target: MARKETPLACE_721_CONTRACT, method: "cancel_order" },
  { target: MARKETPLACE_1155_CONTRACT, method: "register_order" },
  { target: MARKETPLACE_1155_CONTRACT, method: "fulfill_order" },
  { target: MARKETPLACE_1155_CONTRACT, method: "cancel_order" },
] as { target: string; method: string }[];

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export type StarkZapWalletType = "cartridge" | "privy";

export interface StarkZapWalletCtx {
  wallet: WalletInterface | null;
  session: WalletSession;
  walletType: StarkZapWalletType | null;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  privyUser: User | null;
  connectCartridge: () => Promise<void>;
  connectPrivy: () => Promise<void>;
  disconnect: () => void;
}

const StarkZapWalletContext = createContext<StarkZapWalletCtx | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider — owns Privy onboarding state directly; renders an injected
// PrivyConnector component (lazy-loaded by providers.tsx) when available.
// ---------------------------------------------------------------------------

interface ProviderProps {
  children: React.ReactNode;
  onRequestPrivy: () => void;
  PrivyConnector?: React.ComponentType<PrivyConnectorProps> | null;
}

export function StarkZapWalletProvider({
  children,
  onRequestPrivy,
  PrivyConnector,
}: ProviderProps) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [session, setSession] = useState<WalletSession>(IDLE_WALLET_SESSION);
  const [privyUser, setPrivyUser] = useState<User | null>(null);
  const [pendingPrivyConnect, setPendingPrivyConnect] = useState(false);
  const walletType = session.walletType === "cartridge" || session.walletType === "privy"
    ? session.walletType
    : null;
  const address = session.address;
  const isConnecting = isWalletSessionBusy(session);
  const error = session.error;

  const connectCartridge = useCallback(async () => {
    setSession(walletConnecting("cartridge"));
    try {
      const sdk = getStarkZapSdk();
      const result = await sdk.onboard({
        strategy: OnboardStrategy.Cartridge,
        cartridge: { policies: CARTRIDGE_POLICIES },
        deploy: "if_needed",
      });
      setWallet(result.wallet);
      setSession(walletReady("cartridge", result.wallet.address as unknown as string));
    } catch (err) {
      setWallet(null);
      setSession(walletError("cartridge", err instanceof Error ? err.message : "Failed to connect Cartridge"));
    }
  }, []);

  const connectPrivy = useCallback(async () => {
    localStorage.setItem("ml_privy_session", "1");
    setSession(walletAuthenticating("privy"));
    onRequestPrivy();
    setPendingPrivyConnect(true);
  }, [onRequestPrivy]);

  const disconnect = useCallback(() => {
    if (walletType === "privy") {
      localStorage.removeItem("ml_privy_session");
    }
    setWallet(null);
    setSession(IDLE_WALLET_SESSION);
    setPrivyUser(null);
  }, [walletType]);

  // Surface session errors as toasts (Privy-only — Cartridge errors are
  // already shown inline in nav-account-panel).
  const lastShownError = useRef<string | null>(null);
  useEffect(() => {
    if (session.walletType !== "privy") return;
    if (session.status !== "error") {
      lastShownError.current = null;
      return;
    }
    if (!session.error || session.error === lastShownError.current) return;
    lastShownError.current = session.error;
    toast.error(session.error, { id: "privy-connect-error" });
  }, [session.status, session.walletType, session.error]);

  const clearPending = useCallback(() => setPendingPrivyConnect(false), []);

  return (
    <StarkZapWalletContext.Provider
      value={{ wallet, session, walletType, address, isConnecting, error, privyUser, connectCartridge, connectPrivy, disconnect }}
    >
      {PrivyConnector ? (
        <PrivyConnector
          pendingConnect={pendingPrivyConnect}
          clearPending={clearPending}
          walletType={walletType}
          setSession={setSession}
          setWallet={setWallet}
          setPrivyUser={setPrivyUser}
        />
      ) : null}
      {children}
    </StarkZapWalletContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

const STARKZAP_DEFAULT_CTX: StarkZapWalletCtx = {
  wallet: null, session: IDLE_WALLET_SESSION, walletType: null, address: null,
  isConnecting: false, error: null, privyUser: null,
  connectCartridge: async () => {},
  connectPrivy: async () => {},
  disconnect: () => {},
};

export function useStarkZapWallet(): StarkZapWalletCtx {
  return useContext(StarkZapWalletContext) ?? STARKZAP_DEFAULT_CTX;
}
