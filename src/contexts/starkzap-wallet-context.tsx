"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { WalletInterface } from "starkzap";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { writePersistedWallet, clearPersistedWallet } from "@/lib/wallet-types";
import {
  IDLE_WALLET_SESSION,
  isWalletSessionBusy,
  walletConnecting,
  walletError,
  walletReady,
  type WalletSession,
} from "@/lib/wallet-session";
import {
  STARKNET_POP_FACTORY_CONTRACT,
  STARKNET_DROP_FACTORY_CONTRACT,
  STARKNET_CREATOR_COIN_FACTORY_CONTRACT,
  STARKNET_IP_TICKETS_FACTORY_CONTRACT,
  STARKNET_IP_CLUB_FACTORY_CONTRACT,
  STARKNET_IP_SPONSORSHIP_CONTRACT,
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
// cover them by construction. For those, callers must request scope at the
// point of use via `ensureCartridgePolicy(target, method)` (below) instead
// of assuming the static list already covers it — see the marketplace
// listing/offer flow (`use-venue-signer.ts`) for the reference call site.

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
    // ── IP Tickets factory (static — per-collection create_event/mint
    // have dynamic addresses and remain outside this list) ────────────
    { target: STARKNET_IP_TICKETS_FACTORY_CONTRACT, method: "deploy_collection" },
    // ── IP Club factory (static — per-club create_membership/mint have
    // dynamic addresses and remain outside this list, same as Tickets) ─
    { target: STARKNET_IP_CLUB_FACTORY_CONTRACT, method: "deploy_collection" },
    // ── IP Sponsorship v3 (single static contract — registry + license
    // collection in one, no factory, so every method can be session-scoped;
    // the license mints internally from accept_bid/accept_proposal, so
    // there is no separate receipt-mint entrypoint anymore) ────────────────
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "create_offer" },
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "set_offer_open" },
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "place_bid" },
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "retract_bid" },
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "accept_bid" },
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "propose_sponsorship" },
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "withdraw_proposal" },
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "accept_proposal" },
    { target: STARKNET_IP_SPONSORSHIP_CONTRACT, method: "reject_proposal" },
    // `approve` for place_bid's payment token deliberately stays OFF this
    // list, matching the marketplace/creator-coin precedent for
    // fund-moving ERC-20 calls — a per-tx Cartridge prompt instead of
    // silent session scope.
    // ── NFT comments ────────────────────────────────────────────────────
    { target: STARKNET_NFTCOMMENTS_CONTRACT, method: "add_comment" },
    // ── Static airdrop / launch mint contracts ──────────────────────────
    // GenesisMint (used by /mint, /airdrop, /br/mint) calls mint_item on
    // these fixed env-driven targets. Each may be unconfigured (empty
    // string) in environments without the campaign — `.filter(Boolean)`
    // below drops those entries so we never send `target: ""` to the
    // Cartridge SDK.
    { target: LAUNCH_MINT_CONTRACT, method: "mint_item" },
    { target: MINT_CONTRACT, method: "mint_item" },
    { target: BR_MINT_CONTRACT, method: "mint_item" },
  ] as { target: string; method: string }[]
).filter((p) => p.target);

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export type StarkZapWalletType = "cartridge";

export interface StarkZapWalletCtx {
  wallet: WalletInterface | null;
  session: WalletSession;
  walletType: StarkZapWalletType | null;
  address: string | null;
  isConnecting: boolean;
  error: string | null;
  connectCartridge: () => Promise<void>;
  disconnect: () => void;
  /**
   * Requests session scope for a (target, method) pair not covered by the
   * static `CARTRIDGE_POLICIES` list — the only way to cover per-instance
   * contracts (a specific collection's `approve`, a specific event's
   * `claim`, etc.), which by definition can never be enumerated ahead of
   * time. No-ops if the pair is already covered (static or previously
   * granted this session) or if there's no active Cartridge wallet. Throws
   * if the user declines the resulting Cartridge prompt.
   */
  ensureCartridgePolicy: (target: string, method: string) => Promise<void>;
}

const StarkZapWalletContext = createContext<StarkZapWalletCtx | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider — Cartridge onboarding only (Privy removed).
// ---------------------------------------------------------------------------

export function StarkZapWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [session, setSession] = useState<WalletSession>(IDLE_WALLET_SESSION);
  const walletType = session.walletType === "cartridge" ? session.walletType : null;
  const address = session.address;
  const isConnecting = isWalletSessionBusy(session);
  const error = session.error;
  // (target, method) pairs granted via updateSession this session — reset
  // on disconnect since a fresh connect starts from the static list again.
  const dynamicPoliciesRef = useRef<Map<string, { target: string; method: string }>>(new Map());

  const connectCartridge = useCallback(async () => {
    setSession(walletConnecting("cartridge"));
    try {
      // StarkZap (and its zod-heavy dependency graph) loads only when a
      // Cartridge connect/resume actually happens — keeping it out of the
      // first-load bundle of every page for every visitor. This callback is
      // also the silent-resume path on reload, so both flows are covered.
      const [{ OnboardStrategy }, { getCartridgeStarkZapSdk }] = await Promise.all([
        import("starkzap"),
        import("@/lib/starkzap"),
      ]);
      const sdk = getCartridgeStarkZapSdk();
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

  const disconnect = useCallback(() => {
    clearPersistedWallet();
    setWallet(null);
    setSession(IDLE_WALLET_SESSION);
    dynamicPoliciesRef.current.clear();
  }, []);

  const ensureCartridgePolicy = useCallback(async (target: string, method: string): Promise<void> => {
    if (!wallet) return;
    if (CARTRIDGE_POLICIES.some((p) => p.target === target && p.method === method)) return;
    const key = `${target}:${method}`;
    if (dynamicPoliciesRef.current.has(key)) return;

    // Only CartridgeWallet exposes getController(); WalletInterface doesn't
    // declare it. If it's ever missing (SDK shape change), let execute()
    // fail downstream with its own error rather than throw here.
    const controller = (wallet as { getController?: () => unknown }).getController?.() as
      | { updateSession: (options: { policies: unknown }) => Promise<{ code: number } | undefined> }
      | undefined;
    if (!controller || typeof controller.updateSession !== "function") return;

    const { toSessionPolicies } = await import("@cartridge/controller");
    const pending = { target, method };
    const reply = await controller.updateSession({
      policies: toSessionPolicies([...CARTRIDGE_POLICIES, ...dynamicPoliciesRef.current.values(), pending]),
    });
    if (!reply) {
      // undefined = user declined or the keychain closed without granting.
      throw new Error("Cartridge declined the additional approval needed for this action.");
    }
    dynamicPoliciesRef.current.set(key, pending);
  }, [wallet]);

  return (
    <StarkZapWalletContext.Provider
      value={{ wallet, session, walletType, address, isConnecting, error, connectCartridge, disconnect, ensureCartridgePolicy }}
    >
      {children}
    </StarkZapWalletContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

const STARKZAP_DEFAULT_CTX: StarkZapWalletCtx = {
  wallet: null, session: IDLE_WALLET_SESSION, walletType: null, address: null,
  isConnecting: false, error: null,
  connectCartridge: async () => {},
  disconnect: () => {},
  ensureCartridgePolicy: async () => {},
};

export function useStarkZapWallet(): StarkZapWalletCtx {
  return useContext(StarkZapWalletContext) ?? STARKZAP_DEFAULT_CTX;
}
