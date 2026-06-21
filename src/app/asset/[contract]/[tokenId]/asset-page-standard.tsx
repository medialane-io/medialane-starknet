"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToken, useTokenHistory } from "@/hooks/use-tokens";
import { useTokenListings } from "@/hooks/use-orders";
import { useCollection, useCollectionTokens } from "@/hooks/use-collections";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingCommentsButton } from "@/components/asset/floating-comments-button";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import { ipfsToHttp } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiActivity, ApiOrder } from "@medialane/sdk";
import { getService } from "@medialane/sdk";
import { resolveRemixPolicy, getDerivativesTerm } from "@/lib/remix-policy";
import { useComments } from "@/hooks/use-comments";
import { EXPLORER_URL } from "@/lib/constants";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { useTokenRemixes } from "@/hooks/use-remix-offers";
import { AssetMarketsTab } from "./asset-markets-tab";
import { AssetProvenanceTab } from "./asset-provenance-tab";
import { AssetMarketplacePanel } from "./asset-marketplace-panel";
import { AssetOwnersPanel, AssetLinksRow, AssetCommentsDialog } from "./asset-side-panels";
import { AssetOverviewContent } from "./asset-overview-content";
import { AssetHeaderBlock } from "./asset-top-sections";
import { AssetMediaColumn } from "@/components/asset/asset-media-column";
import { AssetLightbox } from "@/components/asset/asset-lightbox";
import { AssetAtmosphere, useAssetMarketState, type AssetToken } from "./asset-shared";
import { useAssetMarketplaceDialogState, AssetMarketplaceDialogs } from "./asset-marketplace-dialogs";
import { useFullTokenData } from "@/hooks/use-full-token-data";

