import type { Metadata } from "next";
import { EditionsPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Limited Edition NFT | Launchpad";
const description = "Create an immutable, licensed NFT in multiple copies for your audience to collect and trade.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/nfteditions"),
  ...buildSocialMetadata({ title, description }),
};

export default function NFTEditionsPage() {
  return <EditionsPage />;
}
