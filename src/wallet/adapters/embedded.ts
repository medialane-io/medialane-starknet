"use client";

import { useEffect } from "react";
import { OnboardStrategy } from "starkzap";
import { getStarkZapSdk } from "@/lib/starkzap";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { POP_FACTORY_CONTRACT_MAINNET, DROP_FACTORY_CONTRACT_MAINNET } from "@medialane/sdk";
import {
  COLLECTION_721_CONTRACT,
  COLLECTION_1155_CONTRACT,
  MARKETPLACE_721_CONTRACT,
  MARKETPLACE_1155_CONTRACT,
  NFTCOMMENTS_CONTRACT,
  LAUNCH_MINT_CONTRACT,
  MINT_CONTRACT,
  BR_MINT_CONTRACT,
} from "@/lib/constants";
import type { WalletStoreApi } from "../store";
import type { WalletMethod } from "../types";

// ---------------------------------------------------------------------------
// Cartridge session policies (ported verbatim from the old starkzap context).
// Cartridge session keys authorise only the (target, method) pairs below.
// Per-instance contracts (per-collection/pop/drop) have dynamic addresses the
// static list can't cover — known UX gap (extra approval prompt mid-flow).
// ---------------------------------------------------------------------------
export const CARTRIDGE_POLICIES = (
  [
    { target: COLLECTION_721_CONTRACT, method: "mint" },
    { target: COLLECTION_721_CONTRACT, method: "create_collection" },
    { target: COLLECTION_721_CONTRACT, method: "transfer_token" },
    { target: COLLECTION_721_CONTRACT, method: "transfer_collection_ownership" },
    { target: COLLECTION_1155_CONTRACT, method: "deploy_collection" },
    { target: MARKETPLACE_721_CONTRACT, method: "register_order" },
    { target: MARKETPLACE_721_CONTRACT, method: "fulfill_order" },
    { target: MARKETPLACE_721_CONTRACT, method: "cancel_order" },
    { target: MARKETPLACE_1155_CONTRACT, method: "register_order" },
    { target: MARKETPLACE_1155_CONTRACT, method: "fulfill_order" },
    { target: MARKETPLACE_1155_CONTRACT, method: "cancel_order" },
    { target: POP_FACTORY_CONTRACT_MAINNET, method: "create_collection" },
    { target: DROP_FACTORY_CONTRACT_MAINNET, method: "create_drop" },
    { target: NFTCOMMENTS_CONTRACT, method: "add_comment" },
    { target: LAUNCH_MINT_CONTRACT, method: "mint_item" },
    { target: MINT_CONTRACT, method: "mint_item" },
    { target: BR_MINT_CONTRACT, method: "mint_item" },
  ] as { target: string; method: string }[]
).filter((p) => p.target);

/**
 * Embedded host: registers the `embedded` bridge. Cartridge connects directly
 * here; Privy is delegated to the lazy Privy leaf via `requestPrivy` (Privy needs
 * its own React provider). All store writes go through the gated `ingest`.
 */
export function useEmbeddedHost(
  store: WalletStoreApi,
  requestPrivy: (adoptSession: boolean) => void,
) {
  useEffect(() => {
    store.getState().registerBridge("embedded", {
      connect: async (method: WalletMethod, opts) => {
        if (method === "privy") {
          // The leaf runs the verbatim Privy onboarding (auth → deploy → ready).
          requestPrivy(opts?.adoptSession ?? false);
          return;
        }
        // Cartridge — connect directly via StarkZap.
        store.getState().ingest("embedded", {
          status: "connecting",
          method: "cartridge",
          address: null,
          error: null,
        });
        try {
          const sdk = getStarkZapSdk();
          const result = await sdk.onboard({
            strategy: OnboardStrategy.Cartridge,
            cartridge: { policies: CARTRIDGE_POLICIES },
            deploy: "if_needed",
          });
          store.getState().ingest(
            "embedded",
            {
              status: "ready",
              method: "cartridge",
              address: result.wallet.address as unknown as string,
              error: null,
            },
            result.wallet,
          );
        } catch (err) {
          console.error("[Cartridge] connect failed:", err);
          store.getState().ingest("embedded", {
            status: "error",
            method: "cartridge",
            address: null,
            error: getFriendlyWalletError(err).message,
          });
        }
      },
      disconnect: () => {
        // Cartridge has no explicit logout; clearing store state (done by
        // useWallet.disconnect) is sufficient. Privy logout is handled by the leaf.
        store.getState().ingest("embedded", {
          status: "idle",
          method: null,
          address: null,
          error: null,
        });
      },
    });
  }, [store, requestPrivy]);
}
