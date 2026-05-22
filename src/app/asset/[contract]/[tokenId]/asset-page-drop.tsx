"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Package, ChevronRight, DollarSign, Shield, Calendar } from "lucide-react";
import { useToken, useTokenHistory } from "@/hooks/use-tokens";
import { useCollection } from "@/hooks/use-collections";
import { useDropInfo, getDropStatus } from "@/hooks/use-drops";
import type { DropConditions } from "@/hooks/use-drops";
import { useTokenListings } from "@/hooks/use-orders";
import { useWallet } from "@/hooks/use-wallet";
import { useComments } from "@/hooks/use-comments";
import { useTokenRemixes } from "@/hooks/use-remix-offers";
import { ipfsToHttp, checkIsOwner, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { IpTypeBadge } from "@/components/shared/ip-type-badge";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";
import { FloatingCommentsButton } from "@/components/asset/floating-comments-button";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { ParentAttributionBanner } from "@/components/asset/remixes-tab";
import { EXPLORER_URL } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CommentsSection } from "@/components/asset/comments-section";
import { AssetMarketsTab } from "./asset-markets-tab";
import { AssetProvenanceTab } from "./asset-provenance-tab";
import { AssetMarketplacePanel } from "./asset-marketplace-panel";
import { AssetLinksRow } from "./asset-side-panels";
import { AssetOverviewContent } from "./asset-overview-content";
import { AssetMediaColumn } from "./asset-top-sections";
import { LICENSE_TRAIT_TYPES } from "@/types/ip";
import type { IPType } from "@/types/ip";
import { IP_TEMPLATES } from "@/lib/ip-templates";
import { getListableTokens } from "@medialane/sdk";
import type { ApiActivity, ApiOrder } from "@medialane/sdk";
import { useMarketplace } from "@/hooks/use-marketplace";
import { CollectionDropMintButton } from "@/components/claim/collection-drop-mint-button";

function getTokenByAddress(address: string) {
  return getListableTokens().find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? null;
}

function DropStatusBadge({ status }: { status: ReturnType<typeof getDropStatus> }) {
  const map = {
    live:     { label: "Live",     cls: "text-green-400 bg-green-500/10 border-green-500/20", dot: true  },
    upcoming: { label: "Upcoming", cls: "text-blue-400 bg-blue-500/10 border-blue-500/20",   dot: false },
    ended:    { label: "Ended",    cls: "text-muted-foreground bg-muted border-border",       dot: false },
    sold_out: { label: "Sold out", cls: "text-orange-400 bg-orange-500/10 border-orange-500/20", dot: false },
  } as const;
  const { label, cls, dot } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full px-2.5 py-1 border", cls)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />}
      {label}
    </span>
  );
}

function SupplyProgress({ minted, max }: { minted: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (minted / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{minted.toLocaleString()} minted</span>
        <span>of {max.toLocaleString()}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% minted</p>
    </div>
  );
}

function DropInfoPanel({
  conditions,
  totalMinted,
  contract,
}: {
  conditions: DropConditions | null;
  totalMinted: number;
  contract: string;
}) {
  if (!conditions) return null;
  const status = getDropStatus(conditions, totalMinted);
  const maxSupply = parseInt(conditions.maxSupply, 10);
  const formatTs = (ts: number) =>
    new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const priceToken =
    conditions.price !== "0" && conditions.paymentToken !== "0x0"
      ? getTokenByAddress(conditions.paymentToken)
      : null;
  const priceNum = priceToken
    ? Number(BigInt(conditions.price) * 10000n / BigInt(10 ** priceToken.decimals)) / 10000
    : null;

  return (
    <div className="rounded-xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-orange-500" />
        <p className="text-sm font-semibold">Drop</p>
        <DropStatusBadge status={status} />
      </div>
      {maxSupply > 0 && <SupplyProgress minted={totalMinted} max={maxSupply} />}
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 shrink-0" />
          {priceNum !== null ? `${priceNum} ${priceToken?.symbol}` : "Free mint"}
        </div>
        {conditions.maxPerWallet !== "0" && (
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            Max {conditions.maxPerWallet} per wallet
          </div>
        )}
        <div className="flex items-center gap-1.5 col-span-2">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formatTs(conditions.startTime)} → {formatTs(conditions.endTime)}
        </div>
      </div>
      <CollectionDropMintButton collectionAddress={contract} conditions={conditions} />
    </div>
  );
}

