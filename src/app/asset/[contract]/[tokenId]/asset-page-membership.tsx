"use client";

// Membership asset page — the ip-club uiVariant. Built on the same shared
// modules as the edition page, with the token presented as a membership tier:
// the on-chain validity window and supply from get_membership, and a
// holder-facing "Your membership" state driven by the on-chain is_member_of
// check. The window gates membership, never minting or trading.

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { Users, CheckCircle2, Clock, CalendarX2, Infinity as InfinityIcon } from "lucide-react";
import { useToken, useTokenHistory } from "@/hooks/use-tokens";
import { useCollection, useCollectionTokens } from "@/hooks/use-collections";
import { useTokenListings } from "@/hooks/use-orders";
import { useWallet } from "@/hooks/use-wallet";
import { useComments } from "@/hooks/use-comments";
import { useTokenRemixes } from "@/hooks/use-remix-offers";
import { useMembershipOnchain, useIsMemberOf, type MembershipOnchain } from "@/hooks/use-club";
import { ipfsToHttp, resolveTokenImage, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { FloatingCommentsButton } from "@/components/asset/floating-comments-button";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { EXPLORER_URL } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApiActivity, ApiOrder } from "@medialane/sdk";
import { useMarketplace } from "@/hooks/use-marketplace";
import { AssetCollectionBar, AssetUtilityIcons, AssetMarketplacePanel, AssetMediaColumn, AssetHeaderBlock } from "@medialane/ui";
import { AssetMarketsTab } from "./asset-markets-tab";
import { AssetProvenanceTab } from "./asset-provenance-tab";
import { AssetOwnersPanel, AssetCommentsDialog } from "./asset-side-panels";
import { AssetOverviewContent } from "./asset-overview-content";
import { ReportDialog } from "@/components/report-dialog";
import { HelpIcon } from "@/components/ui/help-icon";
import { ConnectWallet } from "@/components/ConnectWallet";
import { AssetAtmosphere, useAssetMarketState, type AssetToken } from "./asset-shared";
import { useAssetMarketplaceDialogState, AssetMarketplaceDialogs } from "./asset-marketplace-dialogs";

// ── Membership status (window-derived only) ───────────────────────────────────

type MembershipStatus = "upcoming" | "active" | "ended" | "lifetime";

function membershipStatus(m: MembershipOnchain): MembershipStatus {
  if (m.startTime == null && m.endTime == null) return "lifetime";
  const now = Date.now() / 1000;
  if (m.startTime != null && now < m.startTime) return "upcoming";
  if (m.endTime != null && now >= m.endTime) return "ended";
  return "active";
}

const fmtDate = (ts: number) =>
  new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

function windowLabel(m: MembershipOnchain): string {
  if (m.startTime != null && m.endTime != null) return `Valid from ${fmtDate(m.startTime)} to ${fmtDate(m.endTime)}`;
  if (m.startTime != null) return `Valid from ${fmtDate(m.startTime)}`;
  if (m.endTime != null) return `Valid until ${fmtDate(m.endTime)}`;
  return "Lifetime membership";
}

function MembershipStatusChip({ status }: { status: MembershipStatus }) {
  const styles: Record<MembershipStatus, string> = {
    upcoming: "bg-muted text-muted-foreground border-border",
    active: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
    ended: "bg-muted text-muted-foreground border-border",
    lifetime: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
  };
  const labels: Record<MembershipStatus, string> = {
    upcoming: "Upcoming",
    active: "Active",
    ended: "Ended",
    lifetime: "Lifetime",
  };
  const Icon =
    status === "active" ? CheckCircle2 :
    status === "upcoming" ? Clock :
    status === "lifetime" ? InfinityIcon : CalendarX2;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", styles[status])}>
      <Icon className="h-3.5 w-3.5" />
      {labels[status]}
    </span>
  );
}

// ── Membership panel — identity, supply, royalty, validity window, and the
// connected holder's own state (quantity + on-chain is_member_of).

