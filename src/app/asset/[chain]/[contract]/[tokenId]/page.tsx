import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchTokenMeta, fetchCollectionMeta, ipfsToHttpServer } from "@/lib/api-server";
import { canonical, buildBreadcrumbJsonLd, buildProductJsonLd, buildSocialMetadata } from "@/lib/seo";
import { chainFromSlug, assetHref, collectionHref } from "@/lib/routes";
import { JsonLd } from "@/components/seo/json-ld";
import AssetPageClient from "./asset-page-client";

export const revalidate = 60;

interface Props {
  params: Promise<{ chain: string; contract: string; tokenId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chain, contract, tokenId } = await params;
  const resolvedChain = chainFromSlug(chain);
  if (!resolvedChain) notFound();

  const token = await fetchTokenMeta(contract, tokenId);

  const name        = token?.metadata?.name ?? token?.name ?? `Token #${tokenId}`;
  const description = token?.metadata?.description ?? token?.description ?? "View this IP asset on Medialane.";
  const rawImage    = token?.metadata?.image ?? token?.image;
  const imageUrl    = rawImage ? ipfsToHttpServer(rawImage) : undefined;

  return {
    title: name,
    description,
    alternates: canonical(assetHref(resolvedChain, contract, tokenId)),
    ...buildSocialMetadata({ title: name, description, imageUrl }),
  };
}

export default async function AssetPage({ params }: Props) {
  const { chain, contract, tokenId } = await params;
  const resolvedChain = chainFromSlug(chain);
  if (!resolvedChain) notFound();

  const [token, collection] = await Promise.all([
    fetchTokenMeta(contract, tokenId),
    fetchCollectionMeta(contract),
  ]);

  const name        = token?.metadata?.name ?? token?.name ?? `Token #${tokenId}`;
  const description = token?.metadata?.description ?? token?.description ?? "View this IP asset on Medialane.";
  const rawImage    = token?.metadata?.image ?? token?.image;
  const imageUrl    = rawImage ? ipfsToHttpServer(rawImage) : undefined;
  const collectionName = collection?.name ?? "Collection";

  const jsonLd = [
    buildProductJsonLd({
      name,
      path: assetHref(resolvedChain, contract, tokenId),
      description,
      image: imageUrl,
      sku: tokenId,
      brand: collectionName,
    }),
    buildBreadcrumbJsonLd([
      { name: "Marketplace", path: "/marketplace" },
      { name: collectionName, path: collectionHref(resolvedChain, contract) },
      { name, path: assetHref(resolvedChain, contract, tokenId) },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <AssetPageClient />
    </>
  );
}
