import type { Metadata } from "next";
import { CollectionsPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Collections";
const description = "Browse IP collections on Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/collections"),
  ...buildSocialMetadata({ title, description, imageAlt: "Medialane Collections" }),
};

export default function CollectionsRoute() {
  return <CollectionsPage />;
}