function MembershipPanel({
  membership,
  myQuantity,
  isMember,
}: {
  membership: MembershipOnchain;
  myQuantity: number;
  isMember: boolean;
}) {
  const status = membershipStatus(membership);
  const hasWindow = membership.startTime != null || membership.endTime != null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-muted/40 to-transparent p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-purple" />
          <span className="text-sm font-semibold">Membership</span>
        </div>
        <MembershipStatusChip status={status} />
      </div>
      {hasWindow && <p className="text-sm text-muted-foreground">{windowLabel(membership)}</p>}
      <div className="flex gap-8">
        <div>
          <p className="text-xs text-muted-foreground">Supply</p>
          <p className="text-sm font-semibold tabular-nums">{membership.maxSupply.toString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Royalty</p>
          <p className="text-sm font-semibold tabular-nums">{(membership.royaltyBps / 100).toFixed(1)}%</p>
        </div>
      </div>
      {myQuantity > 0 && (
        <div className="flex items-center gap-2 border-t border-border/60 pt-3">
          {isMember ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-teal-500" />
              <p className="text-sm font-medium">
                Active member · {myQuantity} card{myQuantity > 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {status === "upcoming" ? "Not yet valid" : "Membership ended"} · {myQuantity} card{myQuantity > 1 ? "s" : ""}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AssetPageMembership() {
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
  const { membership } = useMembershipOnchain(contract, tokenId);
  const { isMember } = useIsMemberOf(contract, tokenId, walletAddress ?? null);
  const shouldReduce = useReducedMotion();

  const imageUrl = token?.metadata?.image ? ipfsToHttp(token.metadata.image) : null;
  const { imgRef, dynamicTheme } = useDominantColor(imageUrl);

  const [imgError, setImgError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);

  const { total: commentTotal } = useComments(contract, tokenId, 1, 20, false); // count only — no background poll
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

  const lastSale = (history as ApiActivity[])
    .filter((h) => h.type === "sale" && h.price?.formatted)
    .reduce<ApiActivity | null>((latest, h) => (!latest || h.timestamp > latest.timestamp ? h : latest), null);
  const lastSaleRaw = lastSale?.price ? `${lastSale.price.formatted} ${lastSale.price.currency ?? ""}`.trim() : null;

  if (isLoading) {
    return (
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-10 gap-8">
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

  const name = token.metadata?.name || `Membership #${token.tokenId}`;
  const image = resolveTokenImage(token.metadata?.image);
  const description = token.metadata?.description;
  const holders = token.balances ?? [];
  const myQuantity = walletAddress
    ? parseInt(
        holders.find((b) => b.owner?.toLowerCase() === walletAddress.toLowerCase())?.amount ?? "0",
        10
      )
    : 0;

  return (
    <div
      style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}
      className="relative z-0 min-h-screen"
    >
      {token.isHidden && <HiddenContentBanner />}
      <AssetAtmosphere imageUrl={imageUrl} imgRef={imgRef} />

      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 space-y-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-10 gap-8 items-start">
          <AssetMediaColumn
            shouldReduce={Boolean(shouldReduce)}
            image={image ?? ""}
            imageAlt={name}
            imgError={imgError}
            onImageError={() => setImgError(true)}
            fallback={(
              <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-brand-purple/20 to-brand-blue/20">
                <Users className="h-24 w-24 text-brand-purple/40" />
              </div>
            )}
          />

          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="flex items-start justify-between gap-3">
              <AssetHeaderBlock
                name={name}
                description={description}
                ipType={token.metadata?.ipType}
              />
              <AssetUtilityIcons
                contractExplorerHref={`${EXPLORER_URL}/contract/${token.contractAddress}`}
                shareTitle={name}
                onReportClick={() => setReportOpen(true)}
              />
            </div>

            {membership && (
              <MembershipPanel membership={membership} myQuantity={myQuantity} isMember={isMember} />
            )}

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
              collectionImage={collection?.image ? ipfsToHttp(collection.image, 96) : null}
              collectionHref={`/collections/${contract}`}
              currentTokenId={tokenId}
              siblingTokens={collectionTokens.map((t) => ({
                tokenId: t.tokenId,
                image: t.metadata?.image ? ipfsToHttp(t.metadata.image, 96) : null,
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
        accentBorderClassName="border-brand-purple/20"
        accentHeaderStyle="linear-gradient(135deg, hsl(var(--brand-purple) / 0.10), hsl(var(--brand-blue) / 0.08))"
        accentAvatarStyle="linear-gradient(135deg, hsl(var(--brand-purple) / 0.3), hsl(var(--brand-blue) / 0.3))"
        accentLabelClassName="text-brand-purple"
        accentCountStyle={{ background: "hsl(var(--brand-purple))" }}
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
