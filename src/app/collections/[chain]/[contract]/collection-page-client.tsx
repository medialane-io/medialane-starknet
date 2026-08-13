"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCollection, useCollectionTokens } from "@/hooks/use-collections";
import { useCoin } from "@/hooks/use-coins";
import { useOrders } from "@/hooks/use-orders";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { TokenCard, TokenCardSkeleton } from "@/components/shared/token-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressDisplay } from "@/components/shared/address-display";
import { Flag, Inbox, Sparkles, Lock, Settings } from "lucide-react";
import { LoadMoreSentinel, HiddenContentBanner, CollectionHeroBanner, ClubOwnerActions, OrderSortControl, sortOrders, type OrderSort } from "@medialane/ui";
import { ReportDialog } from "@/components/report-dialog";
import { useCollectionProfile } from "@/hooks/use-profiles";
import { useGatedContent } from "@/hooks/use-gated-content";
import { GatedContentHero } from "@/components/collection/gated-content-hero";
import { GatedContentPanel } from "@/components/collection/gated-content-panel";
import { OwnerSetupPanel } from "@/components/collection/owner-setup-panel";
import { TransferCollectionOwnershipDialog } from "@/components/collection/transfer-ownership-dialog";
import { ShareButton } from "@/components/shared/share-button";
import { CollectionFilters } from "@/components/collection/collection-filters";
import { CollectionActivityTab } from "@/components/collection/collection-activity-tab";
import { MakeOfferPicker } from "@/components/collection/make-offer-picker";
import { CollectionTraitsTab } from "@/components/collection/collection-traits-tab";
import { ipfsToHttp, formatDisplayPrice, cn, checkIsOwner, usdValueFor } from "@/lib/utils";
import { useUsdPrices } from "@/hooks/use-usd-prices";
import { CollectionServiceAction } from "@/components/services/collection-service-action";
import { TicketOwnerActions } from "@/components/tickets/ticket-owner-actions";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";
import { useWallet } from "@/hooks/use-wallet";
import { CreatorChip } from "@/components/collection/creator-chip";
import { getService, normalizeAddress } from "@medialane/sdk";
import type { ApiToken, ApiOrder, CollectionTokensSort } from "@medialane/sdk";
import { CoinPageClient, CoinPageSkeleton } from "./coin-page-client";

const PAGE_SIZE = 24;

/**
 * Parse a backend price string like "0.000012000000 WBTC" into a clean display + symbol.
 * Strips trailing zeros from the decimal part. Guards against raw-wei values (> 1e12 → "—").
 */
function parsePriceDisplay(raw: string | null | undefined): { numStr: string; symbol: string | null } {
  if (!raw) return { numStr: "—", symbol: null };
  const parts = raw.trim().split(" ");
  const sym = parts.length > 1 ? parts[parts.length - 1] : null;
  const numericPart = sym ? parts.slice(0, -1).join(" ") : raw;
  const num = Number(numericPart);
  if (isNaN(num)) return { numStr: "—", symbol: sym };
  if (num > 1e12) return { numStr: "—", symbol: null };
  const formatted = formatDisplayPrice(numericPart);
  if (!formatted || formatted === "—") return { numStr: "—", symbol: sym };
  const clean = formatted.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return { numStr: clean || "—", symbol: sym };
}

