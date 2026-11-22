import type { Metadata } from "next";
import MarketplacePageClient from "./marketplace-page-client";
import { fetchActiveOrders } from "@/lib/api-server";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Marketplace";
const description = "Buy and license IP assets on Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/marketplace"),
  ...buildSocialMetadata({ title, description, imageAlt: "Medialane Marketplace" }),
};

export const revalidate = 30;

export default async function MarketplacePage() {
  const initialOrders = await fetchActiveOrders(50);
  return <MarketplacePageClient initialOrders={initialOrders ?? undefined} />;
}
