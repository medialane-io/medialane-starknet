"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useToken, useTokenHistory } from "@/hooks/use-tokens";
import { useTokenListings } from "@/hooks/use-orders";
import { useCollection } from "@/hooks/use-collections";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";
import { FloatingCommentsButton } from "@/components/asset/floating-comments-button";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import { ipfsToHttp, checkIsOwner } from "@/lib/utils";
import { LICENSE_TRAIT_TYPES } from "@/types/ip";
import type { IPType } from "@/types/ip";
import { IP_TEMPLATES } from "@/lib/ip-templates";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ApiActivity, ApiOrder } from "@medialane/sdk";
import { CommentsSection } from "@/components/asset/comments-section";
import { useComments } from "@/hooks/use-comments";
import { EXPLORER_URL } from "@/lib/constants";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { useTokenRemixes } from "@/hooks/use-remix-offers";
import { HelpIcon } from "@/components/ui/help-icon";
import { AssetMarketsTab } from "./asset-markets-tab";
import { AssetProvenanceTab } from "./asset-provenance-tab";
import { AssetMarketplacePanel } from "./asset-marketplace-panel";
import { AssetOwnersPanel, AssetLinksRow } from "./asset-side-panels";
import { AssetOverviewContent } from "./asset-overview-content";
import { AssetHeaderBlock, AssetMediaColumn } from "./asset-top-sections";
import { useFullTokenData } from "@/hooks/use-full-token-data";

