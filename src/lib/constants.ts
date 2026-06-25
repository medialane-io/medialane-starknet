// Protocol contract addresses — the SDK's chain-named constants (single source).
// No NEXT_PUBLIC_ overrides, no *_MAINNET, no duplicate comments name.
export {
  SUPPORTED_TOKENS,
  STARKNET_MARKETPLACE_721_CONTRACT,
  STARKNET_MARKETPLACE_1155_CONTRACT,
  STARKNET_COLLECTION_721_CONTRACT,
  STARKNET_COLLECTION_1155_CONTRACT,
  STARKNET_NFTCOMMENTS_CONTRACT,
} from "@medialane/sdk";

// ── Starknet RPC — provider-agnostic, two roles, server-only ────────────────
// MAIN: the keyed provider (Alchemy today, any provider tomorrow). SERVER-ONLY —
//   never a NEXT_PUBLIC_ var, or the key is inlined into the browser bundle (the
//   2026-06-23 key leak). The browser never uses it directly.
// FALLBACK: the keyless public node (lava). Hardcoded default so a missing env
//   can never break the build; override with STARKNET_RPC_FALLBACK_URL.
// PROXY: the same-origin path the browser uses — the /api/rpc route forwards to
//   MAIN → FALLBACK server-side, so the keyed URL stays off the bundle.
export const RPC_MAIN_URL = process.env.STARKNET_RPC_URL ?? "";
export const RPC_FALLBACK_URL =
  process.env.STARKNET_RPC_FALLBACK_URL || "https://rpc.starknet.lava.build";
export const RPC_PROXY_PATH = "/api/rpc";

/**
 * `MEDIALANE_BACKEND_URL` + `MEDIALANE_API_KEY` are **environment-aware**:
 *
 * - **Server-side** (RSC, BFF routes, sitemap): real backend URL + real key.
 * - **Browser**: `/api/proxy` + empty string. The same-origin proxy
 *   (`src/app/api/proxy/v1/[...path]/route.ts`) injects the real key
 *   server-side. The browser bundle never sees the key.
 *
 * Replaces the legacy `NEXT_PUBLIC_MEDIALANE_API_KEY` pattern that shipped
 * the key in the JS bundle. Existing call sites that do
 * `${MEDIALANE_BACKEND_URL}/v1/...` with `x-api-key: MEDIALANE_API_KEY`
 * work unchanged — the empty header is stripped and replaced by the proxy.
 */
const isServer = typeof window === "undefined";

// On the client, target the same-origin BFF proxy. We use an absolute URL
// (origin + path) rather than a bare path because `MedialaneClient`'s Zod
// schema validates `backendUrl` with `z.string().url()` — `/api/proxy`
// alone is rejected as not a URL. fetch() against the absolute same-origin
// URL works identically to a relative one in the browser.
export const MEDIALANE_BACKEND_URL = isServer
  ? (process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL || "http://localhost:3001")
  : `${window.location.origin}/api/proxy`;

export const MEDIALANE_API_KEY = isServer
  ? (process.env.MEDIALANE_API_KEY || "")
  : "";

export const PINATA_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ||
  "https://gateway.pinata.cloud";

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://voyager.online";

export const MINT_CONTRACT =
  (process.env.NEXT_PUBLIC_MINT_CONTRACT as `0x${string}`) || ("" as `0x${string}`);

export const LAUNCH_MINT_CONTRACT =
  (process.env.NEXT_PUBLIC_LAUNCH_MINT_CONTRACT as `0x${string}`) || ("" as `0x${string}`);

export const GENESIS_NFT_URI =
  process.env.NEXT_PUBLIC_GENESIS_NFT_URI || "";

export const GENESIS_NFT_IMAGE_URL =
  process.env.NEXT_PUBLIC_GENESIS_NFT_IMAGE_URL || "";

export const BR_MINT_CONTRACT =
  (process.env.NEXT_PUBLIC_BR_MINT_CONTRACT as `0x${string}`) || ("" as `0x${string}`);

export const BR_NFT_URI =
  process.env.NEXT_PUBLIC_BR_NFT_URI || "";

export const INDEXER_REVALIDATION_DELAY_MS = 10_000;

export const REGISTRY_START_BLOCK = Number(
  process.env.NEXT_PUBLIC_COLLECTION_721_START_BLOCK || 0
);

export const ALLOWED_IP_TYPES = [
  "Audio", "Art", "Documents", "NFT", "Video",
  "Photography", "Patents", "Posts", "Publications", "RWA",
] as const;

export const AVNU_PAYMASTER_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_AVNU_PAYMASTER_API_KEY,
};

export const DURATION_OPTIONS = [
  { label: "1 Day", seconds: 86400 },
  { label: "7 Days", seconds: 604800 },
  { label: "30 Days", seconds: 2592000 },
  { label: "6 Months", seconds: 15552000 },
  { label: "1 Year", seconds: 31536000 },
  { label: "2 Years", seconds: 63072000 },
] as const;
