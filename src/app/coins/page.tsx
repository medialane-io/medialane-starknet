import type { Metadata } from "next";
import { PageContainer } from "@medialane/ui";
import { CoinsExplorer } from "@/components/coins/coins-explorer";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Coins",
  description: "Trade creator coins and Starknet memecoins on Medialane.",
  alternates: canonical("/coins"),
  openGraph: {
    title: "Coins | Medialane",
    description: "Trade creator coins and Starknet memecoins on Medialane.",
    url: "/coins",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Medialane Coins" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coins | Medialane",
    description: "Trade creator coins and Starknet memecoins on Medialane.",
    images: ["/og-image.jpg"],
  },
};

export default function CoinsPage() {
  return (
    <PageContainer className="box-border max-w-full pt-20 pb-8 space-y-8">
      <CoinsExplorer />
    </PageContainer>
  );
}
