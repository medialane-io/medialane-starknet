"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { Award } from "lucide-react";
import type { ApiActivity, ApiOrder } from "@medialane/sdk";
import { AssetCollectionBar, AssetUtilityIcons, AssetHeaderBlock, AssetMediaColumn, AssetProvenanceTab, AssetUnavailable, ASSET_ACCENTS } from "@medialane/ui";
import { assetHref, collectionHref } from "@/lib/routes";
import { useToken, useTokenHistory } from "@/hooks/use-tokens";
import { useCollection, useNearbyCollectionTokens } from "@/hooks/use-collections";
import { useComments } from "@/hooks/use-comments";
import { useTokenRemixes } from "@/hooks/use-remix-offers";
import { useWallet } from "@/hooks/use-wallet";
import { ipfsToHttp } from "@/lib/utils";
import { EXPLORER_URL } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FloatingCommentsButton } from "@/components/asset/floating-comments-button";
import { AssetLightbox } from "@/components/asset/asset-lightbox";
import { PopBurnButton } from "@/components/claim/pop-burn-button";
import { ReportDialog } from "@/components/report-dialog";
import { AssetCommentsDialog } from "./asset-side-panels";
import { AssetOverviewContent } from "./asset-overview-content";
import { AssetAtmosphere, useAssetMarketState, type AssetToken } from "./asset-shared";

const NO_LISTINGS: ApiOrder[] = [];

export function AssetPagePop() {
  const { contract, tokenId } = useParams<{ contract: string; tokenId: string }>();
  const router = useRouter();
  const { address: walletAddress } = useWallet();
  const { collection } = useCollection(contract);
  const { token: rawToken, isIndexing } = useToken(contract, tokenId);
  const token = rawToken as AssetToken | null;
  const { history } = useTokenHistory(contract, tokenId);
  const { tokens: collectionTokens } = useNearbyCollectionTokens(contract, tokenId);
  const { total: commentTotal } = useComments(contract, tokenId, 1, 20, false);
  const { total: remixCount } = useTokenRemixes(contract, tokenId);
  const shouldReduce = useReducedMotion();

  const [imgError, setImgError] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { isOwner, attributes, hasTemplateData, isDisplayAttr } = useAssetMarketState(token, NO_LISTINGS, walletAddress);

  if (!token) return <AssetUnavailable isIndexing={isIndexing} />;

  const name = token.metadata?.name || `POP #${token.tokenId}`;
  const image = token.metadata?.image ? ipfsToHttp(token.metadata.image) : null;
  const description = token.metadata?.description;

  return (
    <div className="relative z-0 min-h-screen">
      <AssetAtmosphere imageUrl={image} opacityClassName="opacity-30" />

      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 space-y-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-10 gap-6 items-start">
          <div className="space-y-3">
            <AssetMediaColumn
              shouldReduce={Boolean(shouldReduce)}
              image={image}
              imageAlt={name}
              imgError={imgError}
              onImageError={() => setImgError(true)}
              onZoom={() => setLightboxOpen(true)}
              animationUrl={token.metadata?.animationUrl}
              fallback={(
                <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-primary/10 to-brand-purple/10">
                  <Award className="h-24 w-24 text-muted-foreground/40" />
                </div>
              )}
            />
          </div>

          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                <Award className="h-3 w-3" />
                POP
              </span>
              <AssetHeaderBlock
                name={name}
                description={description}
                ipType={token.metadata?.ipType}
                utilities={(
                  <AssetUtilityIcons
                    contractExplorerHref={`${EXPLORER_URL}/contract/${token.contractAddress}`}
                    shareTitle={name}
                    onReportClick={() => setReportOpen(true)}
                  />
                )}
              />
            </div>

            {isOwner && <PopBurnButton collectionAddress={contract} tokenId={tokenId} />}

            <div className="pt-5 space-y-5">
              <AssetCollectionBar
                collectionName={collection?.name ?? contract.slice(0, 8) + "…"}
                collectionImage={collection?.image ? ipfsToHttp(collection.image) : null}
                collectionHref={collectionHref("STARKNET", contract)}
                currentTokenId={tokenId}
                siblingTokens={collectionTokens.map((t) => ({
                  tokenId: t.tokenId,
                  image: t.metadata?.image ? ipfsToHttp(t.metadata.image) : null,
                }))}
                onNavigate={(id) => router.push(assetHref("STARKNET", contract, id))}
              />
              <ReportDialog
                target={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name }}
                open={reportOpen}
                onOpenChange={setReportOpen}
              />
            </div>
          </motion.div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
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

          <TabsContent value="provenance">
            <AssetProvenanceTab
              history={history as ApiActivity[]}
              contract={contract}
              tokenId={tokenId}
              remixCount={remixCount}
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
        imageUrl={image}
        commentTotal={commentTotal}
        {...ASSET_ACCENTS.standard}
      />
    </div>
  );
}
