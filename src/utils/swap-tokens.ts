/**
 * Swap token presets + amount formatting helpers.
 *
 * Quote tokens a user can pay with on the coin swap. Routing/execution is
 * handled by StarkZap's Ekubo provider (see `use-swap.ts`) — there is no AVNU
 * aggregator and no REST layer here anymore; this file is pure token metadata.
 */

import { getTokenBySymbol } from "@medialane/sdk";

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