function CollectionItems({ contract, activeListings }: { contract: string; activeListings: ApiOrder[] }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<CollectionTokensSort>("recent");
  const [allTokens, setAllTokens] = useState<ApiToken[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const { tokens, meta, isLoading, mutate } = useCollectionTokens(contract, page, PAGE_SIZE, sort);
  // SWR deduplicates — the parent also calls this hook; no extra network request.
  const { collection } = useCollection(contract);

  function handleSortChange(next: CollectionTokensSort) {
    setSort(next);
    setPage(1);
    setAllTokens([]);
  }

  // Build tokenId → listing map so Items tab can show Buy buttons for listed tokens
  const listingByTokenId = useMemo(() => {
    const map = new Map<string, ApiOrder>();
    for (const o of activeListings) {
      if (o.nftTokenId) map.set(o.nftTokenId, o);
    }
    return map;
  }, [activeListings]);

  // Ownership + dialogs
  const { address: walletAddress } = useWallet();
  const usdPrices = useUsdPrices();
  const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [transferToken, setTransferToken] = useState<ApiToken | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [cancelToken, setCancelToken] = useState<ApiToken | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const handleList = (token: ApiToken) => { setSelectedToken(token); setListOpen(true); };
  const handleTransfer = (token: ApiToken) => { setTransferToken(token); setTransferOpen(true); };
  const handleCancelRequest = (token: ApiToken) => { setCancelToken(token); setCancelOpen(true); };

  useEffect(() => {
    if (tokens.length > 0) {
      setAllTokens((prev) => {
        const ids = new Set(prev.map((t) => `${t.contractAddress}-${t.tokenId}`));
        const next = tokens.filter((t) => !ids.has(`${t.contractAddress}-${t.tokenId}`));
        return page === 1 ? tokens : [...prev, ...next];
      });
    }
  }, [tokens, page]);

  // Enrich tokens with listing data so listed items show Buy button
  const enrichedTokens = useMemo(() => {
    if (listingByTokenId.size === 0) return allTokens;
    return allTokens.map((t) => {
      const listing = listingByTokenId.get(t.tokenId);
      if (!listing || (t.activeOrders?.length ?? 0) > 0) return t;
      return { ...t, activeOrders: [listing] };
    });
  }, [allTokens, listingByTokenId]);

  const filteredTokens = useMemo(() => {
    const filterEntries = Object.entries(selectedFilters);
    if (filterEntries.length === 0) return enrichedTokens;
    return enrichedTokens.filter((token) => {
      const attrs = Array.isArray(token.metadata?.attributes)
        ? (token.metadata.attributes as { trait_type?: string; value?: string }[])
        : [];
      // AND across trait types, OR within a type's selected values.
      return filterEntries.every(([traitType, values]) =>
        attrs.some((a) => a.trait_type === traitType && values.includes(String(a.value)))
      );
    });
  }, [enrichedTokens, selectedFilters]);

  const hasMore = meta ? allTokens.length < meta.total! : false;

  if (isLoading && allTokens.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => <TokenCardSkeleton key={i} />)}
      </div>
    );
  }

  if (allTokens.length === 0) {
    return (
      <EmptyState
        title="No items yet"
        body="Tokens in this collection will appear here once indexed."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-end gap-2">
          <CollectionFilters
            tokens={allTokens}
            selected={selectedFilters}
            onChange={setSelectedFilters}
            sort={sort}
            onSortChange={handleSortChange}
          />
        </div>
        {filteredTokens.length === 0 && Object.keys(selectedFilters).length > 0 ? (
          <EmptyState
            title="No items match these filters"
            body="Try removing some filters to see more results."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredTokens.map((t) => {
              // ERC-1155 list responses don't include per-holder balances — can't
              // determine ownership here. Holders manage from Portfolio instead.
              const isOwner = collection?.standard === "ERC1155"
                ? false
                : checkIsOwner(t, walletAddress);
              const listingOrder = t.activeOrders?.find((o) => o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155");
              return (
                <TokenCard
                  key={`${t.contractAddress}-${t.tokenId}`}
                  token={t}
                  isOwner={isOwner}
                  usdValue={usdValueFor(listingOrder?.price.formatted, listingOrder?.price.currency, usdPrices)}
                  onList={isOwner ? handleList : undefined}
                  onTransfer={isOwner ? handleTransfer : undefined}
                  onCancel={isOwner ? handleCancelRequest : undefined}
                />
              );
            })}
          </div>
        )}
        <LoadMoreSentinel
          hasMore={hasMore}
          isLoading={isLoading}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      </div>

      {/* Owner dialogs */}
      {selectedToken && (
        <ListingDialog
          open={listOpen}
          onOpenChange={(o) => { setListOpen(o); if (!o) setSelectedToken(null); }}
          assetContract={selectedToken.contractAddress}
          tokenId={selectedToken.tokenId}
          tokenName={selectedToken.metadata?.name ?? undefined}
          tokenImage={selectedToken.metadata?.image ?? null}
          tokenStandard={collection?.standard}
          onSuccess={() => { setListOpen(false); setSelectedToken(null); setPage(1); setAllTokens([]); mutate(); }}
        />
      )}
      {transferToken && (
        <TransferDialog
          open={transferOpen}
          onOpenChange={(o) => { setTransferOpen(o); if (!o) setTransferToken(null); }}
          contractAddress={transferToken.contractAddress}
          tokenId={transferToken.tokenId}
          tokenName={transferToken.metadata?.name ?? undefined}
          tokenImage={transferToken.metadata?.image ?? null}
          tokenStandard={(transferToken.standard ?? collection?.standard) === "ERC1155" ? "ERC1155" : "ERC721"}
          hasActiveListing={!!transferToken.activeOrders?.[0]}
          onSuccess={() => { setTransferOpen(false); setTransferToken(null); setPage(1); setAllTokens([]); mutate(); }}
        />
      )}
      <CancelOrderDialog
        order={cancelToken?.activeOrders?.[0] ?? null}
        open={cancelOpen}
        onOpenChange={(v) => { setCancelOpen(v); if (!v) setCancelToken(null); }}
        onSuccess={() => { setPage(1); setAllTokens([]); mutate(); }}
        variant="listing"
      />

    </>
  );
}

