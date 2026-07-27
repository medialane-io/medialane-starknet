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

// Cartridge's own hosted RPC — required by its chain-detector (see the
// comment at its use site in connectCartridge). Same value as StarkZap's
// "mainnet" network preset, now inlined since Controller is constructed
// directly instead of through StarkZap.
const CARTRIDGE_RPC_URL = "https://api.cartridge.gg/x/starknet/mainnet";
const CONTROLLER_MAX_WAIT_MS = 10_000;
const CONTROLLER_INITIAL_POLL_MS = 100;
const CONTROLLER_MAX_POLL_MS = 1_000;

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

export type CartridgeWalletType = "cartridge";

export interface CartridgeWalletCtx {
  wallet: WalletInterface | null;
  session: WalletSession;
  walletType: CartridgeWalletType | null;
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
  /**
   * Requests a session-scoped, amount-bounded ERC-20 approval — Cartridge's
   * `Approval` policy type (`{ entrypoint: "approve", spender, amount }`),
   * distinct from a plain target+method `CallPolicy`. This is the ONLY way
   * an ERC-20 `approve` can ever be session-scoped: `toWasmPolicies` (in
   * @cartridge/controller) requires both `spender` and `amount` on an
   * approve method or it silently downgrades to a plain (unusable, per our
   * own testing) CallPolicy. Bounded to the exact spender+amount requested —
   * never an unlimited/standing approval — so this carries none of the
   * privilege-escalation risk a blanket `ensureCartridgePolicy` grant would
   * for a payment token. Throws if the user declines.
   */
  ensureCartridgeApproval: (token: string, spender: string, amount: string) => Promise<void>;
}

const CartridgeWalletContext = createContext<CartridgeWalletCtx | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider — Cartridge onboarding only (Privy removed).
// ---------------------------------------------------------------------------

