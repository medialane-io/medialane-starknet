import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getService } from "@medialane/sdk";
import { fetchCollectionMeta, ipfsToHttpServer } from "@/lib/api-server";
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
    openGraph: {
      title: `${name} | Medialane`,
      description,
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: name }],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: `${name} | Medialane`,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
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
  return <CollectionPageClient />;
}
