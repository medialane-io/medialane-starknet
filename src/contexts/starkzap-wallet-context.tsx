"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePrivy } from "@privy-io/react-auth";
import type { User } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import type { WalletInterface } from "starkzap";
import { getStarkZapSdk } from "@/lib/starkzap";
import { starknetProvider } from "@/lib/starknet";
import {
  COLLECTION_721_CONTRACT,
  MARKETPLACE_721_CONTRACT,
  MARKETPLACE_1155_CONTRACT,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Cartridge session policies for Medialane contracts
// ---------------------------------------------------------------------------

const CARTRIDGE_POLICIES = [
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
  walletType: StarkZapWalletType | null;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  privyUser: User | null;
  connectCartridge: () => Promise<void>;
  connectPrivy: () => Promise<void>;
  disconnect: () => void;
}

const StarkZapWalletContext = createContext<StarkZapWalletCtx | undefined>(
  undefined
);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function StarkZapWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [walletType, setWalletType] = useState<StarkZapWalletType | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privyUser, setPrivyUser] = useState<User | null>(null);

  const { login, logout, authenticated, getAccessToken, user } = usePrivy();

  // ---------------------------------------------------------------------------
  // Internal: initialise StarkZap wallet after Privy auth is established
  // ---------------------------------------------------------------------------

  const initPrivyWallet = useCallback(async (silent = false) => {
    const token = await getAccessToken();
    if (!token) {
      if (silent) return;
      throw new Error("No Privy access token");
    }

    const res = await fetch("/api/wallet/starknet", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to create Privy Starknet wallet");
    const walletData = (await res.json()) as {
      id: string;
      address: string;
      publicKey: string;
    };

    const sdk = getStarkZapSdk();
    const privyResolve = async () => ({
      walletId: walletData.id,
      publicKey: walletData.publicKey,
      serverUrl: `${window.location.origin}/api/wallet/sign`,
      headers: async (): Promise<Record<string, string>> => {
        const freshToken = await getAccessToken();
        if (!freshToken) return {};
        return { Authorization: `Bearer ${freshToken}` };
      },
    });

    let deployMode: "if_needed" | "never" = "if_needed";
    try {
      // Check pending state — AVNU simulates against pending, so a deploy
      // that's in the mempool but not yet confirmed must be treated as deployed.
      await starknetProvider.getClassHashAt(walletData.address, "pending");
      deployMode = "never";
    } catch {
      // account not yet deployed — proceed with deploy:"if_needed"
    }

    const result = await sdk.onboard({
      strategy: OnboardStrategy.Privy,
      accountPreset: "argentXV050",
      feeMode: "sponsored",
      privy: { resolve: privyResolve },
      deploy: deployMode,
    });

    setWallet(result.wallet);
    setWalletType("privy");
    setAddress(result.wallet.address as unknown as string);
    setPrivyUser(user ?? null);
  }, [getAccessToken, user]);

  // ---------------------------------------------------------------------------
  // Connect Cartridge
  // ---------------------------------------------------------------------------

  const connectCartridge = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const sdk = getStarkZapSdk();
      const result = await sdk.onboard({
        strategy: OnboardStrategy.Cartridge,
        cartridge: {
          policies: CARTRIDGE_POLICIES,
        },
        deploy: "if_needed",
      });

      setWallet(result.wallet);
      setWalletType("cartridge");
      setAddress(result.wallet.address as unknown as string);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect Cartridge"
      );
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Connect Privy (user-initiated — shows the Privy login modal)
  // ---------------------------------------------------------------------------

  const connectPrivy = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      if (!authenticated) {
        await login();
      }
      await initPrivyWallet();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect with Privy"
      );
    } finally {
      setIsConnecting(false);
    }
  }, [authenticated, login, initPrivyWallet]);

  // ---------------------------------------------------------------------------
  // Auto-reconnect: restore Privy wallet on page reload if session is active
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (authenticated && !wallet && walletType !== "cartridge") {
      initPrivyWallet(true).catch((err) => {
        console.error("Privy auto-reconnect failed:", err);
      });
    }
    // intentionally omit wallet/walletType — only re-run when auth changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  const disconnect = useCallback(() => {
    if (walletType === "privy") {
      logout().catch(console.error);
    }
    setWallet(null);
    setWalletType(null);
    setAddress(null);
    setError(null);
    setPrivyUser(null);
  }, [walletType, logout]);

  return (
    <StarkZapWalletContext.Provider
      value={{
        wallet,
        walletType,
        address,
        isConnecting,
        error,
        privyUser,
        connectCartridge,
        connectPrivy,
        disconnect,
      }}
    >
      {children}
    </StarkZapWalletContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const STARKZAP_DEFAULT_CTX: StarkZapWalletCtx = {
  wallet: null,
  walletType: null,
  address: null,
  isConnecting: false,
  error: null,
  privyUser: null,
  connectCartridge: async () => {},
  connectPrivy: async () => {},
  disconnect: () => {},
};

export function useStarkZapWallet(): StarkZapWalletCtx {
  const ctx = useContext(StarkZapWalletContext);
  return ctx ?? STARKZAP_DEFAULT_CTX;
}
