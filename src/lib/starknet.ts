import { RpcProvider } from "starknet";
import { createFailoverFetch } from "@medialane/sdk";
import { RPC_MAIN_URL, RPC_FALLBACK_URL, RPC_PROXY_PATH } from "./constants";

/**
 * ⚠️ The dapp talks to Starknet through several providers — when a read fails,
 * check which one the failing call actually uses (this tripped up the 2026-06-03
 * Alchemy-503 hunt for days):
 *
 *  1. `starknetProvider` (below) — direct `Contract` calls + `waitForTransaction`
 *     in NON-hook contexts: launchpad pages (drop/pop/nfteditions), transfer-
 *     ownership, `use-tx`, `use-coin-price`.
 *  2. starknet-react's provider (`components/starknet-provider.tsx`) — every
 *     `useProvider()` / `useContract()` call (the whole marketplace flow).
 *  3. the SDK client's `getProvider` (`@medialane/sdk`) — SDK-routed ops.
 *
 * #1 + #2 share the `failoverFetch` below; #3 fails over internally. Never give
 * one a bare `new RpcProvider({ nodeUrl })` without `baseFetch`.
 */

/**
 * Resilient Starknet RPC with two roles (see `constants.ts`):
 *  - Browser → the same-origin `/api/rpc` proxy, which forwards to the keyed
 *    MAIN provider server-side (so the key never enters the bundle), then to the
 *    keyless FALLBACK.
 *  - Server → the keyed MAIN directly, then FALLBACK.
 * Both fail over to the keyless public FALLBACK (lava) on a transient error.
 * No provider names, no NEXT_PUBLIC_ keyed URLs, no external fallback lists.
 */
const RPC_PRIMARY = typeof window === "undefined"
  ? (RPC_MAIN_URL || RPC_FALLBACK_URL)
  : RPC_PROXY_PATH;

const RPC_URLS = Array.from(new Set([RPC_PRIMARY, RPC_FALLBACK_URL].filter(Boolean)));

/** The primary RPC URL (the `/api/rpc` proxy in the browser). Share this
 *  everywhere a `nodeUrl` is needed so all client paths stay in lock-step. */
export const RPC_PRIMARY_URL = RPC_URLS[0];

/** Shared failover fetch — exported so the starknet-react provider factory
 *  (`starknet-provider.tsx`) and the singleton below use one implementation. */
export const failoverFetch = createFailoverFetch(RPC_URLS);

// blockIdentifier "latest" — some RPC endpoints reject the "pending" block tag
// ("-32602: Invalid block id"). starknet.js defaults reads (e.g. the Account's
// cairo-version detection via getClassHashAt) to "pending"; force "latest" on
// every RpcProvider built from RPC_PRIMARY_URL (this one and the
// starknet-react provider in starknet-provider.tsx, which must stay in lock-step
// per the note above).
export const RPC_BLOCK_IDENTIFIER = "latest" as const;

/** Shared RpcProvider singleton — import this instead of creating new instances. */
export const starknetProvider = new RpcProvider({
  nodeUrl: RPC_PRIMARY_URL,
  baseFetch: failoverFetch,
  blockIdentifier: RPC_BLOCK_IDENTIFIER,
});
