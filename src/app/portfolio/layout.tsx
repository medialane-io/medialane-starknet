"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useUserOrders } from "@/hooks/use-orders";
import { markOffersAsSeen } from "@/hooks/use-unread-offers";
import { useRemixOffers } from "@/hooks/use-remix-offers";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectGate } from "@/components/connect-gate";
import { useRewards } from "@/hooks/use-rewards";
import { useMySponsorshipDealCounts } from "@/hooks/use-sponsorship";
import {
  PortfolioHeader,
  PortfolioNav,
  derivePortfolioCounts,
  type PortfolioNavSection,
} from "@medialane/ui";

const NAV_SECTIONS: PortfolioNavSection[] = [
  { label: "Overview", href: "/portfolio" },
  {
    label: "Items",
    href: "/portfolio/assets",
    children: [
      { label: "Assets",      href: "/portfolio/assets" },
      { label: "Collections", href: "/portfolio/collections" },
      { label: "Coins",       href: "/portfolio/coins" },
    ],
  },
  {
    label: "Trading",
    href: "/portfolio/listings",
    children: [
      { label: "Listings",        href: "/portfolio/listings" },
      { label: "Offers received", href: "/portfolio/received", badge: { key: "offers", variant: "destructive" } },
      { label: "Offers sent",     href: "/portfolio/offers" },
      { label: "Counter-offers",  href: "/portfolio/counter-offers", badge: { key: "counters", variant: "warning" } },
      { label: "Licensing",       href: "/portfolio/licensing", badge: { key: "remixes", variant: "primary" } },
      { label: "Sponsorships",    href: "/portfolio/sponsorships", badge: { key: "sponsorships", variant: "primary" } },
    ],
  },
  { label: "Activity", href: "/portfolio/activity" },
  { label: "Settings", href: "/portfolio/settings" },
];

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  const { address: walletAddress } = useWallet();
  const pathname = usePathname();
  const address = walletAddress;
  const { orders } = useUserOrders(address ?? null);
  const { offers: remixOffers } = useRemixOffers("creator");
  const { data: rewards } = useRewards(address);
  const { pendingCount: sponsorshipPendingCount } = useMySponsorshipDealCounts(address);

  const counts = derivePortfolioCounts(orders, remixOffers, address, sponsorshipPendingCount);

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
      <PortfolioHeader
        address={address ?? ""}
        score={
          rewards
            ? {
                levelName: rewards.currentLevelName,
                totalXp: rewards.totalXp,
                href: "/rewards",
              }
            : null
        }
      />

      <PortfolioNav
        sections={NAV_SECTIONS}
        pathname={pathname}
        badgeCounts={{
          offers: counts.received,
          remixes: counts.remix,
          counters: counts.counter,
          sponsorships: counts.sponsorships,
        }}
      />

      {/* Page content */}
      {children}
    </div>
    </ConnectGate>
  );
}
