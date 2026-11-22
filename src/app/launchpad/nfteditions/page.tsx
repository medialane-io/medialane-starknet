import type { Metadata } from "next";
import { EditionsPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Limited Editions | Launchpad";
const description = "Create numbered editions of a work.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/nfteditions"),
  ...buildSocialMetadata({ title, description }),
};

export default function NFTEditionsPage() {
  return <EditionsPage />;
}
