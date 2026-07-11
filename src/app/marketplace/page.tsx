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

// ISR — the first page of listings renders as real cards in the server HTML
// instead of skeletons awaiting a client fetch.
export const revalidate = 30;

export default async function MarketplacePage() {
  const initialOrders = await fetchActiveOrders(50);
  return <MarketplacePageClient initialOrders={initialOrders ?? undefined} />;
}
