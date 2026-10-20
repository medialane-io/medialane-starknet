"use client";

import { DiscoverCollectionsStrip, useCollections } from "@medialane/ui";


import type { ApiCollection } from "@medialane/sdk";
import { collectionHref } from "@/lib/routes";

export function CollectionsStrip() {
  const { collections, isLoading } = useCollections(1, 8);

  return (
    <DiscoverCollectionsStrip
      collections={collections}
      isLoading={isLoading}
      getHref={(col: ApiCollection) => collectionHref("STARKNET", col.contractAddress)}
      allCollectionsHref="/collections"
    />
  );
}
