import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getService } from "@medialane/sdk";
import { fetchCollectionMeta, ipfsToHttpServer } from "@/lib/api-server";
import { absoluteUrl, canonical, buildBreadcrumbJsonLd, buildSocialMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import CollectionPageClient from "./collection-page-client";

export const revalidate = 60;

interface Props {
  params: Promise<{ contract: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { contract } = await params;
  const col = await fetchCollectionMeta(contract);

  const name        = col?.name ?? "Collection";
  const description = col?.description
    ?? `Browse ${col?.totalSupply ?? ""} items in the ${name} collection on Medialane.`.trim();
  const rawImage    = col?.image;
  const imageUrl    = rawImage ? ipfsToHttpServer(rawImage) : undefined;

  return {
    title: name,
    description,
    alternates: canonical(`/collections/${contract}`),
    ...buildSocialMetadata({ title: name, description, imageUrl }),
  };
}

export default async function CollectionPage({ params }: Props) {
  const { contract } = await params;
  // Creator Coins are canonical at /coins/[address]; redirect coin contracts
  // hit under /collections so the friendlier URL is always the one in the bar.
  // (The fetch is deduped with generateMetadata's identical request.)
  const col = await fetchCollectionMeta(contract);
  if (col?.service && getService(col.service)?.uiVariant === "coin") {
    redirect(`/coins/${contract}`);
  }

  const name = col?.name ?? "Collection";
  const rawImage = col?.image;
  const imageUrl = rawImage ? ipfsToHttpServer(rawImage) : undefined;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name,
      ...(col?.description && { description: col.description }),
      ...(imageUrl && { image: imageUrl }),
      url: absoluteUrl(`/collections/${contract}`),
      ...(typeof col?.totalSupply === "number" && {
        mainEntity: { "@type": "ItemList", numberOfItems: col.totalSupply },
      }),
    },
    buildBreadcrumbJsonLd([
      { name: "Collections", path: "/collections" },
      { name, path: `/collections/${contract}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <CollectionPageClient />
    </>
  );
}
