"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { Package, DollarSign, Shield, Calendar } from "lucide-react";
import { useToken, useTokenHistory } from "@/hooks/use-tokens";
import { useCollection, useCollectionTokens } from "@/hooks/use-collections";
import { useOnChainDropState, getDropStatus } from "@/hooks/use-drops";
import type { DropConditions } from "@/hooks/use-drops";
import { useTokenListings } from "@/hooks/use-orders";
import { useWallet } from "@/hooks/use-wallet";
import { useComments } from "@/hooks/use-comments";
import { useTokenRemixes } from "@/hooks/use-remix-offers";
import { ipfsToHttp, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { IpTypeBadge } from "@/components/shared/ip-type-badge";
import { FloatingCommentsButton } from "@/components/asset/floating-comments-button";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { ParentAttributionBanner } from "@/components/asset/remixes-tab";
import { EXPLORER_URL } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssetCollectionBar, AssetMarketplacePanel, AssetMediaColumn } from "@medialane/ui";
import { AssetMarketsTab } from "./asset-markets-tab";
import { AssetProvenanceTab } from "./asset-provenance-tab";
import { AssetCommentsDialog } from "./asset-side-panels";
import { AssetOverviewContent } from "./asset-overview-content";
import { ReportDialog } from "@/components/report-dialog";
import { HelpIcon } from "@/components/ui/help-icon";
import { ConnectWallet } from "@/components/ConnectWallet";
import { AssetAtmosphere, useAssetMarketState, type AssetToken } from "./asset-shared";
import { useAssetMarketplaceDialogState, AssetMarketplaceDialogs } from "./asset-marketplace-dialogs";
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
  const { token: rawToken, isLoading } = useToken(contract, tokenId);
  const token = rawToken as AssetToken | null;
  const { state: dropState } = useOnChainDropState(contract);
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
    attributes, hasTemplateData, isDisplayAttr, parentContract, parentTokenId,
  } = useAssetMarketState(token, listings, walletAddress);

  const isERC1155 = collection?.standard === "ERC1155";

  const handleAcceptClick = async (order: ApiOrder) => {
    await acceptOffer(order.orderHash, contract, tokenId, order.consideration.itemType);
    mutateListings();
  };

  const handleAutoRemix = () => {
    router.push(`/create/remix/${contract}/${tokenId}`);
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
  const totalMinted = dropState?.totalMinted ?? collection?.totalSupply ?? 0;

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

            {dropState?.conditions && (
              <DropInfoPanel conditions={dropState.conditions} totalMinted={totalMinted} contract={contract} />
            )}

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
              remixEnabled
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
              onOpenRemix={handleAutoRemix}
            />

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
              target={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name }}
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
        accentBorderClassName="border-orange-500/20"
        accentHeaderStyle="linear-gradient(135deg, hsl(var(--brand-orange) / 0.10), hsl(var(--brand-purple) / 0.08))"
        accentAvatarStyle="linear-gradient(135deg, hsl(var(--brand-orange) / 0.3), hsl(var(--brand-purple) / 0.3))"
        accentLabelClassName="text-orange-400"
        accentCountStyle={{ background: "hsl(var(--brand-orange))" }}
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
