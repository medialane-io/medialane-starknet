"use client";

import { DiscoverHero, usePlatformStats, useOrders } from "@medialane/ui";



export function Hero() {
  const { stats } = usePlatformStats();
  const { orders } = useOrders({ status: "ACTIVE", sort: "recent", limit: 14 });

  return (
    <DiscoverHero
      stats={stats ?? null}
      orders={orders}
      badgeText="Powered on Starknet"
      headlineText="Create, license & trade"
    />
  );
}
