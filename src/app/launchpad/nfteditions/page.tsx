import type { Metadata } from "next";
import { NFTEditionsContent } from "./nfteditions-content";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "NFT Editions | Launchpad";
const description = "Manage your multi-edition ERC-1155 IP collections — mint new token editions or deploy a new collection.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/nfteditions"),
  ...buildSocialMetadata({ title, description }),
};

export default function NFTEditionsPage() {
  return <NFTEditionsContent />;
}
