import type { Metadata } from "next";
import { DiscoverPage } from "@/components/discover";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Discover";
const description = "Explore trending assets and creators on Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/discover"),
  ...buildSocialMetadata({ title, description, imageAlt: "Discover on Medialane" }),
};

export default function DiscoverPreviewPage() {
  return <DiscoverPage />;
}
