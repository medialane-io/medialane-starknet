import type { NextConfig } from "next";

// StarkZap v3 barrel-exports every provider (swap, bridge, confidential, solana
// connect, …); each pulls an OPTIONAL peer dep (declared optional in starkzap's
// peerDependenciesMeta). We only use wallet / erc20 / tx / staking / swap, so
// stub the providers we don't touch.
// (@avnu/avnu-sdk + starknet are hard deps and stay; Ekubo routing is on-chain.)
const STARKZAP_UNUSED_OPTIONAL_MODULES = [
  "@fatsolutions/tongo-sdk",       // confidential transfers (Tongo)
  "@solana/web3.js",               // Solana cross-chain connect
  "@hyperlane-xyz/registry",       // Hyperlane bridge
  "@hyperlane-xyz/sdk",
  "@hyperlane-xyz/utils",
  "react-native-get-random-values", // RN-only shim
  "fast-text-encoding",             // RN-only shim
];

const nextConfig: NextConfig = {
  webpack(config) {
    for (const mod of STARKZAP_UNUSED_OPTIONAL_MODULES) {
      config.resolve.alias[mod] = false;
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*",
      },
    ],
  },
  async redirects() {
    return [
      // ── Chain-in-URL migration (2026-07-20) ───────────────────────────────
      // Asset/collection/coin routes are now chain-scoped (/asset/[chain]/…).
      // 301 the legacy non-chained paths to the STARKNET form. The (0x…) regex
      // on the contract/address segment keeps these from swallowing the new
      // chained routes (whose first segment is a chain slug, not 0x-hex) or any
      // non-address sibling path.
      { source: "/asset/:contract(0x[0-9a-fA-F]+)/:tokenId", destination: "/asset/starknet/:contract/:tokenId", permanent: true },
      { source: "/collections/:contract(0x[0-9a-fA-F]+)",    destination: "/collections/starknet/:contract",    permanent: true },
      { source: "/coins/:address(0x[0-9a-fA-F]+)",           destination: "/coins/starknet/:address",            permanent: true },
      // ── Docs ──────────────────────────────────────────────────────────────
      // Knowledge hub lives on docs.medialane.io since the 2026-05 docs
      // migration; redirect any stale /docs paths there. Direct in-app
      // links should target docs.medialane.io as plain <a> so Next does
      // not attempt an RSC prefetch (which would CORS-reject the
      // cross-origin fetch).
      {
        source: "/docs",
        destination: "https://docs.medialane.io/docs",
        permanent: true,
      },
      {
        source: "/docs/:path*",
        destination: "https://docs.medialane.io/docs/:path*",
        permanent: true,
      },
      // ── ip1155 → nfteditions ──────────────────────────────────────────────
      {
        source: "/launchpad/ip1155",
        destination: "/launchpad/nfteditions",
        permanent: true,
      },
      {
        source: "/launchpad/ip1155/:path*",
        destination: "/launchpad/nfteditions/:path*",
        permanent: true,
      },
      // ── Learn ─────────────────────────────────────────────────────────────
      // Same as /docs above — learn content moved to docs.medialane.io.
      {
        source: "/learn",
        destination: "https://docs.medialane.io/learn",
        permanent: true,
      },
      {
        source: "/learn/:path*",
        destination: "https://docs.medialane.io/learn/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
