"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { useToken, useTokenHistory } from "@/hooks/use-tokens";
import { useCollection, useCollectionTokens } from "@/hooks/use-collections";
import { useTokenListings } from "@/hooks/use-orders";
import { useWallet } from "@/hooks/use-wallet";
import { useComments } from "@/hooks/use-comments";
import { useTokenRemixes } from "@/hooks/use-remix-offers";
import { ipfsToHttp } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingCommentsButton } from "@/components/asset/floating-comments-button";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { EXPLORER_URL } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiActivity, ApiOrder } from "@medialane/sdk";
import { useMarketplace } from "@/hooks/use-marketplace";
import { AssetCollectionBar, AssetMarketplacePanel, AssetMediaColumn, AssetHeaderBlock, buildEditionStats } from "@medialane/ui";
import { AssetMarketsTab } from "./asset-markets-tab";
import { AssetProvenanceTab } from "./asset-provenance-tab";
import { AssetOwnersPanel, AssetCommentsDialog } from "./asset-side-panels";
import { AssetOverviewContent } from "./asset-overview-content";
import { ReportDialog } from "@/components/report-dialog";
import { HelpIcon } from "@/components/ui/help-icon";
import { ConnectWallet } from "@/components/ConnectWallet";
import { AssetAtmosphere, useAssetMarketState, type AssetToken } from "./asset-shared";
import { useAssetMarketplaceDialogState, AssetMarketplaceDialogs } from "./asset-marketplace-dialogs";

export function AssetPageEdition() {
  const { contract, tokenId } = useParams<{ contract: string; tokenId: string }>();
  const router = useRouter();
  const { isConnected: isSignedIn, address: walletAddress } = useWallet();
  const { collection } = useCollection(contract);
  const { token: rawToken, isLoading } = useToken(contract, tokenId);
  const token = rawToken as AssetToken | null;
  const { listings, mutate: mutateListings, isLoading: listingsLoading } = useTokenListings(contract, tokenId);
  const { history } = useTokenHistory(contract, tokenId);
  const { tokens: collectionTokens } = useCollectionTokens(contract);
  const { acceptOffer, isProcessing } = useMarketplace();
  const shouldReduce = useReducedMotion();

  const imageUrl = token?.metadata?.image ? ipfsToHttp(token.metadata.image) : null;
  const { imgRef, dynamicTheme } = useDominantColor(imageUrl);

  const [imgError, setImgError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);

  const { total: commentTotal } = useComments(contract, tokenId);
  const { total: remixCount } = useTokenRemixes(contract, tokenId);

  const dialogs = useAssetMarketplaceDialogState();
  const {
    activeListings, activeBids, cheapest, isOwner, myListing,
    attributes, hasTemplateData, isDisplayAttr,
  } = useAssetMarketState(token, listings, walletAddress);

  const handleAcceptClick = async (order: ApiOrder) => {
    await acceptOffer(order.orderHash, contract, tokenId, order.consideration.itemType);
    mutateListings();
  };

  // Most recent "sale" activity — `history`'s sort order isn't guaranteed, so
  // pick the max-timestamp entry explicitly rather than assuming array order.
  const lastSale = (history as ApiActivity[])
    .filter((h) => h.type === "sale" && h.price?.formatted)
    .reduce<ApiActivity | null>((latest, h) => (!latest || h.timestamp > latest.timestamp ? h : latest), null);
  const lastSaleRaw = lastSale?.price ? `${lastSale.price.formatted} ${lastSale.price.currency ?? ""}`.trim() : null;

  if (isLoading) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 pb-8">
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
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-24 text-center">
        <p className="text-2xl font-bold">Asset not found</p>
      </div>
    );
  }

  const name = token.metadata?.name || `Token #${token.tokenId}`;
  const image = token.metadata?.image ? ipfsToHttp(token.metadata.image) : null;
  const description = token.metadata?.description;
  const holders = token.balances ?? [];
  const uniqueHolders = holders.length;
  const totalEditions = holders.reduce((sum, b) => sum + parseInt(b.amount, 10), 0);

  return (
    <div
      style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}
      className="relative z-0 min-h-screen"
    >
      {token.isHidden && <HiddenContentBanner />}
      <AssetAtmosphere imageUrl={imageUrl} imgRef={imgRef} />

      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 space-y-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] lg:gap-10 gap-8 items-start">
          <AssetMediaColumn
            shouldReduce={Boolean(shouldReduce)}
            image={image ?? ""}
            imageAlt={name}
            imgError={imgError}
            onImageError={() => setImgError(true)}
            fallback={(
              <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-violet-500/20 to-purple-600/20">
                <Layers className="h-24 w-24 text-violet-500/40" />
              </div>
            )}
            stats={buildEditionStats(totalEditions, uniqueHolders)}
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
              showMultiEditionBadge={true}
            />

            <AssetMarketplacePanel
              cheapest={cheapest}
              isMarketLoading={listingsLoading}
              isOwner={isOwner}
              isSignedIn={isSignedIn}
              isProcessing={isProcessing}
              isERC1155
              myListing={myListing}
              activeBids={activeBids}
              walletAddress={walletAddress}
              floorPriceRaw={collection?.floorPrice}
              lastSaleRaw={lastSaleRaw}
              renderAuthAction={(label) => (
                <div className="btn-border-animated p-[1px] rounded-2xl">
                  <ConnectWallet
                    label={label}
                    className="w-full h-12 text-base bg-transparent text-white rounded-[15px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98]"
                  />
                </div>
              )}
              renderHelp={(content) => <HelpIcon content={content} side="top" />}
              onCancelClick={dialogs.handleCancelClick}
              onAcceptBid={handleAcceptClick}
              onOpenListing={() => dialogs.setListOpen(true)}
              onOpenTransfer={() => dialogs.setTransferOpen(true)}
              onOpenPurchase={dialogs.setPurchaseOrder}
              onOpenOffer={() => dialogs.setOfferOpen(true)}
            />

            <AssetOwnersPanel balances={holders} maxVisible={8} />

            <AssetCollectionBar
              collectionName={collection?.name ?? contract.slice(0, 8) + "…"}
              collectionImage={collection?.image}
              collectionHref={`/collections/${contract}`}
              ipType={token.metadata?.ipType}
              contractExplorerHref={`${EXPLORER_URL}/contract/${token.contractAddress}`}
              shareTitle={name}
              onReportClick={() => setReportOpen(true)}
              currentTokenId={tokenId}
              siblingTokens={collectionTokens.map((t) => ({
                tokenId: t.tokenId,
                image: t.metadata?.image ? ipfsToHttp(t.metadata.image) : null,
              }))}
              onNavigate={(id) => router.push(`/asset/${contract}/${id}`)}
            />
            <ReportDialog
              target={{ type: "TOKEN", contract, tokenId, name }}
              open={reportOpen}
              onOpenChange={setReportOpen}
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
            <AssetMarketsTab activeListings={activeListings} activeBids={activeBids} walletAddress={walletAddress ?? undefined} isOwner={isOwner} isProcessing={isProcessing} onBuyClick={dialogs.setPurchaseOrder} onCancelClick={dialogs.handleCancelClick} onAcceptClick={handleAcceptClick} />
          </TabsContent>

          <TabsContent value="provenance">
            <AssetProvenanceTab history={history as ApiActivity[]} contract={contract} tokenId={tokenId} remixCount={remixCount} />
          </TabsContent>
        </Tabs>
      </div>

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
        tokenStandard="ERC1155"
        hasActiveListing={activeListings.length > 0}
        mutateListings={mutateListings}
        dialogs={dialogs}
      />
    </div>
  );
}
