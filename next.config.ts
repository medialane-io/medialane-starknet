import type { NextConfig } from "next";

// Privy bundles static imports for optional Farcaster/Solana features we don't use.
// Stub the entire dependency tree so webpack doesn't chase transitive Solana packages.
const PRIVY_UNUSED_OPTIONAL_MODULES = [
  "@farcaster/mini-app-solana",
  "@farcaster/miniapp-sdk",
  "@solana/wallet-adapter-react",
  "@solana/kit",
  "@solana-program/memo",
  "@solana-program/system",
  "@solana-program/token",
  "@abstract-foundation/agw-client",
  "permissionless",
];

const nextConfig: NextConfig = {
  webpack(config) {
    for (const mod of PRIVY_UNUSED_OPTIONAL_MODULES) {
      config.resolve.alias[mod] = false;
    }
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
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
      // ── Docs ──────────────────────────────────────────────────────────────
      {
        source: "/docs",
        destination: "https://www.medialane.io/docs",
        permanent: true,
      },
      {
        source: "/docs/:path*",
        destination: "https://www.medialane.io/docs/:path*",
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
      {
        source: "/learn",
        destination: "https://www.medialane.io/learn",
        permanent: true,
      },
      {
        source: "/learn/:path*",
        destination: "https://www.medialane.io/learn/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
