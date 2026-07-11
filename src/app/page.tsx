import type { Metadata } from "next";
import { HomePage } from "@/components/home";
import { fetchFeaturedCollections } from "@/lib/api-server";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Medialane — Creator Launchpad + NFT Marketplace";
const description =
  "Mint, license, and trade intellectual property as NFTs on Starknet. Zero platform fees to mint. Programmable royalties.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/"),
  ...buildSocialMetadata({ title, description, imageAlt: "Medialane" }),
};

// ISR — the hero collections render in the server HTML instead of after
// hydration + a client fetch (they were the LCP bottleneck).
export const revalidate = 60;

export default async function Page() {
  const featured = await fetchFeaturedCollections(3);
  return <HomePage initialFeatured={featured ?? undefined} />;
}
