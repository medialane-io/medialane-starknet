import type { Metadata } from "next";
import MarketplacePageClient from "./marketplace-page-client";
import { fetchActiveOrders } from "@/lib/api-server";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Marketplace";
const description = "Browse, buy, and license IP assets on the Medialane marketplace using Starknet wallets.";

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
