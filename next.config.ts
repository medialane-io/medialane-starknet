import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@medialane/ui"],
  },
  serverExternalPackages: ["@cartridge/connector", "@cartridge/controller"],
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: "/creators", destination: "/accounts", permanent: true },
      { source: "/asset/:contract(0x[0-9a-fA-F]+)/:tokenId", destination: "/asset/starknet/:contract/:tokenId", permanent: true },
      { source: "/collections/:contract(0x[0-9a-fA-F]+)",    destination: "/collections/starknet/:contract",    permanent: true },
      { source: "/coins/:address(0x[0-9a-fA-F]+)",           destination: "/coins/starknet/:address",            permanent: true },
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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Security-Policy",
            value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
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
