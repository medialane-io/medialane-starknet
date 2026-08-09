"use client";

import { HeroSlider } from "./hero-slider";
import { ActivityTicker } from "@/components/shared/activity-ticker";
import { TrendingCollections } from "./trending-collections";
import { NewOnMarketplace } from "./new-on-marketplace";
import { CreatorAirdropBanner } from "./creator-airdrop";
import { AirdropSection } from "./airdrop-section";
import { CommunityRewards } from "./community-rewards";
import { PageContainer } from "@medialane/ui";
import type { ApiCollection } from "@medialane/sdk";

export function HomePage({ initialFeatured }: { initialFeatured?: ApiCollection[] }) {
  return (
    <div className="pb-20">
      {/* Hero — full-bleed */}
      <HeroSlider initial={initialFeatured} />

      {/* Live market ticker */}
      <PageContainer className="box-border max-w-full pt-6 pb-0">
        <ActivityTicker limit={14} />
      </PageContainer>

      {/* Padded content sections */}
      <PageContainer className="box-border max-w-full pt-0 pb-0 space-y-20 mt-16">
        <TrendingCollections />
        <NewOnMarketplace />
        <CreatorAirdropBanner />
        <CommunityRewards />
        <AirdropSection />
      </PageContainer>
    </div>
  );
}
