"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useOrders } from "@/hooks/use-orders";
import { ListingCard, ListingCardSkeleton } from "./listing-card";
import { PurchaseDialog } from "./purchase-dialog";
import { Button } from "@/components/ui/button";
import { LoadMoreSentinel } from "@medialane/ui";
import type { ApiOrder, SortOrder } from "@medialane/sdk";

const PAGE_SIZE = 15;
const BACKEND_PAGE_SIZE = 50;

interface ListingsGridProps {
  sort?: string;
  currency?: string;
  orderType?: string; // "listings" | "offers" | "" (all)
  minPrice?: string;
  maxPrice?: string;
}

export function ListingsGrid({ sort = "recent", currency, orderType = "", minPrice, maxPrice }: ListingsGridProps = {}) {
  const [backendPage, setBackendPage] = useState(1);
  const [visiblePages, setVisiblePages] = useState(1);
  const [allOrders, setAllOrders] = useState<ApiOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  // Reset accumulated orders when filters change
  const prevFilters = useRef({ sort, currency, orderType, minPrice, maxPrice });
  useEffect(() => {
    const f = prevFilters.current;
    if (f.sort !== sort || f.currency !== currency || f.orderType !== orderType || f.minPrice !== minPrice || f.maxPrice !== maxPrice) {
      prevFilters.current = { sort, currency, orderType, minPrice, maxPrice };
      setBackendPage(1);
      setVisiblePages(1);
      setAllOrders([]);
    }
  }, [sort, currency, orderType, minPrice, maxPrice]);

  const { orders, meta, isLoading } = useOrders({
    status: "ACTIVE",
    sort: sort as SortOrder,
    ...(currency ? { currency } : {}),
    ...(minPrice ? { minPrice } : {}),
    ...(maxPrice ? { maxPrice } : {}),
    page: backendPage,
    limit: BACKEND_PAGE_SIZE,
  });

  // Append incoming page to accumulated list
  useEffect(() => {
    if (isLoading) return;
    if (backendPage === 1) {
      setAllOrders(orders);
    } else {
      setAllOrders((prev) => {
        const existing = new Set(prev.map((o) => o.orderHash));
        const newItems = orders.filter((o) => !existing.has(o.orderHash));
        return newItems.length > 0 ? [...prev, ...newItems] : prev;
      });
    }
  }, [orders, isLoading, backendPage]);

  // Client-side type filter (backend doesn't support itemType param).
  // Default ("" / "all") shows only listings — offers (bids) are not useful
  // in the browse grid and are accessible via the "Offers" filter tab.
  const filteredOrders = orderType === "offers"
    ? allOrders.filter((o) => o.offer.itemType === "ERC20")
    : allOrders.filter((o) => o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155");

  const visibleLimit = visiblePages * PAGE_SIZE;
  const displayedOrders = filteredOrders.slice(0, visibleLimit);

  const isInitialLoading = isLoading && allOrders.length === 0;
  const isLoadingMore = isLoading && allOrders.length > 0;
  const backendTotal = meta?.total ?? 0;
  const hasBackendMore = backendTotal > 0
    ? allOrders.length < backendTotal
    : orders.length === BACKEND_PAGE_SIZE;
  const hasBufferedOrders = filteredOrders.length > displayedOrders.length;
  const hasMore = hasBufferedOrders || hasBackendMore || isLoadingMore;

  useEffect(() => {
    if (isLoading || !hasBackendMore || filteredOrders.length >= visibleLimit) return;
    setBackendPage((p) => p + 1);
  }, [filteredOrders.length, hasBackendMore, isLoading, visibleLimit]);

  const handleBuy = (order: ApiOrder) => {
    setSelectedOrder(order);
    setPurchaseOpen(true);
  };

  const handleLoadMore = () => {
    setVisiblePages((p) => p + 1);
  };

  if (isInitialLoading || (filteredOrders.length === 0 && hasBackendMore)) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (filteredOrders.length === 0 && !isLoading && !hasBackendMore) {
    const emptyHeading =
      orderType === "offers" ? "No offers yet" : "No listings yet";
    const emptyBody =
      orderType === "offers"
        ? "No active bids on any assets right now."
        : "Be the first to list your IP asset on Medialane.";
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-2xl font-bold">{emptyHeading}</p>
        <p className="text-muted-foreground max-w-sm">{emptyBody}</p>
        {orderType !== "offers" && (
          <Button variant="outline" asChild>
            <Link href="/create">Create &amp; List</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {displayedOrders.map((order) => (
            <ListingCard key={order.orderHash} order={order} onBuy={handleBuy} />
          ))}
          {isLoadingMore &&
            Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <ListingCardSkeleton key={`loading-${i}`} />
            ))}
        </div>

        <LoadMoreSentinel hasMore={hasMore} isLoading={isLoadingMore} onLoadMore={handleLoadMore} />

        {!hasMore && filteredOrders.length > PAGE_SIZE && (
          <p className="text-center text-xs text-muted-foreground">
            All {filteredOrders.length} {orderType === "offers" ? "offers" : "listings"} shown
          </p>
        )}
      </div>

      {selectedOrder && (
        <PurchaseDialog
          order={selectedOrder}
          open={purchaseOpen}
          onOpenChange={(open) => {
            setPurchaseOpen(open);
            if (!open) setSelectedOrder(null);
          }}
        />
      )}
    </>
  );
}
