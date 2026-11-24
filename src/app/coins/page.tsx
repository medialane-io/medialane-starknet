import type { Metadata } from "next";
import { CoinsExplorer } from "@/components/coins/coins-explorer";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Coins";
const description = "Trade creator coins and Starknet memecoins on Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/coins"),
  ...buildSocialMetadata({ title, description, imageAlt: "Coins" }),
};

export default function CoinsPage() {
  return <CoinsExplorer />;
}
