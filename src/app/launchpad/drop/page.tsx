import type { Metadata } from "next";
import { DropsPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Collection Drop";
const description = "Launch a limited edition drop.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/drop"),
  ...buildSocialMetadata({ title, description }),
};

export default function DropPage() {
  return <DropsPage />;
}
