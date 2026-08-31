

import type { ApiCollection, ApiOrder } from "@medialane/sdk";
import { ipfsToHttp as sharedIpfsToHttp } from "@medialane/ui/utils/ipfs";

const BASE = process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL ?? "";
const KEY  = process.env.MEDIALANE_API_KEY ?? "";

async function apiFetch<T>(path: string): Promise<T | null> {
  try {

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
  return sharedIpfsToHttp(uri) || "";
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

export async function fetchFeaturedCollections(limit: number) {
  return apiFetch<ApiCollection[]>(
    `/v1/collections?page=1&limit=${limit}&sort=recent&isFeatured=true&hideEmpty=true`
  );
}

export async function fetchActiveOrders(limit: number) {
  return apiFetch<ApiOrder[]>(`/v1/orders?status=ACTIVE&sort=recent&page=1&limit=${limit}`);
}

export async function fetchDropMeta(contract: string) {
  return apiFetch<{ name?: string | null; description?: string | null; image?: string | null }>(
    `/v1/drop/${contract}/info`
  );
}
