"use client";

import { useState } from "react";
import { DiscoverActivityStrip } from "@medialane/ui";
import { useOrders } from "@/hooks/use-orders";
import { useWallet } from "@/hooks/use-wallet";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { normalizeAddress } from "@medialane/sdk";
import type { ApiOrder } from "@medialane/sdk";

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
          !!address && !!order.offerer && normalizeAddress("STARKNET", order.offerer) === normalizeAddress("STARKNET", address)
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
