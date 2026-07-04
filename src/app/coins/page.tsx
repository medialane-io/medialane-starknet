import type { Metadata } from "next";
import { PageContainer } from "@medialane/ui";
import { CoinsExplorer } from "@/components/coins/coins-explorer";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Coins";
const description = "Trade creator coins and Starknet memecoins on Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/coins"),
  ...buildSocialMetadata({ title, description, imageAlt: "Medialane Coins" }),
};

export default function CoinsPage() {
  return (
    <PageContainer className="box-border max-w-full pt-20 pb-8 space-y-8">
      <CoinsExplorer />
    </PageContainer>
  );
}
