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
  // Privy's optional Stripe fiat→crypto on-ramp — not used by the dapp and not
  // declared as a Privy dependency, so webpack can't resolve the import. Stub it.
  "@stripe/crypto",
  // Privy's EVM external-wallet connectors. The dapp is Starknet-only and uses
  // Privy ONLY for email/social → Starknet (embedded wallet), never Privy's
  // "connect MetaMask/Coinbase/WalletConnect" path — so these never load at
  // runtime. Excluding them from the bundle (NOT viem, which Privy core uses).
  "@coinbase/wallet-sdk",
  "@walletconnect/ethereum-provider",
  "@walletconnect/universal-provider",
  "@base-org/account",
  "mipd",
];

// StarkZap v3 barrel-exports every provider (swap, bridge, confidential, solana
// connect, …); each pulls an OPTIONAL peer dep (declared optional in starkzap's
// peerDependenciesMeta). We only use wallet / erc20 / tx / staking / swap, so
// stub the providers we don't touch — same approach as the Privy stubs above.
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
    for (const mod of [...PRIVY_UNUSED_OPTIONAL_MODULES, ...STARKZAP_UNUSED_OPTIONAL_MODULES]) {
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
      // ── Chain-in-URL (2026-07-20): 301 legacy asset/collection/coin paths
      // to the chained `starknet` form, matching medialane-io. The (0x…)
      // param regex keeps these from swallowing the new chained routes.
      {
        source: "/asset/:contract(0x[0-9a-fA-F]+)/:tokenId",
        destination: "/asset/starknet/:contract/:tokenId",
        permanent: true,
      },
      {
        source: "/collections/:contract(0x[0-9a-fA-F]+)",
        destination: "/collections/starknet/:contract",
        permanent: true,
      },
      {
        source: "/coins/:address(0x[0-9a-fA-F]+)",
        destination: "/coins/starknet/:address",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
