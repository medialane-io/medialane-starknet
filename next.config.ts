import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @medialane/ui's single barrel entry point pulls all ~65 components (and
  // their heaviest deps — framer-motion, Radix primitives, the full
  // lucide-react set) into any route importing even one small component.
  // Next's compiler rewrites barrel imports to per-file deep imports at
  // build time when the package is listed here. See medialane-io's
  // next.config.ts for the io measurement this was validated against.
  experimental: {
    optimizePackageImports: ["@medialane/ui"],
  },
  // @cartridge/controller (Cartridge Controller wallet) ships its signing/
  // session engine as a WASM module (@cartridge/controller-wasm), imported
  // directly rather than lazy-loaded — webpack 5 doesn't parse `.wasm`
  // imports without this experiment enabled.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
  // The wallet connector list is client-only, but Next still traces its
  // import chain into the server/RSC compilation while prerendering pages —
  // and the server compiler doesn't emit the `.wasm` asset at the path the
  // wasm-loader glue expects, failing prerender with ENOENT. Keep these
  // packages external to the server bundle (required via Node at runtime
  // instead) so only the client bundle ever needs the wasm experiment.
  serverExternalPackages: ["@cartridge/connector", "@cartridge/controller", "@cartridge/controller-wasm"],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
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
  // Baseline security headers, site-wide. Deliberately NOT a full Content-Security-
  // Policy: the wallet-connector stack (Cartridge's hosted iframe keychain,
  // WalletConnect's relay for Argent/Braavos/Keplr mobile handshakes) legitimately
  // calls out to a wide, version-fragile set of external origins
  // (x.cartridge.gg/api.cartridge.gg/static.cartridge.gg, cloud.walletconnect.com,
  // login.argent.xyz, link.braavos.app, deeplink.keplr.app, …). Getting that
  // allowlist wrong silently breaks wallet connect for real users — worse than no
  // CSP — and it can't be verified without clicking through each live connector,
  // which needs a real browser + real wallets/mobile apps. These four headers are
  // safe with zero connector surface: none of them touch script/connect/frame
  // origins.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