export function AssetPageStandard() {
  const { contract, tokenId } = useParams<{ contract: string; tokenId: string }>();
  const router = useRouter();
  const { isConnected: isSignedIn, address: walletAddress } = useWallet();
  const { collection } = useCollection(contract);
  const { token, isLoading } = useToken(contract, tokenId);
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

  // Audited IPNft creation record — undefined for external/legacy contracts (hook returns null).
  const { data: fullTokenData } = useFullTokenData({
    ipNftAddress: contract,
    tokenId: tokenId ? (() => { try { return BigInt(tokenId); } catch { return undefined; } })() : undefined,
  });

  // Listings = NFT in offer (ERC721 or ERC1155 — someone selling the token)
  const activeListings = listings.filter(
    (l) => l.status === "ACTIVE" && (l.offer.itemType === "ERC721" || l.offer.itemType === "ERC1155")
  );
  // Bids = ERC20 in offer (someone bidding to buy the NFT)
  const activeBids = listings.filter(
    (l) => l.status === "ACTIVE" && l.offer.itemType === "ERC20"
  );

  const cheapest = [...activeListings].sort((a, b) =>
    BigInt(a.consideration.startAmount) < BigInt(b.consideration.startAmount) ? -1 : 1
  )[0];

  const isOwner = checkIsOwner(token as any, walletAddress);
  const isERC1155 = (token?.standard ?? collection?.standard) === "ERC1155";

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
        <p className="text-muted-foreground mt-2">This token hasn&apos;t been indexed yet.</p>
      </div>
    );
  }

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = ipfsToHttp(token.metadata?.image);
  const description = token.metadata?.description;
  const attributes = Array.isArray(token.metadata?.attributes)
    ? (token.metadata.attributes as { trait_type?: string; value?: string }[])
    : [];

  // Derive active template once — per-type keys avoid cross-type collisions from shared keys.
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

  // Remix / parent detection
  const parentContract = attributes.find((a) => a.trait_type === "Parent Contract")?.value ?? null;
  const parentTokenId = attributes.find((a) => a.trait_type === "Parent Token ID")?.value ?? null;
  const balances = (token as any).balances as { owner: string; amount: string }[] | undefined;

  return (
    <div
      style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}
      className="relative z-0 min-h-screen"
    >
      {(token as any).isHidden && <HiddenContentBanner />}
      {/* Hidden extraction image for dominant color — must be in component tree */}
      {imageUrl && (
        <Image ref={imgRef} src={imageUrl} crossOrigin="anonymous" aria-hidden alt="" width={1} height={1} fetchPriority="high" unoptimized style={{ display: "none" }} />
      )}
      {/* Full-bleed atmospheric background from asset image */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {imageUrl && (
          <Image src={imageUrl} alt="" aria-hidden fill sizes="100vw" className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110" style={{ filter: "blur(60px) saturate(1.5)" }} unoptimized />
        )}
        <div
          className="absolute inset-0"
          style={{ background: dynamicTheme ? `hsl(var(--dynamic-primary) / 0.08)` : "transparent" }}
        />
      </div>

      <div className="container mx-auto px-4 pt-14 space-y-8 pb-8">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <Link href={`/collections/${contract}`} className="hover:text-foreground transition-colors truncate max-w-[140px] shrink-0">
            {collection?.name ?? contract.slice(0, 8) + "…"}
          </Link>
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
              <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-primary/10 to-purple-500/10">
                <span className="text-5xl font-mono text-muted-foreground">#{tokenId}</span>
              </div>
            )}
          />

          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            <AssetHeaderBlock
              name={name}
              description={description}
              ipType={token.metadata?.ipType}
              showMultiEditionBadge={Boolean(isERC1155)}
              parentContract={parentContract}
              parentTokenId={parentTokenId}
              ownerAddress={!isERC1155 ? (balances?.[0]?.owner ?? token.owner ?? null) : null}
            />

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

            {/* ERC-1155 ownership — shown after marketplace buttons */}
            {isERC1155 && balances && balances.length > 0 ? (
              <AssetOwnersPanel balances={balances} maxVisible={5} />
            ) : null}

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
            <TabsTrigger value="markets" className="flex items-center gap-1">
              Markets {(activeListings.length + activeBids.length) > 0 && `(${activeListings.length + activeBids.length})`}
              <HelpIcon content="Active listings for sale and open offers on this asset" side="bottom" />
            </TabsTrigger>
            <TabsTrigger value="provenance" className="flex items-center gap-1">
              Provenance {history.length > 0 && `(${history.length})`}
              <HelpIcon content="Full transfer and sale history recorded onchain — immutable proof of ownership" side="bottom" />
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
            <AssetMarketsTab
              activeListings={activeListings}
              activeBids={activeBids}
              walletAddress={walletAddress ?? undefined}
              isOwner={isOwner}
              isProcessing={isProcessing}
              onBuyClick={setPurchaseOrder}
              onCancelClick={handleCancelClick}
              onAcceptClick={handleAcceptClick}
            />
          </TabsContent>

          <TabsContent value="provenance">
            <AssetProvenanceTab
              history={history as ApiActivity[]}
              contract={contract}
              tokenId={tokenId}
              remixCount={remixCount}
              originalCreator={fullTokenData?.originalCreator}
              registeredAt={fullTokenData?.registeredAt}
            />
          </TabsContent>
        </Tabs>
      </div>

      <FloatingCommentsButton onClick={() => setCommentOpen(true)} commentTotal={commentTotal} />

      <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
        <DialogContent className="w-full max-w-md p-0 overflow-hidden gap-0 flex flex-col max-h-[85svh]">
          <div className="flex items-center gap-3 pr-10 pl-4 pt-4 pb-3 shrink-0 border-b border-brand-blue/20" style={{ background: "linear-gradient(135deg, hsl(var(--brand-blue) / 0.10), hsl(var(--brand-purple) / 0.08))" }}>
            <div className="relative h-9 w-9 rounded-full overflow-hidden shrink-0 ring-2 ring-white/20" style={{ background: "linear-gradient(135deg, hsl(var(--brand-blue) / 0.3), hsl(var(--brand-purple) / 0.3))" }}>
              {imageUrl && <Image src={imageUrl} alt={name} fill className="object-cover" unoptimized />}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle asChild>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "hsl(var(--brand-blue))" }}>Comments</p>
              </DialogTitle>
              <p className="text-sm font-semibold truncate text-foreground">{name}</p>
            </div>
            {commentTotal > 0 && (
              <span className="shrink-0 text-xs font-bold rounded-full px-2 py-0.5 text-white" style={{ background: "hsl(var(--brand-blue))" }}>
                {commentTotal}
              </span>
            )}
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
