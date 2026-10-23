"use client";

import { PortfolioShell as SharedPortfolioShell, PORTFOLIO_TABS } from "@medialane/ui";
import { useRemixOffers } from "@/hooks/use-remix-offers";

const TABS = PORTFOLIO_TABS.flatMap((t) =>
  t.key === "collections" ? [t, { key: "coins", label: "Coins", href: "/portfolio/coins" }] : [t]
);

export function PortfolioShell({ children }: { children: React.ReactNode }) {
  const { offers, isLoading } = useRemixOffers("creator");
  const { offers: requests, isLoading: requestsLoading } = useRemixOffers("requester");
  const licensing = { present: offers.length + requests.length > 0, isLoading: isLoading || requestsLoading };
  return <SharedPortfolioShell tabs={TABS} remixOffers={offers} licensing={licensing}>{children}</SharedPortfolioShell>;
}
