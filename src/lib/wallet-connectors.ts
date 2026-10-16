import { ArgentX } from "starknetkit/argentX";
import { Braavos } from "starknetkit/braavos";
import { MetaMask } from "starknetkit/metamask";
import { Keplr } from "starknetkit/keplr";
import { Fordefi } from "starknetkit/fordefi";
import { Xverse } from "starknetkit/xverse";
import { ControllerConnector } from "@cartridge/connector";
import { constants, TypedDataRevision } from "starknet";
import type { Connector } from "@starknet-react/core";
import {
  STARKNET_MARKETPLACE_721_CONTRACT,
  STARKNET_MARKETPLACE_1155_CONTRACT,
  STARKNET_COLLECTION_1155_CONTRACT,
  STARKNET_NFTCOMMENTS_CONTRACT,
  STARKNET_POP_FACTORY_CONTRACT,
  STARKNET_DROP_FACTORY_CONTRACT,
  STARKNET_IP_TICKETS_FACTORY_CONTRACT,
  STARKNET_IP_CLUB_FACTORY_CONTRACT,
} from "@medialane/sdk";

const method = (name: string) => ({ name, entrypoint: name });

const STARKNET_DOMAIN_TYPE = [
  { name: "name", type: "shortstring" },
  { name: "version", type: "shortstring" },
  { name: "chainId", type: "shortstring" },
  { name: "revision", type: "shortstring" },
];
const ORDER_CANCELLATION_TYPE = [
  { name: "order_hash", type: "felt" },
  { name: "offerer", type: "ContractAddress" },
];

const snip12Domain = (version: "5" | "4") => ({
  name: "Medialane",
  version,
  chainId: constants.StarknetChainId.SN_MAIN,
  revision: TypedDataRevision.ACTIVE,
});

const cancellationMessagePolicy = (name: string, description: string, version: "5" | "4") => ({
  name,
  description,
  domain: snip12Domain(version),
  primaryType: "OrderCancellation",
  types: {
    StarknetDomain: STARKNET_DOMAIN_TYPE,
    OrderCancellation: ORDER_CANCELLATION_TYPE,
  },
});

const cartridgeController = new ControllerConnector({
  lazyload: true,
  policies: {
    messages: [
      cancellationMessagePolicy("Cancel order (721)", "Sign a marketplace order cancellation", "5"),
      cancellationMessagePolicy("Cancel order (1155)", "Sign a marketplace order cancellation", "4"),
    ],
    contracts: {
      [STARKNET_MARKETPLACE_721_CONTRACT]: {
        description: "Marketplace (721)",
        methods: [method("cancel_order")],
      },
      [STARKNET_MARKETPLACE_1155_CONTRACT]: {
        description: "Marketplace (1155)",
        methods: [method("cancel_order")],
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

type ConnectorIconObj = { dark?: string; light?: string };

export function getConnectorIconSrc(icon: ConnectorIconObj | string | undefined): string | undefined {
  if (!icon) return undefined;
  if (typeof icon === "string") return icon;
  return icon.dark ?? icon.light;
}
