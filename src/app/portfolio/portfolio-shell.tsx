"use client";

import { PortfolioShell as SharedPortfolioShell, PORTFOLIO_TABS } from "@medialane/ui";
import { useRemixOffers } from "@/hooks/use-remix-offers";

const TABS = PORTFOLIO_TABS.flatMap((t) =>
  t.key === "collections" ? [t, { key: "coins", label: "Coins", href: "/portfolio/coins" }] : [t]
);

export function PortfolioShell({ children }: { children: React.ReactNode }) {
  const { offers } = useRemixOffers("creator");
  return <SharedPortfolioShell tabs={TABS} remixOffers={offers}>{children}</SharedPortfolioShell>;
}
