import {
  MARKETPLACE_721_CONTRACT_MAINNET,
  MARKETPLACE_1155_CONTRACT_MAINNET,
  COLLECTION_721_CONTRACT_MAINNET,
  COLLECTION_1155_CONTRACT_MAINNET,
  NFTCOMMENTS_CONTRACT_MAINNET,
  SUPPORTED_TOKENS,
} from "@medialane/sdk";

export { SUPPORTED_TOKENS };

export const MARKETPLACE_721_CONTRACT = MARKETPLACE_721_CONTRACT_MAINNET;

export const MARKETPLACE_1155_CONTRACT = MARKETPLACE_1155_CONTRACT_MAINNET;

export const COLLECTION_721_CONTRACT =
  (process.env.NEXT_PUBLIC_COLLECTION_721_CONTRACT as `0x${string}`) ||
  COLLECTION_721_CONTRACT_MAINNET;

export const COLLECTION_1155_CONTRACT =
  (process.env.NEXT_PUBLIC_COLLECTION_1155_CONTRACT as `0x${string}`) ||
  COLLECTION_1155_CONTRACT_MAINNET;

export const NFTCOMMENTS_CONTRACT =
  (process.env.NEXT_PUBLIC_NFTCOMMENTS_CONTRACT as `0x${string}`) ||
  NFTCOMMENTS_CONTRACT_MAINNET;

export const COMMENTS_CONTRACT =
  (process.env.NEXT_PUBLIC_COMMENTS_CONTRACT as `0x${string}`) ||
  NFTCOMMENTS_CONTRACT;

export const STARKNET_RPC_URL =
  process.env.NEXT_PUBLIC_STARKNET_RPC_URL ||
  process.env.NEXT_PUBLIC_RPC_URL || "";

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

export const MEDIALANE_BACKEND_URL = isServer
  ? (process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL || "http://localhost:3001")
  : "/api/proxy";

export const MEDIALANE_API_KEY = isServer
  ? (process.env.MEDIALANE_API_KEY || "")
  : "";

export const PINATA_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY ||
  process.env.NEXT_PUBLIC_GATEWAY_URL ||
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
