"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { useCollection, useCollectionTokens } from "@/hooks/use-collections";
import { useOrders } from "@/hooks/use-orders";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { ListingCard, ListingCardSkeleton } from "@/components/marketplace/listing-card";
import { TokenCard, TokenCardSkeleton } from "@/components/shared/token-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressDisplay } from "@/components/shared/address-display";
import { Loader2, Flag, Inbox, Sparkles, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportDialog } from "@/components/report-dialog";
import { useCollectionProfile } from "@/hooks/use-profiles";
import { useGatedContent } from "@/hooks/use-gated-content";
import { GatedContentHero } from "@/components/collection/gated-content-hero";
import { GatedContentPanel } from "@/components/collection/gated-content-panel";
import { OwnerSetupPanel } from "@/components/collection/owner-setup-panel";
import { TransferCollectionOwnershipDialog } from "@/components/collection/transfer-ownership-dialog";
import { AssetPreviewDialog } from "@/components/shared/asset-preview-dialog";
import { ShareButton } from "@/components/shared/share-button";
import { TraitFilter } from "@/components/collection/trait-filter";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import Image from "next/image";
import { ipfsToHttp, formatDisplayPrice, cn, checkIsOwner } from "@/lib/utils";
import { computeRarity } from "@/lib/rarity";
import { CollectionServiceAction } from "@/components/services/collection-service-action";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";
import { useWallet } from "@/hooks/use-wallet";
import { getService } from "@medialane/sdk";
import type { ApiToken, ApiOrder } from "@medialane/sdk";
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
  if (!src) return <span className="text-xs font-semibold text-white/70">{symbol}</span>;
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
  const [allTokens, setAllTokens] = useState<ApiToken[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({});
  const { tokens, meta, isLoading, mutate } = useCollectionTokens(contract, page, PAGE_SIZE);
  // SWR deduplicates — the parent also calls this hook; no extra network request.
  const { collection } = useCollection(contract);

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

  const [previewToken, setPreviewToken] = useState<ApiToken | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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
      return filterEntries.every(([traitType, value]) =>
        attrs.some((a) => a.trait_type === traitType && String(a.value) === value)
      );
    });
  }, [enrichedTokens, selectedFilters]);

  const rarityMap = useMemo(() => computeRarity(allTokens), [allTokens]);
  const hasMore = meta ? allTokens.length < meta.total! : false;

  if (isLoading && allTokens.length === 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
        <TraitFilter
          tokens={allTokens}
          selected={selectedFilters}
          onChange={setSelectedFilters}
        />
        {filteredTokens.length === 0 && Object.keys(selectedFilters).length > 0 ? (
          <EmptyState
            title="No items match these filters"
            body="Try removing some filters to see more results."
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredTokens.map((t) => {
              // ERC-1155 list responses don't include per-holder balances — can't
              // determine ownership here. Holders manage from Portfolio instead.
              const isOwner = collection?.standard === "ERC1155"
                ? false
                : checkIsOwner(t, walletAddress);
              return (
                <div
                  key={`${t.contractAddress}-${t.tokenId}`}
                  className="cursor-pointer"
                  onClick={() => { setPreviewToken(t); setPreviewOpen(true); }}
                >
                  <TokenCard
                    token={t}
                    rarityTier={rarityMap.get(t.tokenId)?.tier}
                    isOwner={isOwner}
                    onList={isOwner ? handleList : undefined}
                    onTransfer={isOwner ? handleTransfer : undefined}
                    onCancel={isOwner ? handleCancelRequest : undefined}
                  />
                </div>
              );
            })}
          </div>
        )}
        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
      </div>

      {/* Owner dialogs */}
      {selectedToken && (
        <ListingDialog
          open={listOpen}
          onOpenChange={(o) => { setListOpen(o); if (!o) setSelectedToken(null); }}
          assetContract={selectedToken.contractAddress}
          tokenId={selectedToken.tokenId}
          tokenName={selectedToken.metadata?.name ?? undefined}
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

      {previewToken && (
        <AssetPreviewDialog
          token={previewToken}
          service={collection?.service}
          isOwner={checkIsOwner(previewToken, walletAddress)}
          open={previewOpen}
          onOpenChange={(o) => { setPreviewOpen(o); if (!o) setPreviewToken(null); }}
          onList={(tok) => { setPreviewOpen(false); handleList(tok); }}
          onCancel={(tok) => { setPreviewOpen(false); handleCancelRequest(tok); }}
          onTransfer={(tok) => { setPreviewOpen(false); handleTransfer(tok); }}
        />
      )}
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
  const { address: walletAddress } = useWallet();
  const { collection, isLoading: colLoading } = useCollection(contract);
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

  // Registry dispatch: Creator Coins (and external ERC-20s) get the coin view —
  // an ERC-20 has no per-token grid/listings, just a price + embedded swap.
  if (!colLoading && collection && getService(collection.service)?.uiVariant === "coin") {
    return <CoinPageClient collection={collection} />;
  }
  // On the /coins route, show the coin skeleton while loading instead of
  // flashing the NFT-collection layout before the dispatch resolves.
  if (colLoading && isCoinRoute) {
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
        <Skeleton className="w-full h-48 sm:aspect-video" />
      ) : (
        <div className="relative w-full overflow-hidden h-[80svh] sm:h-auto sm:aspect-video">
          <ParallaxBanner imageUrl={bannerUrl} contract={contract} />

          {/* Bottom overlay: title + stat chips */}
          <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 pb-4 sm:pb-6 space-y-2.5 z-10">
            <div>
              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold text-white leading-tight"
                style={{ textShadow: "0 2px 20px rgba(0,0,0,0.7)" }}>
                {collection?.name ?? "Unnamed Collection"}
              </h1>
              {collection?.symbol && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="font-mono text-[11px] bg-black/20 dark:bg-black/40 text-white/90 border border-white/15 backdrop-blur-sm rounded-full px-2.5 py-0.5">
                    {collection.symbol}
                  </span>
                </div>
              )}
            </div>

            {/* Stat chips — currency-aware for floor/volume */}
            <div className="flex gap-2 flex-wrap">
              {stats.map(({ label, display, symbol }) => (
                <div
                  key={label}
                  className={cn(
                    "bg-black/25 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 flex flex-col justify-center shrink-0",
                    symbol ? "min-w-[88px]" : "min-w-[60px] items-center text-center"
                  )}
                >
                  <p className="text-[9px] text-white/50 uppercase tracking-widest mb-1">{label}</p>
                  {symbol ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <CurrencyIcon symbol={symbol} size={14} />
                        <p className="text-sm sm:text-base font-bold text-white tabular-nums leading-tight truncate">
                          {display}
                        </p>
                      </div>
                      <p className="text-[9px] text-white/40 mt-0.5 leading-none">{symbol}</p>
                    </>
                  ) : (
                    <p className="text-base sm:text-lg font-bold text-white tabular-nums leading-tight">
                      {display}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Meta section ── */}
      {!colLoading && collection && (
        <div className="px-4 sm:px-6 pt-4 pb-2 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            {collection.owner && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>by</span>
                <Link href={`/creator/${collection.owner}`} className="hover:underline underline-offset-2">
                  <AddressDisplay
                    address={collection.owner}
                    chars={6}
                    showCopy={false}
                    className="font-medium text-foreground"
                  />
                </Link>
              </div>
            )}
            {/* Mint button — only for ERC-1155 collection owner */}
            {collection.standard === "ERC1155" &&
              walletAddress &&
              collection.owner?.toLowerCase() === walletAddress.toLowerCase() && (
              <Link
                href={`/launchpad/nfteditions/${contract}/mint`}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-white bg-fuchsia-600 hover:bg-fuchsia-700 transition-colors"
              >
                <Sparkles className="h-3 w-3" />
                Mint editions
              </Link>
            )}
          </div>

          {collection.description && (
            <>
              <p
                ref={descRef}
                className={cn(
                  "text-sm text-muted-foreground max-w-2xl leading-relaxed",
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

          <div className="flex items-center gap-2 pt-0.5">
            <AddressDisplay
              address={collection.contractAddress ?? ""}
              chars={6}
              className="text-xs text-muted-foreground/70"
            />
            <ShareButton title={collection.name ?? "Collection"} variant="ghost" size="icon" />
            <button
              onClick={() => setReportOpen(true)}
              title="Report this collection"
              className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : activeListings.length === 0 ? (
              <EmptyState
                title="No active listings"
                body="When items in this collection are listed for sale, they'll appear here."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {activeListings.map((o) => <ListingCard key={o.orderHash} order={o} />)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="offers" className="mt-4">
            {ordersLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
              </div>
            ) : activeBids.length === 0 ? (
              <EmptyState
                title="No active offers"
                body="Collection-wide offers will appear here when placed."
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
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