export function CartridgeWalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<WalletInterface | null>(null);
  const [session, setSession] = useState<WalletSession>(IDLE_WALLET_SESSION);
  const walletType = session.walletType === "cartridge" ? session.walletType : null;
  const address = session.address;
  const isConnecting = isWalletSessionBusy(session);
  const error = session.error;
  // (target, method) pairs granted via updateSession this session — reset
  // on disconnect since a fresh connect starts from the static list again.
  const dynamicPoliciesRef = useRef<Map<string, { target: string; method: string }>>(new Map());
  // ERC-20 Approval grants (target/spender/amount) — separate from the plain
  // CallPolicy grants above since they're a structurally different Cartridge
  // policy type (see ensureCartridgeApproval). Also reset on disconnect.
  const approvalPoliciesRef = useRef<Map<string, { target: string; spender: string; amount: string }>>(new Map());

  const connectCartridge = useCallback(async () => {
    setSession(walletConnecting("cartridge"));
    try {
      // Connect via @cartridge/controller directly — NOT through StarkZap.
      // StarkZap's CartridgeWallet.create() has a fixed options type that
      // cannot pass through `errorDisplayMode`/`propagateSessionErrors`
      // (confirmed against Cartridge's own docs + its .d.ts — those fields
      // structurally don't exist on CartridgeWalletOptions). Left unset,
      // Cartridge's own default apparently never opens its confirmation
      // modal for a call outside session policy — execute() just hangs
      // with no UI and no error. Constructing Controller ourselves is the
      // only way to set them. Loads only on connect/resume, same as the
      // StarkZap import it replaces — kept out of the first-load bundle.
      const [{ default: Controller, toSessionPolicies }, { RpcProvider }] = await Promise.all([
        import("@cartridge/controller"),
        import("starknet"),
      ]);

      const controller = new Controller({
        // Cartridge's chain-detector only recognizes RPC URLs whose path
        // contains "starknet"/"mainnet" (its own hosted-RPC convention) —
        // this exact URL is StarkZap's "mainnet" network preset, carried
        // over verbatim. A different RPC URL here broke Cartridge connect
        // entirely for ~4 weeks previously; do not change without checking
        // that history first.
        chains: [{ rpcUrl: CARTRIDGE_RPC_URL }],
        policies: toSessionPolicies(CARTRIDGE_POLICIES),
        errorDisplayMode: "modal",
        propagateSessionErrors: false,
      });

      // Mirrors StarkZap's own CartridgeWallet.create() readiness poll —
      // Controller needs to finish async init before connect() is reliable.
      let waited = 0;
      let pollMs = CONTROLLER_INITIAL_POLL_MS;
      while (!controller.isReady() && waited < CONTROLLER_MAX_WAIT_MS) {
        const sleepMs = Math.min(pollMs, CONTROLLER_MAX_WAIT_MS - waited);
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
        waited += sleepMs;
        pollMs = Math.min(pollMs * 2, CONTROLLER_MAX_POLL_MS);
      }
      if (!controller.isReady()) {
        throw new Error("Cartridge Controller failed to initialize. Please try again.");
      }

      const walletAccount = await controller.connect();
      if (!walletAccount) {
        throw new Error("Cartridge connection failed. Make sure popups are allowed and try again.");
      }

      const provider = new RpcProvider({ nodeUrl: controller.rpcUrl() });
      const address = walletAccount.address as unknown as string;

      // Minimal shim matching the exact surface every real consumer in this
      // app uses (grepped: only .address / .signMessage() / .execute() /
      // .getController() — nothing StarkZap-specific like staking/bridging).
      // `execute()` returns { hash, wait() } to match what those call sites
      // already expect from StarkZap's own Tx wrapper.
      const cartridgeWallet = {
        address,
        signMessage: (typedData: unknown) => walletAccount.signMessage(typedData as never),
        execute: async (calls: unknown) => {
          const response = await walletAccount.execute(calls as never);
          const hash = response.transaction_hash;
          return { hash, wait: () => provider.waitForTransaction(hash) };
        },
        getController: () => controller,
      } as unknown as WalletInterface;

      setWallet(cartridgeWallet);
      setSession(walletReady("cartridge", address));
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
    approvalPoliciesRef.current.clear();
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

  const ensureCartridgeApproval = useCallback(async (token: string, spender: string, amount: string): Promise<void> => {
    if (!wallet) return;
    const key = `${token}:${spender}:${amount}`;
    if (approvalPoliciesRef.current.has(key)) return;

    const controller = (wallet as { getController?: () => unknown }).getController?.() as
      | { updateSession: (options: { policies: unknown }) => Promise<{ code: number } | undefined> }
      | undefined;
    if (!controller || typeof controller.updateSession !== "function") return;

    const { toSessionPolicies } = await import("@cartridge/controller");
    // updateSession SETS the session's policies — it does not merge with
    // whatever's already active — so every call must carry every approval
    // granted so far this session, not just the new one (mirrors
    // ensureCartridgePolicy's [...CARTRIDGE_POLICIES, ...granted, pending]
    // pattern for plain CallPolicy grants).
    const base = toSessionPolicies(CARTRIDGE_POLICIES) as {
      contracts?: Record<string, { methods?: unknown[] } | undefined>;
      messages?: unknown[];
    };
    const contracts: Record<string, { methods: unknown[] }> = {};
    for (const [addr, policy] of Object.entries(base.contracts ?? {})) {
      contracts[addr] = { methods: [...(policy?.methods ?? [])] };
    }
    const pending = { target: token, spender, amount };
    for (const grant of [...approvalPoliciesRef.current.values(), pending]) {
      const existing = contracts[grant.target] ?? { methods: [] };
      contracts[grant.target] = {
        methods: [...existing.methods, { entrypoint: "approve", spender: grant.spender, amount: grant.amount }],
      };
    }

    const reply = await controller.updateSession({ policies: { ...base, contracts } });
    if (!reply) {
      // undefined = user declined or the keychain closed without granting.
      throw new Error("Cartridge declined the spending approval needed for this action.");
    }
    approvalPoliciesRef.current.set(key, pending);
  }, [wallet]);

  return (
    <CartridgeWalletContext.Provider
      value={{ wallet, session, walletType, address, isConnecting, error, connectCartridge, disconnect, ensureCartridgePolicy, ensureCartridgeApproval }}
    >
      {children}
    </CartridgeWalletContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

const CARTRIDGE_DEFAULT_CTX: CartridgeWalletCtx = {
  wallet: null, session: IDLE_WALLET_SESSION, walletType: null, address: null,
  isConnecting: false, error: null,
  connectCartridge: async () => {},
  disconnect: () => {},
  ensureCartridgePolicy: async () => {},
  ensureCartridgeApproval: async () => {},
};

export function useCartridgeWallet(): CartridgeWalletCtx {
  return useContext(CartridgeWalletContext) ?? CARTRIDGE_DEFAULT_CTX;
}
