/**
 * AVNU Exchange swap utilities for Medialane.
 *
 * Uses the AVNU REST API directly (no extra SDK dependency) so execution
 * can be routed through the existing unified wallet / paymaster pipeline.
 *
 * Flow:
 *   fetchSwapQuotes()  →  buildSwapCall()  →  execute([approveCall, swapCall])
 */

import { getTokenBySymbol } from "@medialane/sdk";

// Medialane is mainnet-only; AVNU runs on Starknet mainnet (no Sepolia).
const AVNU_API = "https://starknet.api.avnu.fi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwapRoute {
  name: string;
  address: string;
  percent: number;
  sellTokenAddress: string;
  buyTokenAddress: string;
}

export interface SwapQuote {
  quoteId: string;
  sellTokenAddress: string;
  /** Hex string, e.g. "0x3b9aca00" */
  sellAmount: string;
  buyTokenAddress: string;
  buyAmount: string;
  buyAmountWithoutFees: string;
  priceRatioUsd: number;
  gasFees: string;
  avnuFees: string;
  avnuFeesBps: string;
  routes: SwapRoute[];
  liquiditySource: string;
}

export interface BuildSwapCall {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}

// ---------------------------------------------------------------------------
// Token config
// ---------------------------------------------------------------------------

export interface SwapToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  color: string;
}

// Address + decimals come from the SDK's SUPPORTED_TOKENS (single source — kills
// the bridged-vs-native USDC drift); only the display name + brand color are
// local UI metadata.
const SWAP_TOKEN_META: { symbol: string; name: string; color: string }[] = [
  { symbol: "ETH",  name: "Ether",           color: "#627EEA" },
  { symbol: "STRK", name: "Starknet Token",  color: "#FF875B" },
  { symbol: "USDC", name: "USD Coin",        color: "#2775CA" },
  { symbol: "USDT", name: "Tether USD",      color: "#26A17B" },
  { symbol: "WBTC", name: "Wrapped Bitcoin", color: "#F7931A" },
];

export const SWAP_TOKENS: SwapToken[] = SWAP_TOKEN_META.map(({ symbol, name, color }) => {
  const t = getTokenBySymbol(symbol)!;
  return { symbol, name, address: t.address, decimals: t.decimals, color };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a value that might be a hex string, decimal string, or number to bigint. */
export function parseToBigInt(value: string | number): bigint {
  if (typeof value === "number") return BigInt(Math.floor(value));
  if (typeof value === "string" && value.startsWith("0x")) return BigInt(value);
  return BigInt(value);
}

/** Format a bigint token amount to a human-readable string (up to 6 significant decimals). */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "");
  return `${whole}.${fractionStr}`;
}

/** Parse a human-readable amount string to raw bigint. */
export function parseTokenAmount(value: string, decimals: number): bigint {
  if (!value || isNaN(parseFloat(value))) return 0n;
  const [wholePart, fracPart = ""] = value.split(".");
  const fracPadded = fracPart.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(wholePart || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Fetch the best available swap quote from AVNU.
 * Returns the top quote (index 0) or null if none found.
 */
export async function fetchSwapQuotes(params: {
  sellTokenAddress: string;
  buyTokenAddress: string;
  sellAmount: bigint;
  takerAddress?: string;
}): Promise<SwapQuote[]> {
  const url = new URL(`${AVNU_API}/swap/v2/quotes`);
  url.searchParams.set("sellTokenAddress", params.sellTokenAddress);
  url.searchParams.set("buyTokenAddress", params.buyTokenAddress);
  url.searchParams.set("sellAmount", `0x${params.sellAmount.toString(16)}`);
  url.searchParams.set("size", "1");
  url.searchParams.set("integratorName", "Medialane");
  if (params.takerAddress) url.searchParams.set("takerAddress", params.takerAddress);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AVNU quotes failed: ${text}`);
  }
  return res.json();
}

/**
 * Build the swap contract call from a confirmed quote.
 * Returns the call to pass directly to account.execute() along with an approve call.
 */
export async function buildSwapCall(params: {
  quoteId: string;
  takerAddress: string;
  slippage?: number;
}): Promise<BuildSwapCall> {
  const res = await fetch(`${AVNU_API}/swap/v2/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId: params.quoteId,
      takerAddress: params.takerAddress,
      slippage: params.slippage ?? 0.005, // 0.5% default
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AVNU build failed: ${text}`);
  }
  return res.json();
}

/**
 * Build the ERC20 approve call required before executing the swap.
 * The AVNU router contract address comes from the build response.
 */
export function buildApproveCall(
  sellTokenAddress: string,
  spenderAddress: string,
  sellAmount: bigint
): { contractAddress: string; entrypoint: string; calldata: string[] } {
  const low = sellAmount & ((1n << 128n) - 1n);
  const high = sellAmount >> 128n;
  return {
    contractAddress: sellTokenAddress,
    entrypoint: "approve",
    calldata: [spenderAddress, `0x${low.toString(16)}`, `0x${high.toString(16)}`],
  };
}
