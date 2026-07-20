import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchCollectionMeta, ipfsToHttpServer } from "@/lib/api-server";
import { canonical, buildBreadcrumbJsonLd, buildProductJsonLd, buildSocialMetadata } from "@/lib/seo";
import { chainFromSlug, coinHref } from "@/lib/routes";
import { JsonLd } from "@/components/seo/json-ld";
import CollectionPageClient from "@/app/collections/[chain]/[contract]/collection-page-client";

export const revalidate = 60;

interface Props {
  params: Promise<{ chain: string; address: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, address } = await params;
  const resolvedChain = chainFromSlug(chain);
  if (!resolvedChain) notFound();

  const col = await fetchCollectionMeta(address);

  const name = col?.name ?? "Creator Coin";
  const description = col?.description ?? `Buy, hold, and trade ${name} on Medialane.`;
  const rawImage = col?.image;
  const imageUrl = rawImage ? ipfsToHttpServer(rawImage) : undefined;

  return {
    title: name,
    description,
    // Canonical lives at /coins/[chain]/[address]; /collections/[chain]/[address]
    // still resolves the same coin view for old links and points here.
    alternates: canonical(coinHref(resolvedChain, address)),
    ...buildSocialMetadata({ title: name, description, imageUrl }),
  };
}

// Creator Coins render through the same dispatcher as collections (it
// early-returns the coin view for `uiVariant === "coin"`); the client reads the
// `address` route param. /coins/[chain]/[address] is the friendlier canonical URL.
export default async function CoinDetailPage({ params }: Props) {
  const { chain, address } = await params;
  const resolvedChain = chainFromSlug(chain);
  if (!resolvedChain) notFound();

  const col = await fetchCollectionMeta(address);

  const name = col?.name ?? "Creator Coin";
  const rawImage = col?.image;
  const imageUrl = rawImage ? ipfsToHttpServer(rawImage) : undefined;

  const jsonLd = [
    buildProductJsonLd({
      name,
      path: coinHref(resolvedChain, address),
      description: col?.description,
      image: imageUrl,
    }),
    buildBreadcrumbJsonLd([
      { name: "Coins", path: "/coins" },
      { name, path: coinHref(resolvedChain, address) },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <CollectionPageClient />
    </>
  );
}
