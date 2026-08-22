import { RpcProvider } from "starknet";
import { RPC_PROXY_PATH, MEDIALANE_BACKEND_URL } from "./constants";

export const RPC_BLOCK_IDENTIFIER = "latest" as const;

export const RPC_PRIMARY_URL =
  typeof window === "undefined"
    ? `${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/rpc`
    : RPC_PROXY_PATH;

export const starknetProvider = new RpcProvider({
  nodeUrl: RPC_PRIMARY_URL,
  blockIdentifier: RPC_BLOCK_IDENTIFIER,
});
