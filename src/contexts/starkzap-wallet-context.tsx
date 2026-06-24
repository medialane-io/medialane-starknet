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
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { writePersistedWallet, clearPersistedWallet } from "@/lib/wallet-types";
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
  STARKNET_POP_FACTORY_CONTRACT,
  STARKNET_DROP_FACTORY_CONTRACT,
  STARKNET_CREATOR_COIN_FACTORY_CONTRACT,
} from "@medialane/sdk";
import {
  STARKNET_COLLECTION_721_CONTRACT,
  STARKNET_COLLECTION_1155_CONTRACT,
  STARKNET_MARKETPLACE_721_CONTRACT,
  STARKNET_MARKETPLACE_1155_CONTRACT,
  STARKNET_NFTCOMMENTS_CONTRACT,
  LAUNCH_MINT_CONTRACT,
  MINT_CONTRACT,
  BR_MINT_CONTRACT,
} from "@/lib/constants";

// ---------------------------------------------------------------------------
// Cartridge session policies for Medialane contracts
// ---------------------------------------------------------------------------
//
// Cartridge session keys authorise only the (target, method) pairs in this
// list — anything outside triggers a fresh PIN/passkey prompt or, in some
// SDK versions, a hard rejection. Adding a method to the dapp without a
// matching policy entry silently breaks the feature for Cartridge users.
//
// Per-collection NFT / POP / Drop contracts have DYNAMIC addresses (one per
// event / drop / minted collection). The static target list below cannot
// cover them. Cartridge users hitting those flows currently fall back to
// an additional approval prompt — known UX gap, tracked as the next item
// after this PR.

export const CARTRIDGE_POLICIES = (
  [
    // ── MIP collection registry (ERC-721) ───────────────────────────────
    { target: STARKNET_COLLECTION_721_CONTRACT, method: "mint" },
    { target: STARKNET_COLLECTION_721_CONTRACT, method: "create_collection" },
    { target: STARKNET_COLLECTION_721_CONTRACT, method: "transfer_token" },
    { target: STARKNET_COLLECTION_721_CONTRACT, method: "transfer_collection_ownership" },
    // ── IP-Programmable ERC-1155 factory ────────────────────────────────
    { target: STARKNET_COLLECTION_1155_CONTRACT, method: "deploy_collection" },
    // ── Marketplace contracts ───────────────────────────────────────────
    { target: STARKNET_MARKETPLACE_721_CONTRACT, method: "register_order" },
    { target: STARKNET_MARKETPLACE_721_CONTRACT, method: "fulfill_order" },
    { target: STARKNET_MARKETPLACE_721_CONTRACT, method: "cancel_order" },
    { target: STARKNET_MARKETPLACE_1155_CONTRACT, method: "register_order" },
    { target: STARKNET_MARKETPLACE_1155_CONTRACT, method: "fulfill_order" },
    { target: STARKNET_MARKETPLACE_1155_CONTRACT, method: "cancel_order" },
    // ── POP / Drop factories (collection creation) ──────────────────────
    { target: STARKNET_POP_FACTORY_CONTRACT, method: "create_collection" },
    { target: STARKNET_DROP_FACTORY_CONTRACT, method: "create_drop" },
    // ── Creator Coin factory (launch flow) ──────────────────────────────
    // The launch multicall also transfers the buyback quote (STRK/ETH) to
    // the factory; that ERC-20 `transfer` deliberately stays OFF this list
    // (same precedent as marketplace `approve`) — fund-moving methods get a
    // per-tx Cartridge prompt instead of silent session scope.
    { target: STARKNET_CREATOR_COIN_FACTORY_CONTRACT, method: "create_creator_coin" },
    { target: STARKNET_CREATOR_COIN_FACTORY_CONTRACT, method: "launch_on_ekubo" },
    // ── NFT comments ────────────────────────────────────────────────────
    { target: STARKNET_NFTCOMMENTS_CONTRACT, method: "add_comment" },
    // ── Static airdrop / launch mint contracts ──────────────────────────
    // GenesisMint (used by /mint, /airdrop, /br/mint, /launch via
    // launch-mint.tsx) calls mint_item on these fixed env-driven targets.
    // Each may be unconfigured (empty string) in environments without
    // the campaign — `.filter(Boolean)` below drops those entries so we
    // never send `target: ""` to the Cartridge SDK.
    { target: LAUNCH_MINT_CONTRACT, method: "mint_item" },
    { target: MINT_CONTRACT, method: "mint_item" },
    { target: BR_MINT_CONTRACT, method: "mint_item" },
  ] as { target: string; method: string }[]
).filter((p) => p.target);

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
      writePersistedWallet("cartridge");
    } catch (err) {
      // Raw detail → console only; user sees a friendly message.
      console.error("[Cartridge] connect failed:", err);
      setWallet(null);
      setSession(walletError("cartridge", getFriendlyWalletError(err).message));
    }
  }, []);

  const connectPrivy = useCallback(async () => {
    writePersistedWallet("privy");
    setSession(walletAuthenticating("privy"));
    onRequestPrivy();
    setPendingPrivyConnect(true);
  }, [onRequestPrivy]);

  const disconnect = useCallback(() => {
    clearPersistedWallet();
    setWallet(null);
    setSession(IDLE_WALLET_SESSION);
    setPrivyUser(null);
  }, []);

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
