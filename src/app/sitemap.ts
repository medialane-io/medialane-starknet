import type { MetadataRoute } from "next";
import { IP_TYPE_CONFIG } from "@/lib/ip-type-config";
import { APP_URL } from "@/lib/seo";
import { assetHref, collectionHref } from "@/lib/routes";
import { getMedialaneClient } from "@/lib/medialane-client";

const BASE_URL = APP_URL;
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${BASE_URL}/discover`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/marketplace`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/collections`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/creators`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/launchpad`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE_URL}/launchpad/drop`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/launchpad/pop`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/launchpad/nfteditions`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/claim`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE_URL}/activities`, changeFrequency: "hourly", priority: 0.6 },
  ];

  const ipTypeRoutes: MetadataRoute.Sitemap = IP_TYPE_CONFIG.map(({ slug }) => ({
    url: `${BASE_URL}/${slug}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  const api = getMedialaneClient().api;
  const [collectionsData, tokensData, creatorsData] = await Promise.all([
    api.listCollections({ limit: 500 }).catch(() => null),
    api.getTokens({ limit: 2000 }).catch(() => null),
    api.getCreators({ limit: 500 }).catch(() => null),
  ]);

  const collectionRoutes: MetadataRoute.Sitemap = (collectionsData?.data ?? []).map((c) => ({
    url: `${BASE_URL}${collectionHref("STARKNET", c.contractAddress)}`,
    changeFrequency: "daily" as const,
    priority: 0.7,
    lastModified: c.updatedAt ? new Date(c.updatedAt) : undefined,
  }));

  const tokenRoutes: MetadataRoute.Sitemap = (tokensData?.data ?? []).map((t) => ({
    url: `${BASE_URL}${assetHref("STARKNET", t.contractAddress, t.tokenId)}`,
    changeFrequency: "weekly" as const,
    priority: 0.5,
    lastModified: t.updatedAt ? new Date(t.updatedAt) : undefined,
  }));

  const creatorRoutes: MetadataRoute.Sitemap = (creatorsData?.creators ?? [])
    .filter((c) => c.username)
    .map((c) => ({
      url: `${BASE_URL}/creator/${c.username}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  return [...staticRoutes, ...ipTypeRoutes, ...collectionRoutes, ...tokenRoutes, ...creatorRoutes];
}
