import type { Metadata } from "next";
import { RemixBrowsePage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "NFT Remix | Launchpad";
const description = "Create a new NFT from an existing one, with its own license and recorded credit to the original.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/remix"),
  ...buildSocialMetadata({ title, description }),
};

export default function RemixPage() {
  return <RemixBrowsePage />;
}
