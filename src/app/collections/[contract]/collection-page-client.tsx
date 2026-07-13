"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useCollection, useCollectionTokens } from "@/hooks/use-collections";
import { useCoin } from "@/hooks/use-coins";
import { useOrders } from "@/hooks/use-orders";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { TokenCard, TokenCardSkeleton } from "@/components/shared/token-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressDisplay } from "@/components/shared/address-display";
import { Flag, Inbox, Sparkles, Lock, Settings } from "lucide-react";
import { LoadMoreSentinel } from "@medialane/ui";
import { ReportDialog } from "@/components/report-dialog";
import { useCollectionProfile } from "@/hooks/use-profiles";
import { useGatedContent } from "@/hooks/use-gated-content";
import { GatedContentHero } from "@/components/collection/gated-content-hero";
import { GatedContentPanel } from "@/components/collection/gated-content-panel";
import { OwnerSetupPanel } from "@/components/collection/owner-setup-panel";
import { TransferCollectionOwnershipDialog } from "@/components/collection/transfer-ownership-dialog";
import { ShareButton } from "@/components/shared/share-button";
import { CollectionFilters } from "@/components/collection/collection-filters";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import Image from "next/image";
import { ipfsToHttp, formatDisplayPrice, cn, checkIsOwner } from "@/lib/utils";
import { CollectionServiceAction } from "@/components/services/collection-service-action";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";
import { useWallet } from "@/hooks/use-wallet";
import { CreatorScoreInline } from "@/components/rewards/creator-score-inline";
import { getService } from "@medialane/sdk";
import type { ApiToken, ApiOrder, CollectionTokensSort } from "@medialane/sdk";
import { CoinPageClient, CoinPageSkeleton } from "./coin-page-client";

const PAGE_SIZE = 24;

const CURRENCY_ICONS: Record<string, string> = {
  STRK: "/strk.svg",
  ETH: "/eth.svg",
  USDC: "/usdc.svg",
  USDT: "/usdt.svg",
  WBTC: "/btc.svg",
};

