"use client";

import { useState } from "react";
import { DiscoverActivityStrip } from "@medialane/ui";
import { useOrders } from "@/hooks/use-orders";
import { useWallet } from "@/hooks/use-wallet";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import type { ApiOrder } from "@medialane/sdk";

/** The "Activity" recent-listings carousel. The old "Community" carousel that
 *  used to live alongside this was replaced by CommunitySection (2-column
 *  activities + leaderboard) — see discover/community-section.tsx. */
export function FeedSection() {
  const { orders, isLoading } = useOrders({ status: "ACTIVE", sort: "recent", limit: 10 });
  const { address } = useWallet();
  const [buyOrder, setBuyOrder] = useState<ApiOrder | null>(null);

  return (
    <>
      <DiscoverActivityStrip
        orders={orders}
        isLoading={isLoading}
        marketplaceHref="/marketplace"
        onBuyOrder={setBuyOrder}
        isOwnOrder={(order) =>
          !!address && !!order.offerer && order.offerer.toLowerCase() === address.toLowerCase()
        }
      />

      {buyOrder && (
        <PurchaseDialog
          open={!!buyOrder}
          onOpenChange={(v) => { if (!v) setBuyOrder(null); }}
          order={buyOrder}
        />
      )}
    </>
  );
}
