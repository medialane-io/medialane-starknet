"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AddressDisplay } from "@/components/shared/address-display";
import { Briefcase } from "lucide-react";
import { useUserOrders } from "@/hooks/use-orders";
import { useTokensByOwner } from "@/hooks/use-tokens";
import { markOffersAsSeen } from "@/hooks/use-unread-offers";
import { useRemixOffers } from "@/hooks/use-remix-offers";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectGate } from "@/components/connect-gate";
import { HelpIcon } from "@/components/ui/help-icon";
import { ScoreSummaryCard } from "@medialane/ui";
import { useRewards, useRewardsConfig } from "@/hooks/use-rewards";
import {
  PortfolioSubnav,
  derivePortfolioCounts,
  type PortfolioNavGroup,
} from "@medialane/ui";

const NAV_GROUPS: PortfolioNavGroup[] = [
  {
    label: "My Items",
    items: [
      { label: "Assets",            href: "/portfolio/assets" },
      { label: "Collections",       href: "/portfolio/collections" },
      { label: "Coins",             href: "/portfolio/coins" },
    ],
  },
  {
    label: "Trading",
    items: [
      { label: "Listings",          href: "/portfolio/listings" },
      { label: "Offers received",   href: "/portfolio/received", badge: { key: "offers", variant: "destructive" } },
      { label: "Offers sent",       href: "/portfolio/offers" },
      { label: "Counter-offers",    href: "/portfolio/counter-offers", badge: { key: "counters", variant: "warning" } },
      { label: "Licensing",         href: "/portfolio/licensing", badge: { key: "remixes", variant: "primary" } },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Activity",          href: "/portfolio/activity" },
      { label: "Settings",          href: "/portfolio/settings" },
    ],
  },
];

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  const { address: walletAddress } = useWallet();
  const pathname = usePathname();
  const address = walletAddress;
  const { orders } = useUserOrders(address ?? null);
  const { meta: tokenMeta } = useTokensByOwner(address ?? null, 1);
  const { offers: remixOffers } = useRemixOffers("creator");
  const { data: rewards } = useRewards(address);
  const { data: rewardsConfig } = useRewardsConfig();

  const counts = derivePortfolioCounts(orders, remixOffers, address);

  const totalAssetsCount = tokenMeta?.total ?? null;

  useEffect(() => {
    const receivedOffers = orders.filter(
      (o) => o.status === "ACTIVE" && o.offer.itemType === "ERC20"
    );
    if (receivedOffers.length > 0) {
      markOffersAsSeen(receivedOffers.map((o) => o.orderHash));
    }
  }, [orders]);

  return (
    <ConnectGate
      title="Connect your wallet"
      subtitle="Connect your wallet to view your assets, listings, and offers."
    >
    <div className="px-4 sm:px-6 lg:px-8 pt-20 pb-8 space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Briefcase className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Portfolio</span>
        </div>
        <AddressDisplay address={address ?? ""} chars={6} className="text-sm font-mono" />
        {/* Stat pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {totalAssetsCount !== null ? (
            <span className="bg-muted rounded-full px-3 py-1 text-sm font-medium text-muted-foreground">
              {totalAssetsCount} Assets
            </span>
          ) : (
            <span className="bg-muted rounded-full px-3 py-1 w-20 h-6 animate-pulse inline-block" />
          )}
          <span className="flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm font-medium text-muted-foreground">
            {counts.listings} Listings
            <HelpIcon content="Your active marketplace listings — assets currently for sale" side="bottom" />
          </span>
          {counts.received > 0 && (
            <span className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
              {counts.received} Offers received
              <HelpIcon content="Buyers have made offers on your assets — go to Offers received to accept, counter, or decline" side="bottom" />
            </span>
          )}
        </div>
      </div>

      {/* Score summary */}
      {rewards && (
        <ScoreSummaryCard
          level={rewards.currentLevel}
          levelName={rewards.currentLevelName}
          badgeColor={rewards.badgeColor}
          totalXp={rewards.totalXp}
          levelXp={rewardsConfig?.levels.find((l) => l.level === rewards.currentLevel)?.xpRequired ?? 0}
          nextLevel={rewards.nextLevel}
          topBadges={rewards.badges.slice(0, 4)}
          href="/rewards"
        />
      )}

      {/* Subnav */}
      <PortfolioSubnav
        groups={NAV_GROUPS}
        pathname={pathname}
        badgeCounts={{
          offers: counts.received,
          remixes: counts.remix,
          counters: counts.counter,
        }}
      />

      {/* Page content */}
      {children}
    </div>
    </ConnectGate>
  );
}
