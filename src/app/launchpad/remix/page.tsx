import type { Metadata } from "next";
import { RemixBrowsePage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Remix | Launchpad";
const description = "Remix a work with credit to its creator.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/remix"),
  ...buildSocialMetadata({ title, description }),
};

export default function RemixPage() {
  return <RemixBrowsePage />;
}
