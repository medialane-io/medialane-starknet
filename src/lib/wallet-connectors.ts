import { ArgentX } from "starknetkit/argentX";
import { Braavos } from "starknetkit/braavos";
import { MetaMask } from "starknetkit/metamask";
import { Keplr } from "starknetkit/keplr";
import { Fordefi } from "starknetkit/fordefi";
import { Xverse } from "starknetkit/xverse";
import { ControllerConnector } from "starknetkit/controller";
import type { Connector } from "@starknet-react/core";
import {
  STARKNET_MARKETPLACE_721_CONTRACT,
  STARKNET_MARKETPLACE_1155_CONTRACT,
  STARKNET_COLLECTION_721_CONTRACT,
  STARKNET_COLLECTION_1155_CONTRACT,
  STARKNET_NFTCOMMENTS_CONTRACT,
  STARKNET_POP_FACTORY_CONTRACT,
  STARKNET_DROP_FACTORY_CONTRACT,
  STARKNET_IP_TICKETS_FACTORY_CONTRACT,
  STARKNET_IP_CLUB_FACTORY_CONTRACT,
  getListableTokens,
} from "@medialane/sdk";

/**
 * Cartridge session policies — pre-approved, popup-free calls for the
 * connected session. Only fixed protocol contracts can be listed here;
 * per-creator collections (POP/Drop/Ticket/Club/mint instances) are deployed
 * at a new address every time, so they can't be pre-registered in a static
 * policy list.
 *
 * Verified against the actual SDK call-builders (not guessed from names):
 * listing AND making an offer both call `register_order`; buying/accepting
 * calls `fulfill_order`; canceling calls `cancel_order` (all on the
 * marketplace contracts). Every one of those also does an ERC20 `approve` on
 * the payment token as part of the same atomic multicall, plus a `transfer`
 * for the platform fee — both against one of the fixed listable-token
 * contracts, so they're listed here too. Listing an item and accepting a
 * single offer ALSO need an approve/set_approval_for_all on the traded NFT's
 * own contract, which is a different address per listing — that can never be
 * covered by a static policy, so those two actions still prompt normally
 * even with Cartridge connected.
 */
const method = (name: string) => ({ name, entrypoint: name });

const paymentTokenPolicies = Object.fromEntries(
  getListableTokens().map((t) => [
    t.address,
    { description: `${t.symbol} token`, methods: [method("approve"), method("transfer")] },
  ]),
);

const cartridgeController = new ControllerConnector({
  policies: {
    contracts: {
      [STARKNET_MARKETPLACE_721_CONTRACT]: {
        description: "Marketplace (721)",
        methods: [method("register_order"), method("fulfill_order"), method("cancel_order")],
      },
      [STARKNET_MARKETPLACE_1155_CONTRACT]: {
        description: "Marketplace (1155)",
        methods: [method("register_order"), method("fulfill_order"), method("cancel_order")],
      },
      ...paymentTokenPolicies,
      [STARKNET_COLLECTION_721_CONTRACT]: {
        description: "Collection Registry (721)",
        methods: [method("transfer_collection_ownership")],
      },
      [STARKNET_COLLECTION_1155_CONTRACT]: {
        description: "Single-Edition Factory (1155)",
        methods: [method("deploy_collection")],
      },
      [STARKNET_NFTCOMMENTS_CONTRACT]: {
        description: "Comments",
        methods: [method("add_comment")],
      },
      [STARKNET_POP_FACTORY_CONTRACT]: {
        description: "POP Factory",
        methods: [method("create_collection")],
      },
      [STARKNET_DROP_FACTORY_CONTRACT]: {
        description: "Drop Factory",
        methods: [method("create_drop")],
      },
      [STARKNET_IP_TICKETS_FACTORY_CONTRACT]: {
        description: "Tickets Factory",
        methods: [method("deploy_collection")],
      },
      [STARKNET_IP_CLUB_FACTORY_CONTRACT]: {
        description: "Club Factory",
        methods: [method("deploy_collection")],
      },
    },
  },
});

/**
 * Single source of truth for every supported wallet: its connector instance
 * and (if it has one) where to send a user who doesn't have it installed.
 * Add a wallet here — nothing else needs to change.
 */
const SUPPORTED_WALLETS: { connector: Connector; installUrl?: string }[] = [
  { connector: new ArgentX(), installUrl: "https://www.ready.co/download" },
  { connector: new Braavos(), installUrl: "https://braavos.app/download-braavos-wallet/" },
  { connector: cartridgeController },
  { connector: new MetaMask(), installUrl: "https://metamask.io/download/" },
  { connector: new Keplr(), installUrl: "https://www.keplr.app/download" },
  { connector: new Fordefi() },
  { connector: new Xverse(), installUrl: "https://www.xverse.app/download" },
];

export const walletConnectors: Connector[] = SUPPORTED_WALLETS.map((w) => w.connector);

export const WALLET_INSTALL_URLS: Record<string, string> = Object.fromEntries(
  SUPPORTED_WALLETS.filter((w) => w.installUrl).map((w) => [w.connector.id, w.installUrl!]),
);
