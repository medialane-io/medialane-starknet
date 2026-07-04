import type { Metadata } from "next";
import { fetchTokenMeta, fetchCollectionMeta, ipfsToHttpServer } from "@/lib/api-server";
import { canonical, buildBreadcrumbJsonLd, buildProductJsonLd, buildSocialMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import AssetPageClient from "./asset-page-client";

export const revalidate = 60;

interface Props {
  params: Promise<{ contract: string; tokenId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { contract, tokenId } = await params;
  const token = await fetchTokenMeta(contract, tokenId);

  const name        = token?.metadata?.name ?? token?.name ?? `Token #${tokenId}`;
  const description = token?.metadata?.description ?? token?.description ?? "View this IP asset on Medialane.";
  const rawImage    = token?.metadata?.image ?? token?.image;
  const imageUrl    = rawImage ? ipfsToHttpServer(rawImage) : undefined;

  return {
    title: name,
    description,
    alternates: canonical(`/asset/${contract}/${tokenId}`),
    ...buildSocialMetadata({ title: name, description, imageUrl }),
  };
}

export default async function AssetPage({ params }: Props) {
  const { contract, tokenId } = await params;
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
      path: `/asset/${contract}/${tokenId}`,
      description,
      image: imageUrl,
      sku: tokenId,
      brand: collectionName,
    }),
    buildBreadcrumbJsonLd([
      { name: "Marketplace", path: "/marketplace" },
      { name: collectionName, path: `/collections/${contract}` },
      { name, path: `/asset/${contract}/${tokenId}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <AssetPageClient />
    </>
  );
}
