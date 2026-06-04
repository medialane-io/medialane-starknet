/**
 * AVNU Exchange swap utilities for Medialane.
 *
 * Uses the AVNU REST API directly (no extra SDK dependency) so execution
 * can be routed through the existing unified wallet / paymaster pipeline.
 *
 * Flow:
 *   fetchSwapQuotes()  →  buildSwapCall()  →  execute([approveCall, swapCall])
 */

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

export const SWAP_TOKENS: SwapToken[] = [
  {
    symbol: "ETH",
    name: "Ether",
    address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    decimals: 18,
    color: "#627EEA",
  },
  {
    symbol: "STRK",
    name: "Starknet Token",
    address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    decimals: 18,
    color: "#FF875B",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
    decimals: 6,
    color: "#2775CA",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8",
    decimals: 6,
    color: "#26A17B",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
    decimals: 8,
    color: "#F7931A",
  },
];

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
