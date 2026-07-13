"use client";

import { HeroSlider as UiHeroSlider } from "@medialane/ui";
import { useCollections } from "@/hooks/use-collections";
import type { ApiCollection } from "@medialane/sdk";

export function HeroSlider({ initial }: { initial?: ApiCollection[] }) {
  const { collections, isLoading } = useCollections(1, 3, true, "recent", true, undefined, undefined, initial);
  return (
    <UiHeroSlider
      collections={collections}
      isLoading={isLoading}
      getHref={(c) => `/collections/${c.contractAddress}`}
    />
  );
}
