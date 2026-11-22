import type { Metadata } from "next";
import { HomePage } from "@/components/home";
import { fetchFeaturedCollections } from "@/lib/api-server";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Medialane — Creator Launchpad + NFT Marketplace";
const description =
  "Create and trade intellectual property on Starknet.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/"),
  ...buildSocialMetadata({ title, description, imageAlt: "Medialane" }),
};

export const revalidate = 60;

export default async function Page() {
  const featured = await fetchFeaturedCollections(3);
  return <HomePage initialFeatured={featured ?? undefined} />;
}
