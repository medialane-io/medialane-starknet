import type { Metadata } from "next";
import { SingleEditionMint } from "@medialane/ui";
import { PageAside } from "@medialane/ui/page-aside";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Single NFT | Launchpad";
const description = "Create an immutable NFT with licensing for your content.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/single-editions"),
  ...buildSocialMetadata({ title, description }),
};

export default function SingleEditionsPage() {
  return <SingleEditionMint aside={<PageAside kind="asset" />} />;
}