export function AssetPageStandard() {
  const { contract, tokenId } = useParams<{ contract: string; tokenId: string }>();
  const router = useRouter();
  const { isConnected: isSignedIn, address: walletAddress } = useWallet();
  const { collection } = useCollection(contract);
  const { token: rawToken, isLoading } = useToken(contract, tokenId);
  const token = rawToken as AssetToken | null;
  const { listings, mutate: mutateListings, isLoading: listingsLoading } = useTokenListings(contract, tokenId);
  const { history } = useTokenHistory(contract, tokenId);
  const { acceptOffer, isProcessing } = useMarketplace();
  const shouldReduce = useReducedMotion();

  const imageUrl = token?.metadata?.image ? ipfsToHttp(token.metadata.image) : null;
  const { imgRef, dynamicTheme } = useDominantColor(imageUrl);

  const [imgError, setImgError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { total: commentTotal } = useComments(contract, tokenId);
  const { total: remixCount } = useTokenRemixes(contract, tokenId);

  // Collection prev/next. Neighbours come from the (paged) collection token
  // list; arrows are hidden when a neighbour isn't in the loaded page.
  const { tokens: collectionTokens } = useCollectionTokens(contract);
  const tokenIndex = collectionTokens.findIndex((t) => String(t.tokenId) === String(tokenId));
  const prevToken = tokenIndex > 0 ? collectionTokens[tokenIndex - 1] : null;
  const nextToken =
    tokenIndex >= 0 && tokenIndex < collectionTokens.length - 1 ? collectionTokens[tokenIndex + 1] : null;

  // Audited IPNft creation record — undefined for external/legacy contracts (hook returns null).
  const { data: fullTokenData } = useFullTokenData({
    ipNftAddress: contract,
    tokenId: tokenId ? (() => { try { return BigInt(tokenId); } catch { return undefined; } })() : undefined,
  });

  const dialogs = useAssetMarketplaceDialogState();
  const {
    activeListings, activeBids, cheapest, isOwner, myListing,
    attributes, hasTemplateData, isDisplayAttr, parentContract, parentTokenId,
  } = useAssetMarketState(token, listings, walletAddress);

  const isERC1155 = (token?.standard ?? collection?.standard) === "ERC1155";

  const handleAcceptClick = async (order: ApiOrder) => {
    await acceptOffer(order.orderHash, contract, tokenId, order.consideration.itemType);
    mutateListings();
  };

  const remixPolicy = resolveRemixPolicy({
    parentNoDerivatives: getDerivativesTerm(token?.metadata?.attributes) === "Not Allowed",
    viewerIsParentOwner: isOwner,
    dealAvailable: !!getService(collection?.service),
  });

  const handleAutoRemix = () => {
    router.push(`/create/remix/${contract}/${tokenId}`);
  };

  const goToDeal = () => {
    router.push(`/create/licensing/${contract}/${tokenId}`);
  };

  if (isLoading) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-10 gap-6 items-start">
          <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <div className="space-y-1.5 pt-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <Skeleton className="h-9 w-28" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-2xl" />
              ))}
            </div>
            <div className="pt-5 border-t border-border/40 space-y-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              <div className="space-y-2.5">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-24 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="text-2xl font-bold">Asset not found</p>
        <p className="text-muted-foreground mt-2">This token hasn&apos;t been indexed yet.</p>
      </div>
    );
  }

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = ipfsToHttp(token.metadata?.image);
  const description = token.metadata?.description;
  const balances = token.balances ?? [];

  return (
    <div
      style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}
      className="relative z-0 min-h-screen"
    >
      {token.isHidden && <HiddenContentBanner />}
      <AssetAtmosphere imageUrl={imageUrl} imgRef={imgRef} opacityClassName="opacity-30" />

      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 space-y-8 pb-8">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
          <Link href={`/collections/${contract}`} className="hover:text-foreground transition-colors truncate max-w-[140px] shrink-0">
            {collection?.name ?? contract.slice(0, 8) + "…"}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium truncate">{name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-10 gap-6 items-start">
          <div className="space-y-3">
            <AssetMediaColumn
              shouldReduce={Boolean(shouldReduce)}
              image={image}
              imageAlt={name}
              imgError={imgError}
              onImageError={() => setImgError(true)}
              onZoom={() => setLightboxOpen(true)}
              fallback={(
                <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-primary/10 to-purple-500/10">
                  <span className="text-5xl font-mono text-muted-foreground">#{tokenId}</span>
                </div>
              )}
            />
            {(prevToken || nextToken) && (
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={!prevToken}
                  onClick={() => prevToken && router.push(`/asset/${contract}/${prevToken.tokenId}`)}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <button
                  type="button"
                  disabled={!nextToken}
                  onClick={() => nextToken && router.push(`/asset/${contract}/${nextToken.tokenId}`)}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

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
              ownerAddress={!isERC1155 ? (balances[0]?.owner ?? token.owner ?? null) : null}
            />

            <AssetMarketplacePanel
              cheapest={cheapest}
              isMarketLoading={listingsLoading}
              isOwner={isOwner}
              isSignedIn={isSignedIn}
              isProcessing={isProcessing}
              isERC1155={isERC1155}
              myListing={myListing}
              activeBids={activeBids}
              walletAddress={walletAddress}
              remixEnabled={remixPolicy.canRemixDirect}
              onCancelClick={dialogs.handleCancelClick}
              onAcceptBid={handleAcceptClick}
              onOpenListing={() => dialogs.setListOpen(true)}
              onOpenTransfer={() => dialogs.setTransferOpen(true)}
              onOpenPurchase={dialogs.setPurchaseOrder}
              onOpenOffer={() => dialogs.setOfferOpen(true)}
              onOpenRemix={handleAutoRemix}
              showDealOption={remixPolicy.showDealOption}
              onProposeDeal={goToDeal}
            />

            {isERC1155 && balances.length > 0 ? (
              <AssetOwnersPanel balances={balances} maxVisible={5} />
            ) : null}

            {/* Details + rights — separated from the action group by a hairline
                so the column reads as placard sections, not one flat stack. */}
            <div className="pt-5 border-t border-border/40 space-y-5">
              <AssetLinksRow
                contractHref={`${EXPLORER_URL}/contract/${token.contractAddress}`}
                collectionHref={`/collections/${token.contractAddress}`}
                collection={collection}
                shareTitle={name}
                reportTarget={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name }}
                reportOpen={reportOpen}
                onReportOpenChange={setReportOpen}
              />
            </div>
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
            <AssetMarketsTab
              activeListings={activeListings}
              activeBids={activeBids}
              walletAddress={walletAddress ?? undefined}
              isOwner={isOwner}
              isProcessing={isProcessing}
              onBuyClick={dialogs.setPurchaseOrder}
              onCancelClick={dialogs.handleCancelClick}
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

      <AssetLightbox open={lightboxOpen} onOpenChange={setLightboxOpen} image={image} alt={name} />

      <FloatingCommentsButton onClick={() => setCommentOpen(true)} commentTotal={commentTotal} />

      <AssetCommentsDialog
        open={commentOpen}
        onOpenChange={setCommentOpen}
        contract={contract}
        tokenId={tokenId}
        name={name}
        imageUrl={imageUrl}
        commentTotal={commentTotal}
        accentBorderClassName="border-brand-blue/20"
        accentHeaderStyle="linear-gradient(135deg, hsl(var(--brand-blue) / 0.10), hsl(var(--brand-purple) / 0.08))"
        accentAvatarStyle="linear-gradient(135deg, hsl(var(--brand-blue) / 0.3), hsl(var(--brand-purple) / 0.3))"
        accentLabelClassName="text-brand-blue"
        accentCountStyle={{ background: "hsl(var(--brand-blue))" }}
      />

      <AssetMarketplaceDialogs
        contract={contract}
        tokenId={tokenId}
        tokenName={name}
        tokenImage={imageUrl}
        tokenStandard={collection?.standard}
        hasActiveListing={activeListings.length > 0}
        mutateListings={mutateListings}
        dialogs={dialogs}
      />
    </div>
  );
}