function CurrencyIcon({ symbol, size = 16 }: { symbol: string; size?: number }) {
  const src = CURRENCY_ICONS[symbol?.toUpperCase()];
  if (!src) return <span className="text-xs font-semibold text-muted-foreground">{symbol}</span>;
  return <Image src={src} alt={symbol} width={size} height={size} className="inline-block shrink-0" />;
}

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
      <div className="space-y-4">
        <CollectionFilters
          tokens={allTokens}
          selected={selectedFilters}
          onChange={setSelectedFilters}
          sort={sort}
          onSortChange={handleSortChange}
        />
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
              return (
                <TokenCard
                  key={`${t.contractAddress}-${t.tokenId}`}
                  token={t}
                  isOwner={isOwner}
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

  const [activeTab, setActiveTab] = useState("items");
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
  const { imgRef, dynamicTheme } = useDominantColor(bannerUrl);

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
  ];

  return (
    <div
      style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}
      className="relative z-0 min-h-screen"
    >
      {/* Atmospheric blur background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {bannerUrl && (
          <Image
            src={bannerUrl}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110"
            style={{ filter: "blur(60px) saturate(1.5)" }}
            unoptimized
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: dynamicTheme
              ? `hsl(var(--dynamic-primary) / 0.08)`
              : "transparent",
          }}
        />
      </div>

      {(collection as any)?.isHidden && <HiddenContentBanner />}

      {/* Hidden extraction img for dominant color */}
      {bannerUrl && (
        <Image
          ref={imgRef}
          src={bannerUrl}
          crossOrigin="anonymous"
          aria-hidden
          alt=""
          width={1}
          height={1}
          unoptimized
          style={{ display: "none" }}
        />
      )}

      {/* ── Full-bleed hero banner ── */}
      {colLoading ? (
        <Skeleton className="w-full h-[50svh]" />
      ) : (
        <div className="relative w-full overflow-hidden h-[50svh]">
          <ParallaxBanner imageUrl={bannerUrl} contract={contract} />

          {/* Bottom overlay: title + stat chips — backdrop blur only, no borders, no scrim */}
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 sm:pb-6 space-y-3 z-10">
            <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight"
              style={{ textShadow: "0 1px 12px rgba(0,0,0,0.4)" }}>
              {collection?.name ?? "Unnamed Collection"}
            </h1>

            {/* Stat chips — theme-aware frosted glass (light in light, dark in dark);
                Floor/Volume show the currency icon only */}
            <div className="flex gap-2 flex-wrap">
              {stats.map(({ label, display, symbol }) => (
                <div
                  key={label}
                  className={cn(
                    "bg-background/75 backdrop-blur-md rounded-xl px-3 py-2 flex flex-col justify-center shrink-0",
                    symbol ? "min-w-[80px]" : "min-w-[60px] items-center text-center"
                  )}
                >
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
                  {symbol ? (
                    <div className="flex items-center gap-1.5">
                      <CurrencyIcon symbol={symbol} size={15} />
                      <p className="text-sm sm:text-base font-bold text-foreground tabular-nums leading-tight truncate">
                        {display}
                      </p>
                    </div>
                  ) : (
                    <p className="text-base sm:text-lg font-bold text-foreground tabular-nums leading-tight">
                      {display}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Meta section — flat layout (no boxed panel); identity on the left,
          a lightweight right-aligned utility cluster fills the width ── */}
      {!colLoading && collection && (
        <div className="px-4 sm:px-6 pt-5 pb-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
            {/* Left — identity & description */}
            <div className="space-y-3 min-w-0 lg:max-w-2xl">
              {/* Type + symbol badges (moved down out of the hero) */}
              {(collection.symbol || collection.standard) && (
                <div className="flex items-center gap-2 flex-wrap">
                  {collection.standard === "ERC1155" ? (
                    <span className="text-[11px] font-semibold bg-brand-purple/15 text-brand-purple dark:text-brand-purple rounded-full px-2.5 py-0.5">
                      Multi-edition NFT
                    </span>
                  ) : collection.standard === "ERC721" ? (
                    <span className="text-[11px] font-semibold bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">
                      Single NFT
                    </span>
                  ) : null}
                  {collection.symbol && (
                    <span className="tabular-nums text-[11px] bg-muted text-muted-foreground rounded-full px-2.5 py-0.5">
                      {collection.symbol}
                    </span>
                  )}
                </div>
              )}

              {/* By owner — address route (/creator/[slug] is username-only) */}
              {collection.owner && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>by</span>
                  <Link href={`/account/${collection.owner}`} className="hover:underline underline-offset-2">
                    <AddressDisplay
                      address={collection.owner}
                      chars={6}
                      showCopy={false}
                      className="font-medium text-foreground"
                    />
                  </Link>
                  <CreatorScoreInline address={collection.owner} size="sm" />
                </div>
              )}

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

              {/* Service action slot (POP claim, etc.) */}
              <CollectionServiceAction
                service={collection.service}
                contractAddress={collection.contractAddress}
              />
            </div>

            {/* Right — flat utility cluster (no panel/chrome) */}
            <div className="flex flex-col gap-2.5 shrink-0 lg:items-end">
              {walletAddress && collection.owner?.toLowerCase() === walletAddress.toLowerCase() && (
                <div className="flex items-center gap-2">
                  {collection.standard === "ERC1155" && (
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

              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground/50">Contract</span>
                <AddressDisplay
                  address={collection.contractAddress ?? ""}
                  chars={6}
                  className="text-xs text-muted-foreground"
                />
                <ShareButton title={collection.name ?? "Collection"} variant="ghost" size="icon" />
                <button
                  onClick={() => setReportOpen(true)}
                  title="Report this collection"
                  className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

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

      {/* Owner setup checklist — shown only to the collection owner */}
      {!colLoading && collection && walletAddress &&
        collection.owner?.toLowerCase() === walletAddress.toLowerCase() && (
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

      {/* ── Tabs ── */}
      <div className="px-4 sm:px-6 pb-12">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="sticky top-0 z-10 pt-3 pb-1">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="items" className="flex-1 sm:flex-none">
                Items{collection?.totalSupply ? ` (${collection.totalSupply.toLocaleString()})` : ""}
              </TabsTrigger>
              <TabsTrigger value="listings" className="flex-1 sm:flex-none">
                Listings{!ordersLoading && activeListings.length > 0 && ` (${activeListings.length})`}
              </TabsTrigger>
              <TabsTrigger value="offers" className="flex-1 sm:flex-none">
                Offers{!ordersLoading && activeBids.length > 0 && ` (${activeBids.length})`}
              </TabsTrigger>
              {profile?.hasGatedContent && (
                <TabsTrigger value="exclusive" className="flex-1 sm:flex-none gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Exclusive
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="items" className="mt-4">
            <CollectionItems contract={contract} activeListings={activeListings} />
          </TabsContent>

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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {activeListings.map((o) => <ListingCard key={o.orderHash} order={o} onBuy={handleBuy} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="offers" className="mt-4">
            {ordersLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : activeBids.length === 0 ? (
              <EmptyState
                title="No active offers"
                body="Collection-wide offers will appear here when placed."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                {activeBids.map((o) => <ListingCard key={o.orderHash} order={o} />)}
              </div>
            )}
          </TabsContent>

          {profile?.hasGatedContent && (
            <TabsContent value="exclusive" className="mt-4">
              <GatedContentPanel
                state={gatedState}
                onBrowseListings={() => setActiveTab("listings")}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

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

function ParallaxBanner({ imageUrl, contract }: { imageUrl: string | null; contract: string }) {
  const { scrollY } = useScroll();
  const shouldReduce = useReducedMotion();
  const y = useTransform(scrollY, [0, 500], [0, shouldReduce ? 0 : 150]);

  if (!imageUrl) {
    const hex = contract.replace(/^0x/i, "");
    const a = `#${hex.slice(-6, -3).padStart(6, "a")}`;
    const b = `#${hex.slice(-3).padStart(6, "5")}`;
    return (
      <div
        className="absolute inset-0 w-full h-full"
        style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      />
    );
  }

  return (
    <motion.img
      src={imageUrl}
      alt=""
      aria-hidden
      style={{ y }}
      className="absolute inset-0 w-full h-full object-cover scale-110"
    />
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-20 flex flex-col items-center gap-3 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/70 max-w-xs">{body}</p>
    </div>
  );
}
