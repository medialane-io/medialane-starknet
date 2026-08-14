import { RpcProvider } from "starknet";
import { createFailoverFetch } from "@medialane/sdk";
import { RPC_MAIN_URL, RPC_FALLBACK_URL, RPC_PROXY_PATH } from "./constants";

const RPC_PRIMARY = typeof window === "undefined"
  ? (RPC_MAIN_URL || RPC_FALLBACK_URL)
  : RPC_PROXY_PATH;

const RPC_URLS = Array.from(new Set([RPC_PRIMARY, RPC_FALLBACK_URL].filter(Boolean)));

export const RPC_PRIMARY_URL = RPC_URLS[0];

export const failoverFetch = createFailoverFetch(RPC_URLS);

export const RPC_BLOCK_IDENTIFIER = "latest" as const;

export const starknetProvider = new RpcProvider({
  nodeUrl: RPC_PRIMARY_URL,
  baseFetch: failoverFetch,
  blockIdentifier: RPC_BLOCK_IDENTIFIER,
});
