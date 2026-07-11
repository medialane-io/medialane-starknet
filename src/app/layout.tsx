import type { Metadata } from "next";
import { Inter, Urbanist } from "next/font/google";
import Script from "next/script";
import { Providers } from "./providers";
import { JsonLd } from "@/components/seo/json-ld";
import { APP_URL, defaultRobots } from "@/lib/seo";
import "@medialane/ui/styles";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });
// Brand display face — headings pick it up via --font-display (@medialane/ui styles).
const urbanist = Urbanist({ subsets: ["latin"], display: "swap", variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Medialane — Creator Launchpad & IP Marketplace",
    template: "%s | Medialane",
  },
  description: "Launch, collect, and monetize NFT digital assets with Starknet wallets.",
  keywords: ["NFT", "IP", "Launchpad", "Starknet", "Creator", "Marketplace"],
  authors: [{ name: "Medialane" }],
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  robots: defaultRobots,
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Medialane",
    description: "Creator launchpad & IP marketplace on Starknet",
    siteName: "Medialane",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Medialane" }],
  },
  twitter: {
    card: "summary_large_image",
    creator: "@medialane_io",
    images: ["/og-image.jpg"],
  },
};

const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Medialane",
    url: APP_URL,
    logo: `${APP_URL}/medialane.png`,
    sameAs: ["https://x.com/medialane_io", "https://docs.medialane.io"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Medialane",
    url: APP_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${APP_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  },
];

export const viewport = {
  themeColor: "black",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const BACKEND_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_MEDIALANE_BACKEND_URL ?? "").origin;
  } catch {
    return null;
  }
})();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Every asset/collection/coin image resolves through the Pinata gateway
            (src/utils/ipfs.ts IPFS_GATEWAYS[0]) — preconnect shaves the TLS/DNS
            handshake off the LCP image on nearly every page. */}
        <link rel="preconnect" href="https://gateway.pinata.cloud" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://gateway.pinata.cloud" />
        {BACKEND_ORIGIN && (
          <>
            <link rel="preconnect" href={BACKEND_ORIGIN} />
            <link rel="dns-prefetch" href={BACKEND_ORIGIN} />
          </>
        )}
      </head>
      <body className={`${inter.className} ${urbanist.variable}`}>
        {/* Google tag (gtag.js) — Google Ads conversion tracking */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-18112836088"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18112836088');
          `}
        </Script>
        <JsonLd data={siteJsonLd} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
