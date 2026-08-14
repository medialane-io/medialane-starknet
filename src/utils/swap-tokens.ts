

import { getTokenBySymbol } from "@medialane/sdk";

export interface SwapToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  color: string;
}

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

export function formatTokenAmount(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  if (fraction === 0n) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "");
  return `${whole}.${fractionStr}`;
}

export function parseTokenAmount(value: string, decimals: number): bigint {
  if (!value || isNaN(parseFloat(value))) return 0n;
  const [wholePart, fracPart = ""] = value.split(".");
  const fracPadded = fracPart.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(wholePart || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}
