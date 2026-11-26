import type { Metadata } from "next";
import { DropsPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "NFT Drop";
const description = "Launch a new collection your audience can get directly from you, for free or at your price.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/drop"),
  ...buildSocialMetadata({ title, description }),
};

export default function DropPage() {
  return <DropsPage />;
}
