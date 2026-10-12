import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";
import { normalizeAddress } from "@medialane/sdk";
import { toDisplayUrl, toDisplayUrlOrNull, PINATA_PUBLIC_GATEWAY } from "@medialane/ui";
import { IPFS_GATEWAY } from "./constants";
import type { UsdPrices } from "@/hooks/use-usd-prices";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address || "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

function adaptiveDecimals(num: number): number {
  if (num === 0 || num >= 1) return 2;
  if (num >= 0.01) return 4;

  const leadingZeros = Math.floor(-Math.log10(Math.abs(num)));
  return leadingZeros + 2;
}

export function formatDisplayPrice(price: string | number | null | undefined): string {
  if (price === null || price === undefined) return "";

  const priceStr = String(price);
  const parts = priceStr.split(" ");
  const numericPart = parts[0];
  const currencyPart = parts.length > 1 ? parts.slice(1).join(" ") : "";

  const num = Number(numericPart);
  if (isNaN(num)) return priceStr;

  const maxDecimals = adaptiveDecimals(num);
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: Math.min(2, maxDecimals),
    maximumFractionDigits: maxDecimals,
  });

  return currencyPart ? `${formatted} ${currencyPart}` : formatted;
}

const fmtUsd = (n: number): string =>
  n > 0 && n < 0.01 ? "<$0.01" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function usdValueFor(
  amountFormatted: string | null | undefined,
  currency: string | null | undefined,
  usdPrices: UsdPrices | null
): string | null {
  if (!amountFormatted || !currency || !usdPrices) return null;
  const rate = usdPrices[currency.toUpperCase() as keyof UsdPrices];
  if (rate == null) return null;
  const amount = parseFloat(amountFormatted);
  if (isNaN(amount)) return null;
  return fmtUsd(amount * rate);
}

const displayOptions = { gateway: IPFS_GATEWAY ?? PINATA_PUBLIC_GATEWAY };

export function ipfsToHttp(uri: string | null | undefined): string {
  return toDisplayUrl(uri, displayOptions);
}

export function resolveTokenImage(raw: string | null | undefined): string | null {
  return toDisplayUrlOrNull(raw, displayOptions);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function checkIsOwner(
  token: { owner?: string | null; balances?: Array<{ owner: string; amount: string }> | null } | null | undefined,
  walletAddress: string | null | undefined
): boolean {
  if (!token || !walletAddress) return false;
  const normalizedWallet = normalizeAddress("STARKNET", walletAddress);
  if (token.balances != null && token.balances.length > 0) {
    return token.balances.some(
      (b) => normalizeAddress("STARKNET", b.owner) === normalizedWallet && BigInt(b.amount) > 0n
    );
  }
  if (!token.owner) return false;
  return normalizeAddress("STARKNET", token.owner) === normalizedWallet;
}

export function isCollectionOwner(
  collection: { owner?: string | null } | null | undefined,
  walletAddress: string | null | undefined
): boolean {
  if (!collection?.owner || !walletAddress) return false;
  return (
    normalizeAddress("STARKNET", collection.owner) ===
    normalizeAddress("STARKNET", walletAddress)
  );
}

export function formatOrderExpiry(endTime: string | bigint): {
  label: string;
  urgent: boolean;
  expired: boolean;
} {
  const expiry = new Date(Number(endTime) * 1000);
  const now = new Date();
  if (expiry < now) return { label: "Expired", urgent: false, expired: true };
  const urgent = expiry.getTime() - now.getTime() < 86400000;
  return { label: formatDistanceToNow(expiry, { addSuffix: true }), urgent, expired: false };
}
