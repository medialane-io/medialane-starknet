import type { Metadata } from "next";
import { SingleEditionMint } from "@medialane/ui";
import { CreateAside } from "@medialane/ui/create-aside";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Publish a work | Launchpad";
const description = "Publish a single-copy work.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/single-editions"),
  ...buildSocialMetadata({ title, description }),
};

export default function SingleEditionsPage() {
  return <SingleEditionMint aside={<CreateAside kind="asset" />} />;
}
