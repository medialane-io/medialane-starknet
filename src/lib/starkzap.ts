/**
 * StarkZap SDK integration for Medialane dApp
 *
 * Provides a singleton StarkZap SDK instance, token presets, and shared helpers
 * used by hooks for transaction monitoring, ERC20 balances, and STRK staking.
 *
 * Version note: StarkZap bundles starknet v9 internally while the app uses starknet v8
 * via starknet-react. These two stacks coexist: primitives (addresses, tx hashes)
 * are shared as plain strings; starknet.js Account objects are NOT mixed across stacks.
 */

import { StarkZap, ChainId, getStakingPreset, fromAddress } from "starkzap";
import type { Token } from "starkzap";
import { getCoordinates, getTokenBySymbol } from "@medialane/sdk";

// ---------------------------------------------------------------------------
// Network resolution
// ---------------------------------------------------------------------------

// Medialane is mainnet-only. (Multichain later = add chains, never testnets.)
export const APP_CHAIN_ID: ChainId = ChainId.MAINNET;

// ---------------------------------------------------------------------------
// SDK singleton
// ---------------------------------------------------------------------------

let _sdk: StarkZap | null = null;

/**
 * Returns a shared StarkZap SDK instance configured for the app's network.
 * Uses the app's custom RPC URL if set, otherwise falls back to StarkZap's
 * default Cartridge RPC endpoint for the selected network.
 */
export function getStarkZapSdk(): StarkZap {
  if (_sdk) return _sdk;

  // StarkZap builds its OWN internal RpcProvider from a single `rpcUrl` and its
  // config (SDKConfig) exposes no baseFetch/provider hook — so it CANNOT use the
  // dapp's multi-endpoint failover (see src/lib/starknet.ts: StarkZap is the 4th
  // RPC path, outside the 3 failover-covered providers). Pointing it at Alchemy —
  // the capped endpoint that intermittently -32001s, the whole reason failover
  // exists — means its chainId/connect calls fail with nothing to fall back to.
  // Pin it to the reliable Lava RPC (spec 0.8, used by every mainnet op) —
  // the chain registry's rpcUrl for Starknet (replaces the removed DEFAULT_RPC_URL).
  const rpcUrl = getCoordinates("STARKNET").rpcUrl;
  const avnuApiKey = process.env.NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY;

  // Pass the AVNU API key so sponsored (feeMode: "sponsored") deployments
  // and transactions are accepted by the paymaster.
  const paymaster = avnuApiKey
    ? {
        nodeUrl: "https://starknet.paymaster.avnu.fi",
        headers: { "x-paymaster-api-key": avnuApiKey },
      }
    : undefined;

  _sdk = new StarkZap({ rpcUrl, chainId: APP_CHAIN_ID, paymaster });

  return _sdk;
}

export function isStarkZapSponsorshipEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY);
}

// ---------------------------------------------------------------------------
// Staking config helper
// ---------------------------------------------------------------------------

/**
 * Returns the staking contract config for the current chain using
 * StarkZap's built-in presets (no hardcoded addresses needed).
 */
export function getAppStakingConfig() {
  return getStakingPreset(APP_CHAIN_ID);
}

// ---------------------------------------------------------------------------
// Token presets
// ---------------------------------------------------------------------------

/**
 * Common Starknet ERC20 token definitions. Address + decimals come from the
 * SDK's SUPPORTED_TOKENS (single source — kills the bridged-vs-native USDC
 * drift); only the display name is local.
 */
const szToken = (symbol: string, name: string): Token => {
  const t = getTokenBySymbol(symbol)!;
  return { name, symbol, address: fromAddress(t.address), decimals: t.decimals };
};

export const STARKZAP_TOKENS = {
  STRK: szToken("STRK", "Starknet Token"),
  ETH: szToken("ETH", "Ether"),
  USDC: szToken("USDC", "USD Coin"),
  USDT: szToken("USDT", "Tether USD"),
  WBTC: szToken("WBTC", "Wrapped Bitcoin"),
} satisfies Record<string, Token>;

export type StarkZapTokenKey = keyof typeof STARKZAP_TOKENS;

// Re-export commonly used StarkZap types for convenience
export { Amount, Tx, Erc20, fromAddress } from "starkzap";
export type { Token, Address } from "starkzap";
