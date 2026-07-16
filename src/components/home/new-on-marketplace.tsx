"use client";

import { useState } from "react";
import Link from "next/link";
import { Tag } from "lucide-react";
import { useOrders } from "@/hooks/use-orders";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { ScrollSection } from "@medialane/ui";
import type { ApiOrder } from "@medialane/sdk";

export function NewOnMarketplace() {
  const { orders, isLoading } = useOrders({ status: "ACTIVE", limit: 10, page: 1 });
  const [buyOrder, setBuyOrder] = useState<ApiOrder | null>(null);

  const listings = orders.filter((o) => o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155").slice(0, 10);

  return (
    <>
      <ScrollSection
        icon={<Tag className="h-3.5 w-3.5 text-white" />}
        iconBg="bg-gradient-to-br from-brand-rose to-brand-rose shadow-md shadow-brand-rose/20"
        title="New listings"
        href="/marketplace"
        linkLabel="Marketplace"
      >
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="w-72 snap-start shrink-0">
                <ListingCardSkeleton />
              </div>
            ))
          : listings.length === 0
          ? (
              <p className="text-sm text-muted-foreground py-4">
                No listings yet.{" "}
                <Link href="/launchpad/single-editions" className="text-primary hover:underline">
                  Be the first to list an asset.
                </Link>
              </p>
            )
          : listings.map((order) => (
              <div key={order.orderHash} className="w-72 snap-start shrink-0">
                <ListingCard order={order} onBuy={() => setBuyOrder(order)} />
              </div>
            ))}
      </ScrollSection>

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
