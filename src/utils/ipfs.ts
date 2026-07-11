// utils/ipfs.ts

export interface IPFSMetadata {
  name?: string;
  description?: string;
  image?: string;
  // OpenSea collection metadata standard fields
  image_url?: string;
  cover_image?: string;
  coverImage?: string;
  banner_image_url?: string;
  featured_image?: string;
  external_link?: string;
  seller_fee_basis_points?: number;
  fee_recipient?: string;
  // Token metadata fields
  type?: string;
  creator?: string | { name: string; address: string };
  attributes?: Array<{ trait_type: string; value: string }>;
  properties?: Record<string, unknown>;
  registrationDate?: string;
  medium?: string;
  fileType?: string;
  duration?: number;
  genre?: string;
  bpm?: number;
  resolution?: string;
  framerate?: number;
  yearCreated?: number;
  artistName?: string;
  version?: string;
  external_url?: string;
  repository?: string;
  patent_number?: string;
  patent_date?: string;
  trademark_number?: string;
  tokenId?: string;
  tokenStandard?: string;
  blockchain?: string;
  pages?: number;
  authors?: string[];
  publisher?: string;
  // Token image alternatives
  image_data?: string;
  animation_url?: string;
  assetUrl?: string;
  asset_url?: string;
  thumbnail_uri?: string;
  [key: string]: unknown;
}

const CACHE_EXPIRY = 24 * 60 * 60 * 1000;
const CACHE_PREFIX = 'ipfs-metadata-';

export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://dweb.link/ipfs/'
];

// SSR-safe localStorage helpers
function localGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function localSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* quota exceeded — non-fatal */ }
}

function localRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* non-fatal */ }
}

/**
 * Retrieve metadata from IPFS using public gateways with 24h localStorage cache.
 * Returns null when called server-side (no localStorage) or when all gateways fail.
 */
export async function fetchIPFSMetadata(cid: string, bypassCache = false): Promise<IPFSMetadata | null> {
  if (!cid) return null;

  // Skip entirely during SSR — no localStorage, no network benefit
  if (typeof window === 'undefined') return null;

  if (!bypassCache) {
    const cachedData = localGet(`${CACHE_PREFIX}${cid}`);
    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_EXPIRY) return data as IPFSMetadata;
        // Stale — fall through to re-fetch
      } catch {
        localRemove(`${CACHE_PREFIX}${cid}`);
      }
    }
  }

  const tryGateway = async (gateway: string): Promise<IPFSMetadata> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${gateway}${cid}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as IPFSMetadata;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // Race the two primary gateways (Pinata + ipfs.io) so one slow/down
  // gateway no longer costs a serial 5s timeout; fall back to the rest
  // serially only if both lose.
  let metadata: IPFSMetadata | null = null;
  try {
    metadata = await Promise.any(IPFS_GATEWAYS.slice(0, 2).map(tryGateway));
  } catch {
    for (const gateway of IPFS_GATEWAYS.slice(2)) {
      try {
        metadata = await tryGateway(gateway);
        break;
      } catch {
        // Try next gateway silently
      }
    }
  }

  if (metadata) {
    localSet(`${CACHE_PREFIX}${cid}`, JSON.stringify({ data: metadata, timestamp: Date.now() }));
    return metadata;
  }

  // Only log in development — all gateways exhausted
  if (process.env.NODE_ENV === 'development') {
    console.warn(`[IPFS] All gateways failed for CID: ${cid}`);
  }
  return null;
}


/**
 * Clear IPFS metadata cache (single CID or all).
 */
export function clearIPFSCache(cid?: string): void {
  if (typeof window === 'undefined') return;
  if (cid) {
    localRemove(`${CACHE_PREFIX}${cid}`);
  } else {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
      }
      keys.forEach(k => localRemove(k));
    } catch { /* non-fatal */ }
  }
}


/**
 * Process IPFS hash to URL.
 * Converts various IPFS input formats to proper gateway URLs.
 */
export function processIPFSHashToUrl(input: string, fallbackUrl: string): string {
  if (typeof input !== "string") return fallbackUrl;

  let processedUrl = input.replace(/\0/g, "").trim();

  // Handle undefined prefix
  if (processedUrl.startsWith("undefined/")) {
    const cid = processedUrl.replace("undefined/", "");
    if (cid.match(/^[a-zA-Z0-9]+$/) && cid.length >= 34) {
      return `${IPFS_GATEWAYS[0]}${cid}`;
    }
    return fallbackUrl;
  }

  // Reject inputs too short to be valid CIDs (silent — callers handle the fallback)
  if (
    processedUrl.length < 34 &&
    !processedUrl.startsWith("http") &&
    !processedUrl.startsWith("/")
  ) {
    return fallbackUrl;
  }

  // Raw CID
  if (processedUrl.match(/^[a-zA-Z0-9]+$/) && processedUrl.length >= 34) {
    return `${IPFS_GATEWAYS[0]}${processedUrl}`;
  }

  // Existing gateway URLs
  if (IPFS_GATEWAYS.some((gateway) => processedUrl.startsWith(gateway))) {
    return processedUrl;
  }

  // ipfs:/CID, ipfs://CID, ipfs:ipfs/CID
  if (processedUrl.startsWith("ipfs:")) {
    const cid = processedUrl.replace(/^ipfs:(?:ipfs)?\/+/, "");
    return `${IPFS_GATEWAYS[0]}${cid}`;
  }

  // Handle www. prefix
  if (processedUrl.startsWith("www.")) {
    return `https://${processedUrl}`;
  }

  // Already a normal http(s) URL
  if (processedUrl.startsWith("http")) {
    const cidMatch = processedUrl.match(/\/ipfs\/([a-zA-Z0-9]+)/);
    if (cidMatch && cidMatch[1].length < 34) {
      return fallbackUrl;
    }
    return processedUrl;
  }

  return fallbackUrl || "";
}

/**
 * Given an IPFS gateway URL that failed to load, return the same CID served
 * from the next gateway in the fallback list. Returns null if exhausted.
 */
export function nextIpfsGatewayUrl(url: string): string | null {
  if (!url) return null;
  const currentIdx = IPFS_GATEWAYS.findIndex((g) => url.startsWith(g));
  if (currentIdx === -1) return null;
  const nextGateway = IPFS_GATEWAYS[currentIdx + 1];
  if (!nextGateway) return null;
  const cid = url.slice(IPFS_GATEWAYS[currentIdx].length);
  return nextGateway + cid;
}
