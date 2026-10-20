"use client";

import { ListingCard as PackageListingCard, ListingCardMenu, ListingCardSkeleton } from "@medialane/ui";
import type { ApiOrder } from "@medialane/sdk";
import { ipfsToHttp, usdValueFor } from "@/lib/utils";
import { useUsdPrices } from "@/hooks/use-usd-prices";

export { ListingCardSkeleton };

interface ListingCardProps {
  order: ApiOrder;
  onBuy?: (order: ApiOrder) => void;
  compact?: boolean;
}

export function ListingCard({ order, onBuy, compact = false }: ListingCardProps) {
  const usdPrices = useUsdPrices();
  return (
    <PackageListingCard
      order={order}
      onBuy={onBuy}
      compact={compact}
      overflowMenu={<ListingCardMenu order={order} />}
      imageUrl={order.token?.image ? ipfsToHttp(order.token.image) : null}
      usdValue={usdValueFor(order.price?.formatted, order.price?.currency, usdPrices)}
    />
  );
}
