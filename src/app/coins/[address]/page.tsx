import type { Metadata } from "next";
import { fetchCollectionMeta, ipfsToHttpServer } from "@/lib/api-server";
import { canonical, buildBreadcrumbJsonLd, buildProductJsonLd, buildSocialMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import CollectionPageClient from "@/app/collections/[contract]/collection-page-client";

export const revalidate = 60;

interface Props {
  params: Promise<{ address: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const col = await fetchCollectionMeta(address);

  const name = col?.name ?? "Creator Coin";
  const description = col?.description ?? `Buy, hold, and trade ${name} on Medialane.`;
  const rawImage = col?.image;
  const imageUrl = rawImage ? ipfsToHttpServer(rawImage) : undefined;

  return {
    title: name,
    description,
    // Canonical lives at /coins/[address]; /collections/[address] still resolves
    // the same coin view for old links and points here.
    alternates: canonical(`/coins/${address}`),
    ...buildSocialMetadata({ title: name, description, imageUrl }),
  };
}

// Creator Coins render through the same dispatcher as collections (it
// early-returns the coin view for `uiVariant === "coin"`); the client reads the
// `address` route param. /coins/[address] is the friendlier canonical URL.
export default async function CoinDetailPage({ params }: Props) {
  const { address } = await params;
  const col = await fetchCollectionMeta(address);

  const name = col?.name ?? "Creator Coin";
  const rawImage = col?.image;
  const imageUrl = rawImage ? ipfsToHttpServer(rawImage) : undefined;

  const jsonLd = [
    buildProductJsonLd({
      name,
      path: `/coins/${address}`,
      description: col?.description,
      image: imageUrl,
    }),
    buildBreadcrumbJsonLd([
      { name: "Coins", path: "/coins" },
      { name, path: `/coins/${address}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <CollectionPageClient />
    </>
  );
}
