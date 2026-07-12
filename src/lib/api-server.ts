/**
 * Server-side fetch helpers for generateMetadata.
 * Server-only — uses `MEDIALANE_API_KEY` (no NEXT_PUBLIC_ prefix) so the
 * key never ends up in the browser bundle. Returns null on any error so
 * metadata falls back gracefully.
 */

import type { ApiCollection, ApiOrder } from "@medialane/sdk";

const BASE = process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL ?? "";
const KEY  = process.env.MEDIALANE_API_KEY ?? "";

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    // Hard 5s cap — these run inside page prerender/ISR regeneration, where a
    // hanging backend would otherwise stall the build (Next kills a page
    // render at 60s and fails the whole build after 3 attempts).
    const res = await fetch(`${BASE}${path}`, {
      headers: { "x-api-key": KEY },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as T;
  } catch {
    return null;
  }
}

export function ipfsToHttpServer(uri: string | null | undefined): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`;
  return uri;
}

export async function fetchTokenMeta(contract: string, tokenId: string) {
  return apiFetch<{ name?: string; description?: string; image?: string; metadata?: { name?: string; description?: string; image?: string } }>(
    `/v1/tokens/${contract}/${tokenId}`
  );
}

export async function fetchCollectionMeta(contract: string) {
  return apiFetch<{ name?: string; description?: string; image?: string; totalSupply?: number; service?: string }>(
    `/v1/collections/${contract}`
  );
}

/** Featured collections for the homepage hero — same query `useCollections(1, limit, true, "recent")` issues client-side, so it can seed that hook's SWR fallback. */
export async function fetchFeaturedCollections(limit: number) {
  return apiFetch<ApiCollection[]>(
    `/v1/collections?page=1&limit=${limit}&sort=recent&isFeatured=true&hideEmpty=true`
  );
}

/** First page of active orders — mirrors the default-filter query `ListingsGrid` issues via `useOrders`, so it can seed the grid's initial render. */
export async function fetchActiveOrders(limit: number) {
  return apiFetch<ApiOrder[]>(`/v1/orders?status=ACTIVE&sort=recent&page=1&limit=${limit}`);
}

export async function fetchDropMeta(contract: string) {
  return apiFetch<{ name?: string | null; description?: string | null; image?: string | null }>(
    `/v1/drop/${contract}/info`
  );
}
