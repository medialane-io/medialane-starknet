import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";
import { SUPPORTED_TOKENS } from "./constants";
import { FEATURED_COLLECTIONS } from "./featured-collections";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address || "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function normalizeAddress(address: string): string {
  if (!address) return address;
  const hex = address.startsWith("0x") ? address.slice(2) : address;
  return "0x" + hex.padStart(64, "0").toLowerCase();
}

export function getCurrency(tokenAddress: string) {
  if (!tokenAddress) return { symbol: "TOKEN", decimals: 18 };
  const norm = normalizeAddress(tokenAddress).toLowerCase();
  for (const token of SUPPORTED_TOKENS) {
    if (normalizeAddress(token.address).toLowerCase() === norm) {
      return { symbol: token.symbol, decimals: token.decimals };
    }
  }
  return { symbol: "TOKEN", decimals: 18 };
}

function adaptiveDecimals(num: number): number {
  if (num === 0 || num >= 1) return 2;
  if (num >= 0.01) return 4;
  // Show enough decimals to reveal 2 significant figures (e.g. 0.000014 → 6)
  const leadingZeros = Math.floor(-Math.log10(Math.abs(num)));
  return leadingZeros + 2;
}

export function formatPrice(amount: string, decimals: number): string {
  if (!amount) return "0";
  try {
    const val = BigInt(amount);
    const num = Number(val) / Math.pow(10, decimals);
    return num.toLocaleString(undefined, {
      maximumFractionDigits: adaptiveDecimals(num),
    });
  } catch {
    return "0";
  }
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

/**
 * @param width Optional display width (px) for thumbnail/avatar slots — requests an
 * on-the-fly resized rendition from the IPFS proxy instead of the full original file.
 * Omit for full-size (hero images, lightbox, etc).
 */
export function ipfsToHttp(uri: string | null | undefined, width?: number): string {
  if (!uri) return "/placeholder.svg";
  if (uri.startsWith("ipfs://")) {
    // Route through our server-side proxy (/api/ipfs/[...cid]) to avoid:
    //  - Pinata's CORP header blocking cross-origin image loads on free plans
    //  - Client-visible 429 rate-limit errors from the public gateway
    const cid = uri.slice(7); // strips "ipfs://"
    return width ? `/api/ipfs/${cid}?w=${width}` : `/api/ipfs/${cid}`;
  }
  return uri;
}

/**
 * Resolve a token/collection image value for display in marketplace dialogs and
 * cards. Returns a browser-loadable URL, or `null` when there's no image (so the
 * UI can show its own fallback rather than the /placeholder.svg sentinel).
 * Idempotent: already-resolved URLs (http, /api/ipfs, …) pass through unchanged,
 * so callers may pass a raw `ipfs://` value or an already-resolved one.
 */
export function resolveTokenImage(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Already a resolved/proxied URL (our own /api/* routes or the placeholder
  // sentinel) — pass through so callers may hand us raw or resolved values.
  if (raw.startsWith("/")) return raw;
  return ipfsToHttp(raw);
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

/**
 * Executes an array of async factory functions in series with a rate-limit
 * delay between each call. Returns all settled results (errors are logged and
 * skipped so one failing fetch doesn't abort the rest).
 */
export async function fetchWithRateLimit<T>(
  factories: Array<() => Promise<T>>,
  delayMs = 500
): Promise<T[]> {
  const results: T[] = [];
  for (const factory of factories) {
    try {
      results.push(await factory());
    } catch (err) {
      console.warn("[fetchWithRateLimit] fetch failed, skipping:", err);
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}

/** Converts a bigint or numeric string to a 0x-prefixed hex string. */
export function toHexString(value: bigint | string | number): string {
  return "0x" + BigInt(value).toString(16);
}

/** Returns true if the given collection address/id is in the featured list. */
export function isCollectionFeatured(addressOrId: string): boolean {
  if (!addressOrId) return false;
  const norm = normalizeAddress(addressOrId).toLowerCase();
  return FEATURED_COLLECTIONS.some(
    (c) => normalizeAddress(c.contractAddress).toLowerCase() === norm
  );
}

export function timeUntil(dateStr: string | number): string {
  // Accept Unix seconds as number, numeric string (BigInt serialized), or ISO date string.
  const raw = typeof dateStr === "string" && /^\d+$/.test(dateStr.trim())
    ? Number(dateStr)
    : dateStr;
  const ms = typeof raw === "number" ? raw * 1000 : new Date(raw).getTime();
  const diff = ms - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

/**
 * Check if a wallet address owns (or co-owns) a token.
 * Checks `balances` first (ERC-721 and ERC-1155 via TokenBalance).
 * Falls back to the legacy `owner` field for backward compatibility.
 */
export function checkIsOwner(
  token: { owner?: string | null; balances?: Array<{ owner: string; amount: string }> | null } | null | undefined,
  walletAddress: string | null | undefined
): boolean {
  if (!token || !walletAddress) return false;
  if (token.balances != null && token.balances.length > 0) {
    return token.balances.some(
      (b) => b.owner.toLowerCase() === walletAddress.toLowerCase() && BigInt(b.amount) > 0n
    );
  }
  if (!token.owner) return false;
  return token.owner.toLowerCase() === walletAddress.toLowerCase();
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