export function AssetPageDrop() {
  const { contract, tokenId } = useParams<{ contract: string; tokenId: string }>();
  const router = useRouter();
  const { isConnected: isSignedIn, address: walletAddress } = useWallet();
  const { collection } = useCollection(contract);
  const { token, isLoading } = useToken(contract, tokenId);
  const { dropInfo } = useDropInfo(contract);
  const { listings, mutate: mutateListings } = useTokenListings(contract, tokenId);
  const { history } = useTokenHistory(contract, tokenId);
  const { acceptOffer, isProcessing } = useMarketplace();

  const shouldReduce = useReducedMotion();

  const imageUrl = token?.metadata?.image ? ipfsToHttp(token.metadata.image) : null;
  const { imgRef, dynamicTheme } = useDominantColor(imageUrl);

  const [imgError, setImgError] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState<ApiOrder | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<ApiOrder | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);

  const { total: commentTotal } = useComments(contract, tokenId);
  const { total: remixCount } = useTokenRemixes(contract, tokenId);

  const activeListings = listings.filter(
    (l) => l.status === "ACTIVE" && (l.offer.itemType === "ERC721" || l.offer.itemType === "ERC1155")
  );
  const activeBids = listings.filter(
    (l) => l.status === "ACTIVE" && l.offer.itemType === "ERC20"
  );

  const cheapest = [...activeListings].sort((a, b) =>
    BigInt(a.consideration.startAmount) < BigInt(b.consideration.startAmount) ? -1 : 1
  )[0];

  const isOwner = checkIsOwner(token as any, walletAddress);
  const isERC1155 = collection?.standard === "ERC1155";

  const myListing = isOwner
    ? activeListings.find((l) => l.offerer.toLowerCase() === walletAddress!.toLowerCase()) ?? null
    : null;

  const handleCancelClick = (order: ApiOrder) => {
    setOrderToCancel(order);
    setCancelOpen(true);
  };

  const handleAcceptClick = async (order: ApiOrder) => {
    await acceptOffer(order.orderHash, contract, tokenId, order.consideration.itemType);
    mutateListings();
  };

  const handleAutoRemix = () => {
    router.push(`/create/remix/${contract}/${tokenId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 pt-14 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] lg:gap-10 gap-8">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-2xl font-bold">Asset not found</p>
      </div>
    );
  }

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = ipfsToHttp(token.metadata?.image);
  const description = token.metadata?.description;
  const attributes = Array.isArray(token.metadata?.attributes)
    ? (token.metadata.attributes as { trait_type?: string; value?: string }[])
    : [];

  const activeTemplate = IP_TEMPLATES[
    (attributes.find((a) => a.trait_type?.toLowerCase() === "ip type")?.value ?? "") as IPType
  ];
  const activeTemplateKeys = new Set<string>([
    "IP Type",
    ...(activeTemplate?.fields.map((f) => f.key) ?? []),
  ]);
  const hasTemplateData =
    !!activeTemplate &&
    activeTemplate.fields.length > 0 &&
    activeTemplate.fields.some((f) =>
      attributes.some((a) => a.trait_type === f.key && a.value)
    );
  const isDisplayAttr = (a: { trait_type?: string }): boolean =>
    !LICENSE_TRAIT_TYPES.has(a.trait_type ?? "") && !activeTemplateKeys.has(a.trait_type ?? "");

  const parentContract = attributes.find((a) => a.trait_type === "Parent Contract")?.value ?? null;
  const parentTokenId = attributes.find((a) => a.trait_type === "Parent Token ID")?.value ?? null;
  const totalMinted = collection?.totalSupply ?? 0;

  return (
    <div
      style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}
      className="relative z-0 min-h-screen"
    >
      {(token as any).isHidden && <HiddenContentBanner />}
      {imageUrl && (
        <Image ref={imgRef} src={imageUrl} crossOrigin="anonymous" aria-hidden alt="" width={1} height={1} fetchPriority="high" unoptimized style={{ display: "none" }} />
      )}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {imageUrl && (
          <Image src={imageUrl} alt="" aria-hidden fill sizes="100vw" className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110" style={{ filter: "blur(60px) saturate(1.5)" }} unoptimized />
        )}
      </div>

      <div className="container mx-auto px-4 pt-14 space-y-8 pb-8">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <Link href="/launchpad/drop" className="hover:text-foreground transition-colors shrink-0">Collection Drop</Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium truncate">{name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] lg:gap-10 gap-8 items-start">
          <AssetMediaColumn
            shouldReduce={Boolean(shouldReduce)}
            image={image}
            imageAlt={name}
            imgError={imgError}
            onImageError={() => setImgError(true)}
            fallback={(
              <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-amber-600/10">
                <Package className="h-20 w-20 text-orange-500/30" />
              </div>
            )}
          />

          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            <div>
              {parentContract && parentTokenId && (
                <div className="mb-3">
                  <ParentAttributionBanner parentContract={parentContract} parentTokenId={parentTokenId} parentName={`Token #${parentTokenId}`} />
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {token.metadata?.ipType && <IpTypeBadge ipType={token.metadata.ipType} size="md" />}
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-500">
                  <Package className="h-3 w-3" />
                  Collection Drop
                </span>
              </div>
              <h1 className="text-3xl lg:text-5xl font-bold">{name}</h1>
              {description && <p className="text-sm text-muted-foreground leading-relaxed mt-1">{description}</p>}
            </div>

            {dropInfo?.conditions && (
              <DropInfoPanel conditions={dropInfo.conditions} totalMinted={totalMinted} contract={contract} />
            )}

            <AssetMarketplacePanel
              cheapest={cheapest}
              isOwner={isOwner}
              isSignedIn={isSignedIn}
              isProcessing={isProcessing}
              isERC1155={isERC1155}
              myListing={myListing}
              activeBids={activeBids}
              walletAddress={walletAddress}
              remixEnabled
              onCancelClick={handleCancelClick}
              onAcceptBid={handleAcceptClick}
              onOpenListing={() => setListOpen(true)}
              onOpenTransfer={() => setTransferOpen(true)}
              onOpenPurchase={setPurchaseOrder}
              onOpenOffer={() => setOfferOpen(true)}
              onOpenRemix={handleAutoRemix}
            />

            <AssetLinksRow
              contractHref={`${EXPLORER_URL}/contract/${token.contractAddress}`}
              collectionHref={`/collections/${token.contractAddress}`}
              collection={collection}
              shareTitle={name}
              reportTarget={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name }}
              reportOpen={reportOpen}
              onReportOpenChange={setReportOpen}
            />
          </motion.div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="markets">
              Markets {(activeListings.length + activeBids.length) > 0 && `(${activeListings.length + activeBids.length})`}
            </TabsTrigger>
            <TabsTrigger value="provenance">
              Provenance {history.length > 0 && `(${history.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AssetOverviewContent
              attributes={attributes}
              hasTemplateData={hasTemplateData}
              isDisplayAttr={isDisplayAttr}
            />
          </TabsContent>

          <TabsContent value="markets">
            <AssetMarketsTab activeListings={activeListings} activeBids={activeBids} walletAddress={walletAddress ?? undefined} isOwner={isOwner} isProcessing={isProcessing} onBuyClick={setPurchaseOrder} onCancelClick={handleCancelClick} onAcceptClick={handleAcceptClick} />
          </TabsContent>

          <TabsContent value="provenance">
            <AssetProvenanceTab history={history as ApiActivity[]} contract={contract} tokenId={tokenId} remixCount={remixCount} />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingCommentsButton onClick={() => setCommentOpen(true)} commentTotal={commentTotal} />

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent className="w-full max-w-md p-0 overflow-hidden gap-0 flex flex-col max-h-[85svh]">
          <div className="flex items-center gap-3 pr-10 pl-4 pt-4 pb-3 shrink-0 border-b border-orange-500/20" style={{ background: "linear-gradient(135deg, hsl(var(--brand-orange) / 0.10), hsl(var(--brand-purple) / 0.08))" }}>
            <div className="relative h-9 w-9 rounded-full overflow-hidden shrink-0 ring-2 ring-white/20 bg-orange-500/20">
              {imageUrl && <Image src={imageUrl} alt={name} fill className="object-cover" unoptimized />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle asChild>
                <p className="text-[10px] font-medium uppercase tracking-wider text-orange-400">Comments</p>
              </DialogTitle>
              <p className="text-sm font-semibold truncate text-foreground">{name}</p>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <CommentsSection contract={contract} tokenId={tokenId} className="h-full rounded-none border-0" />
          </div>
        </DialogContent>
      </Dialog>

      {purchaseOrder && (
        <PurchaseDialog order={purchaseOrder} open onOpenChange={(v) => { if (!v) setPurchaseOrder(null); }} onSuccess={mutateListings} />
      )}
      <ListingDialog open={listOpen} onOpenChange={setListOpen} assetContract={contract} tokenId={tokenId} tokenName={name} tokenStandard={collection?.standard} onSuccess={mutateListings} />
      <OfferDialog open={offerOpen} onOpenChange={setOfferOpen} assetContract={contract} tokenId={tokenId} tokenName={name} tokenStandard={collection?.standard} />
      <CancelOrderDialog order={orderToCancel} open={cancelOpen} onOpenChange={(v) => { setCancelOpen(v); if (!v) setOrderToCancel(null); }} onSuccess={mutateListings} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} contractAddress={contract} tokenId={tokenId} tokenName={name} hasActiveListing={activeListings.length > 0} onSuccess={mutateListings} />
    </div>
  );
}
