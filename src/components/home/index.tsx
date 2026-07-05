"use client";

import { HeroSlider } from "./hero-slider";
import { ActivityTicker } from "@/components/shared/activity-ticker";
import { TrendingCollections } from "./trending-collections";
import { NewOnMarketplace } from "./new-on-marketplace";
import { CreatorAirdropBanner } from "./creator-airdrop";
import { AirdropSection } from "./airdrop-section";
import { TopCreators } from "./top-creators";
import { PageContainer } from "@medialane/ui";

export function HomePage() {
  return (
    <div className="pb-20">
      {/* Hero — full-bleed */}
      <HeroSlider />

      {/* Live market ticker */}
      <PageContainer className="box-border max-w-full pt-6 pb-0">
        <ActivityTicker limit={14} />
      </PageContainer>

      {/* Padded content sections */}
      <PageContainer className="box-border max-w-full pt-0 pb-0 space-y-20 mt-16">
        <TrendingCollections />
        <NewOnMarketplace />
        <TopCreators />
        <CreatorAirdropBanner />
        <AirdropSection />
      </PageContainer>
    </div>
  );
}