export default function CollectionPageClient() {
  // Served from both /collections/[contract] and /coins/[address] (the
  // friendlier canonical URL for Creator Coins) — accept either param name.
  const params = useParams<{ contract?: string; address?: string }>();
  const contract = params.contract ?? params.address ?? "";
  // Reached via /coins/[address] — the URL intends a coin, so loading shows a
  // coin-shaped skeleton rather than the NFT-collection layout.
  const isCoinRoute = params.address != null;
  const [reportOpen, setReportOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const [descOverflows, setDescOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  const [activeTab, setActiveTab] = useState("assets");
  const [marketSubTab, setMarketSubTab] = useState<"listings" | "offers">("listings");
  const [provenanceSubTab, setProvenanceSubTab] = useState<"activity" | "traits">("activity");
  const [listingsSort, setListingsSort] = useState<OrderSort>("recent");
  const [offersSort, setOffersSort] = useState<OrderSort>("recent");
  const [buyOrder, setBuyOrder] = useState<ApiOrder | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const handleBuy = (o: ApiOrder) => { setBuyOrder(o); setPurchaseOpen(true); };
  const { address: walletAddress } = useWallet();
  const { collection, isLoading: colLoading } = useCollection(isCoinRoute ? null : contract);
  // Coins are their own model now (2026-06-14 split). Resolve via useCoin on the
  // /coins route, or as a fallback for old /collections/[coin] links once we
  // know there's no NFT collection for this address.
  const tryCoin = isCoinRoute || (!colLoading && !collection);
  const { coin, isLoading: coinLoading } = useCoin(tryCoin ? contract : null);
  const { profile } = useCollectionProfile(contract);
  const gatedState = useGatedContent(
    profile?.hasGatedContent ? contract : undefined
  );
  const { orders, isLoading: ordersLoading } = useOrders({
    collection: contract,
    status: "ACTIVE",
    sort: "recent",
    limit: 100,
  });

  const bannerUrl = collection?.image ? ipfsToHttp(collection.image) : null;

  useEffect(() => {
    const el = descRef.current;
    if (!el || !collection?.description) return;
    setDescOverflows(el.scrollHeight > 80);
    setDescClamped(true);
  }, [collection?.description]);

  const activeListings = orders.filter(
    (o) => o.status === "ACTIVE" && (o.offer.itemType === "ERC721" || o.offer.itemType === "ERC1155")
  );
  const activeBids = orders.filter((o) => o.status === "ACTIVE" && o.offer.itemType === "ERC20");

  // Coin dispatch: a fungible coin (Creator Coin / external ERC-20) renders the
  // coin view — price + embedded swap, no per-token grid/listings.
  if (coin) {
    return <CoinPageClient coin={coin} />;
  }
  // Show the coin skeleton while a coin is resolving (the /coins route, or an
  // old /collections/[coin] link) instead of flashing the NFT layout.
  if (tryCoin && coinLoading) {
    return <CoinPageSkeleton />;
  }

  const floorParsed = parsePriceDisplay(collection?.floorPrice);
  const volumeParsed = parsePriceDisplay(collection?.totalVolume);

  const stats = [
    { label: "Items",   display: collection?.totalSupply != null ? String(collection.totalSupply) : "—", symbol: null },
    { label: "Holders", display: collection?.holderCount  != null ? String(collection.holderCount)  : "—", symbol: null },
    { label: "Floor",   display: floorParsed.numStr,  symbol: floorParsed.symbol },
    { label: "Volume",  display: volumeParsed.numStr, symbol: volumeParsed.symbol },
  ].filter((s) => s.label !== "Volume" || s.display !== "—");

  return (
    <div className="relative z-0 min-h-screen">
      {(collection as any)?.isHidden && <HiddenContentBanner />}

      <CollectionHeroBanner
        bannerUrl={bannerUrl}
        loading={colLoading}
        standard={collection?.standard}
        symbol={collection?.symbol}
        name={collection?.name ?? "Unnamed Collection"}
        stats={stats}
      />

      {/* ── Meta section — two columns on large screens: description left,
          contract/share/report top-right; creator chip + owner actions
          get their own row below, stacks on mobile ── */}
      {!colLoading && collection && (
        <div className="px-4 sm:px-6 pt-4 pb-2 space-y-3">
          {/* Owner-only actions, own row (only rendered for the owner — never empty) */}
          {walletAddress && collection.owner && normalizeAddress("STARKNET", collection.owner) === normalizeAddress("STARKNET", walletAddress) && (
            <div className="flex items-center justify-end gap-2">
              {getService(collection.service)?.id === "ip-tickets" && (
                <TicketOwnerActions
                  contractAddress={collection.contractAddress}
                  owner={collection.owner}
                />
              )}
              {getService(collection.service)?.id === "ip-club" && (
                <ClubOwnerActions
                  contractAddress={collection.contractAddress}
                  isOwner
                />
              )}
              {collection.standard === "ERC1155" && getService(collection.service)?.id === "mip-erc1155" && (
                <Link
                  href={`/launchpad/nfteditions/${contract}/mint`}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-brand-purple hover:brightness-110 active:scale-[0.98] transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Mint editions
                </Link>
              )}
              <Link
                href={`/portfolio/collections/${contract}/settings`}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-border hover:bg-muted active:scale-[0.98] transition text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
            </div>
          )}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-6">
            <div className="flex-1 min-w-0 lg:max-w-2xl">
              {collection.description && (
                <>
                  <p
                    ref={descRef}
                    className={cn(
                      "text-sm text-muted-foreground leading-relaxed",
                      descClamped && !descExpanded && "line-clamp-3"
                    )}
                  >
                    {collection.description}
                  </p>
                  {descOverflows && (
                    <button
                      onClick={() => setDescExpanded((e) => !e)}
                      className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    >
                      {descExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <AddressDisplay
                address={collection.contractAddress ?? ""}
                chars={6}
                className="text-xs text-muted-foreground"
              />
              {collection.owner && <CreatorChip address={collection.owner} />}
              <ShareButton
                title={collection.name ?? "Collection"}
                variant="ghost"
                size="icon"
                className="min-h-0 min-w-0 h-auto w-auto p-0 hover:bg-transparent text-muted-foreground/40 hover:text-muted-foreground"
              />
              <button
                onClick={() => setReportOpen(true)}
                title="Report this collection"
                className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Service action slot (POP claim, etc.) */}
          <CollectionServiceAction
            service={collection.service}
            contractAddress={collection.contractAddress}
          />

          <ReportDialog
            target={{
              type: "COLLECTION",
              contract: collection.contractAddress,
              name: collection.name ?? undefined,
            }}
            open={reportOpen}
            onOpenChange={setReportOpen}
          />
        </div>
      )}

      {/* Gated content hero — shown to all visitors when collection has exclusive content */}
      {!colLoading && collection && profile && (
        <GatedContentHero
          profile={profile}
          gatedState={gatedState}
          onViewExclusive={() => setActiveTab("exclusive")}
        />
      )}

      {/* ── Tabs ── */}
      <div className="px-4 sm:px-6 pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="sticky top-0 z-10 pt-3 pb-1">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="assets" className="flex-1 sm:flex-none">
                Assets{collection?.totalSupply ? ` (${collection.totalSupply.toLocaleString()})` : ""}
              </TabsTrigger>
              <TabsTrigger value="market" className="flex-1 sm:flex-none">
                Market{!ordersLoading && (activeListings.length + activeBids.length) > 0 && ` (${activeListings.length + activeBids.length})`}
              </TabsTrigger>
              <TabsTrigger value="provenance" className="flex-1 sm:flex-none">
                Provenance
              </TabsTrigger>
              {profile?.hasGatedContent && (
                <TabsTrigger value="exclusive" className="flex-1 sm:flex-none gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Exclusive
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="assets" className="mt-4">
            <CollectionItems contract={contract} activeListings={activeListings} />
          </TabsContent>

          <TabsContent value="market" className="mt-4">
            <Tabs value={marketSubTab} onValueChange={(v) => setMarketSubTab(v as "listings" | "offers")}>
              <TabsList className="h-9">
                <TabsTrigger value="listings" className="text-xs px-3 py-1">
                  Listings{!ordersLoading && activeListings.length > 0 && ` (${activeListings.length})`}
                </TabsTrigger>
                <TabsTrigger value="offers" className="text-xs px-3 py-1">
                  Offers{!ordersLoading && activeBids.length > 0 && ` (${activeBids.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="listings" className="mt-4">
                {ordersLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
                  </div>
                ) : activeListings.length === 0 ? (
                  <EmptyState
                    title="No active listings"
                    body="When items in this collection are listed for sale, they'll appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <OrderSortControl value={listingsSort} onChange={setListingsSort} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                      {sortOrders(activeListings, listingsSort).map((o) => <ListingCard key={o.orderHash} order={o} onBuy={handleBuy} />)}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="offers" className="mt-4">
                <div className="flex justify-between items-center mb-3">
                  <div />
                  <div className="flex items-center gap-2">
                    {!ordersLoading && activeBids.length > 0 && (
                      <OrderSortControl value={offersSort} onChange={setOffersSort} />
                    )}
                    <MakeOfferPicker contract={contract} />
                  </div>
                </div>
                {ordersLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
                  </div>
                ) : activeBids.length === 0 ? (
                  <EmptyState
                    title="No active offers"
                    body="Make the first offer, or check back when collectors start bidding."
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {sortOrders(activeBids, offersSort).map((o) => <ListingCard key={o.orderHash} order={o} />)}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="provenance" className="mt-4">
            {collection?.standard && (collection.totalSupply ?? 0) > 1 ? (
              <Tabs value={provenanceSubTab} onValueChange={(v) => setProvenanceSubTab(v as "activity" | "traits")}>
                <TabsList className="h-9">
                  <TabsTrigger value="activity" className="text-xs px-3 py-1">Activity</TabsTrigger>
                  <TabsTrigger value="traits" className="text-xs px-3 py-1">Traits</TabsTrigger>
                </TabsList>

                <TabsContent value="activity" className="mt-4">
                  <CollectionActivityTab contract={contract} />
                </TabsContent>

                <TabsContent value="traits" className="mt-4">
                  <CollectionTraitsTab contract={contract} />
                </TabsContent>
              </Tabs>
            ) : (
              <CollectionActivityTab contract={contract} />
            )}
          </TabsContent>

          {profile?.hasGatedContent && (
            <TabsContent value="exclusive" className="mt-4">
              <GatedContentPanel
                state={gatedState}
                onBrowseListings={() => { setMarketSubTab("listings"); setActiveTab("market"); }}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Owner setup checklist — after the items, before the footer */}
      {!colLoading && collection && walletAddress && collection.owner &&
        normalizeAddress("STARKNET", collection.owner) === normalizeAddress("STARKNET", walletAddress) && (
        <>
          <OwnerSetupPanel
            contract={contract}
            profile={profile}
          />
          {collection.collectionId && collection.standard === "ERC721" && (
            <div className="px-4 sm:px-6 -mt-2 mb-4 flex justify-end">
              <TransferCollectionOwnershipDialog
                collectionId={collection.collectionId}
                currentOwner={collection.owner!}
              />
            </div>
          )}
        </>
      )}

      {/* Inline buy for listed items (Listings tab) */}
      {buyOrder && (
        <PurchaseDialog
          order={buyOrder}
          open={purchaseOpen}
          onOpenChange={(open) => { setPurchaseOpen(open); if (!open) setBuyOrder(null); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-20 flex flex-col items-center gap-3 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 max-w-xs">{body}</p>
    </div>
  );
}
