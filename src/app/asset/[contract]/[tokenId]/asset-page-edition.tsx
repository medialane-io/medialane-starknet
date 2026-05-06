"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight, ExternalLink, HandCoins,
  Tag, ArrowRightLeft, ShoppingCart, X,
  Loader2, Flag, Layers, Users, TrendingUp,
} from "lucide-react";
import { useToken, useTokenHistory } from "@/hooks/use-tokens";
import { useCollection } from "@/hooks/use-collections";
import { useTokenListings } from "@/hooks/use-orders";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useCart } from "@/hooks/use-cart";
import { useComments } from "@/hooks/use-comments";
import { useTokenRemixes } from "@/hooks/use-remix-offers";
import { ipfsToHttp, formatDisplayPrice, timeUntil, checkIsOwner } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { AddressDisplay } from "@/components/shared/address-display";
import { IpTypeBadge } from "@/components/shared/ip-type-badge";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";
import { FloatingCommentsButton } from "@/components/asset/floating-comments-button";
import { ShareButton } from "@/components/shared/share-button";
import { ReportDialog } from "@/components/report-dialog";
import { HiddenContentBanner } from "@/components/hidden-content-banner";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { HelpIcon } from "@/components/ui/help-icon";
import { EXPLORER_URL } from "@/lib/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CommentsSection } from "@/components/asset/comments-section";
import { AssetMarketsTab } from "./asset-markets-tab";
import { AssetProvenanceTab } from "./asset-provenance-tab";
import { LICENSE_TRAIT_TYPES } from "@/types/ip";
import type { IPType } from "@/types/ip";
import { IP_TEMPLATES } from "@/lib/ip-templates";
import { IPTypeDisplay } from "@/components/ip-type-display";
import type { ApiActivity, ApiOrder } from "@medialane/sdk";
import { toast } from "sonner";
import { useConnect } from "@starknet-react/core";
import { StarknetkitConnector, useStarknetkitConnectModal } from "starknetkit";
import { useMarketplace } from "@/hooks/use-marketplace";

export function AssetPageEdition() {
  const { contract, tokenId } = useParams<{ contract: string; tokenId: string }>();
  const { isConnected: isSignedIn, address: walletAddress } = useUnifiedWallet();
  const { collection } = useCollection(contract);
  const { token, isLoading } = useToken(contract, tokenId);
  const { listings, mutate: mutateListings } = useTokenListings(contract, tokenId);
  const { history } = useTokenHistory(contract, tokenId);
  const { acceptOffer, isProcessing } = useMarketplace();

  const { connectAsync, connectors } = useConnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
    modalTheme: "dark",
  });
  const handleConnectWallet = async () => {
    try {
      const { connector } = await starknetkitConnectModal();
      if (!connector) return;
      await connectAsync({ connector });
    } catch { /* user closed modal */ }
  };

  const { addItem, items: cartItems, setIsOpen: setCartOpen } = useCart();
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
  const myListing = isOwner
    ? activeListings.find((l) => l.offerer.toLowerCase() === walletAddress!.toLowerCase())
    : null;
  const inCart = cheapest ? cartItems.some((i) => i.orderHash === cheapest.orderHash) : false;

  const handleAddToCart = () => {
    if (!cheapest || inCart) return;
    const name = token?.metadata?.name || `Token #${tokenId}`;
    addItem(
      {
        orderHash: cheapest.orderHash,
        nftContract: contract,
        nftTokenId: tokenId,
        name,
        image: ipfsToHttp(token?.metadata?.image) ?? "",
        price: formatDisplayPrice(cheapest.price.formatted),
        currency: cheapest.price.currency ?? "",
        currencyDecimals: cheapest.price.decimals,
        offerer: cheapest.offerer,
        considerationToken: cheapest.consideration.token,
        considerationAmount: cheapest.consideration.startAmount,
        isERC1155: true,
        offerIdentifier: name || `#${tokenId}`,
      },
      walletAddress ?? undefined
    );
    toast.success("Added to cart", {
      action: { label: "View cart", onClick: () => setCartOpen(true) },
    });
  };

  const handleCancelClick = (order: ApiOrder) => {
    setOrderToCancel(order);
    setCancelOpen(true);
  };

  const handleAcceptClick = async (order: ApiOrder) => {
    await acceptOffer(order.orderHash, contract, tokenId, order.consideration.itemType);
    mutateListings();
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
    activeTemplate.fields.some((f) => attributes.some((a) => a.trait_type === f.key && a.value));
  const isDisplayAttr = (a: { trait_type?: string }): boolean =>
    !LICENSE_TRAIT_TYPES.has(a.trait_type ?? "") && !activeTemplateKeys.has(a.trait_type ?? "");

  const balances = (token as any).balances as { owner: string; amount: string }[] | undefined;
  const uniqueHolders = balances?.length ?? 0;
  const totalEditions = balances?.reduce((sum, b) => sum + parseInt(b.amount, 10), 0) ?? 0;
  const floorListing = cheapest
    ? `${formatDisplayPrice(cheapest.price.formatted)} ${cheapest.price.currency ?? ""}`
    : null;

  return (
    <div
      style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}
      className="relative z-0 min-h-screen"
    >
      {(token as any).isHidden && <HiddenContentBanner />}
      {imageUrl && (
        <img ref={imgRef} src={imageUrl} crossOrigin="anonymous" aria-hidden alt="" fetchPriority="high" style={{ display: "none" }} />
      )}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {imageUrl && (
          <img src={imageUrl} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110" style={{ filter: "blur(60px) saturate(1.5)" }} />
        )}
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
          <motion.div
            initial={shouldReduce ? false : { scale: 1.0, opacity: 0 }}
            animate={{ scale: 1.02, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="overflow-hidden rounded-xl lg:sticky lg:top-16"
          >
            <div className="rounded-2xl overflow-hidden border border-border bg-muted">
              {image && !imgError ? (
                <Image src={image} alt={name} width={0} height={0} sizes="(max-width: 1024px) 100vw, 66vw" className="w-full h-auto" onError={() => setImgError(true)} priority />
              ) : (
                <div className="aspect-square flex items-center justify-center bg-gradient-to-br from-violet-500/10 to-purple-500/10">
                  <Layers className="h-16 w-16 text-violet-500/30" />
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {token.metadata?.ipType && <IpTypeBadge ipType={token.metadata.ipType} size="md" />}
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-500">
                  <Layers className="h-3 w-3" />
                  Multi-edition
                </span>
              </div>
              <h1 className="text-3xl lg:text-5xl font-bold">{name}</h1>
              {description && <p className="text-sm text-muted-foreground leading-relaxed mt-1">{description}</p>}
            </div>

            {/* Edition stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                <p className="text-xl font-black">{totalEditions}</p>
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <Layers className="h-3 w-3" />
                  editions
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                <p className="text-xl font-black">{uniqueHolders}</p>
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <Users className="h-3 w-3" />
                  holders
                </div>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                <p className="text-sm font-black truncate">{floorListing ?? "—"}</p>
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                  <TrendingUp className="h-3 w-3" />
                  floor
                </div>
              </div>
            </div>

            {/* Marketplace action box */}
            {cheapest ? (
              <div className="rounded-2xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CurrencyIcon symbol={cheapest.price.currency ?? ""} size={22} />
                  <span className="text-3xl font-bold">{formatDisplayPrice(cheapest.price.formatted)}</span>
                  <HelpIcon content={`${isOwner ? "Your listing" : "Current price"} · Expires ${timeUntil(cheapest.endTime)}`} side="top" />
                </div>
                {isOwner ? (
                  <div className="space-y-2">
                    {myListing && (
                      <div className="btn-border-animated p-[1px] rounded-xl">
                        <button className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-destructive disabled:opacity-50" disabled={isProcessing} onClick={() => handleCancelClick(myListing)}>
                          {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          Cancel listing
                        </button>
                      </div>
                    )}
                    <div className="btn-border-animated p-[1px] rounded-xl">
                      <button className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-blue" onClick={() => setListOpen(true)}>
                        <Tag className="h-4 w-4" />
                        List edition for sale
                      </button>
                    </div>
                    <div className="btn-border-animated p-[1px] rounded-xl">
                      <button className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-orange" onClick={() => setTransferOpen(true)}>
                        <ArrowRightLeft className="h-4 w-4" />
                        Transfer
                      </button>
                    </div>
                  </div>
                ) : isSignedIn ? (
                  <div className="space-y-2">
                    <div className="btn-border-animated p-[1px] rounded-xl">
                      <button className="w-full h-12 text-base font-semibold text-white rounded-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-background/30" onClick={() => setPurchaseOrder(cheapest)}>
                        <ShoppingCart className="h-5 w-5" />
                        Buy Edition
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`btn-border-animated p-[1px] rounded-xl ${inCart ? "opacity-40 pointer-events-none" : ""}`}>
                        <button className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-blue" disabled={inCart} onClick={handleAddToCart}>
                          <ShoppingCart className="h-4 w-4" />
                          {inCart ? "In cart" : "Add to cart"}
                        </button>
                      </div>
                      <div className="btn-border-animated p-[1px] rounded-xl">
                        <button className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-orange" onClick={() => setOfferOpen(true)}>
                          <HandCoins className="h-4 w-4" />
                          Make offer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button className="w-full h-12 text-base" onClick={handleConnectWallet}>
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Connect wallet to trade
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border p-5 space-y-3">
                <p className="text-muted-foreground text-sm">Not listed for sale.</p>
                {isOwner && (
                  <div className="space-y-2">
                    <div className="btn-border-animated p-[1px] rounded-xl">
                      <button className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-blue" onClick={() => setListOpen(true)}>
                        <Tag className="h-4 w-4" />
                        List edition for sale
                      </button>
                    </div>
                    <div className="btn-border-animated p-[1px] rounded-xl">
                      <button className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-orange" onClick={() => setTransferOpen(true)}>
                        <ArrowRightLeft className="h-4 w-4" />
                        Transfer
                      </button>
                    </div>
                  </div>
                )}
                {!isOwner && isSignedIn && (
                  <div className="btn-border-animated p-[1px] rounded-xl">
                    <button className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-orange" onClick={() => setOfferOpen(true)}>
                      <HandCoins className="h-4 w-4" />
                      Make offer
                    </button>
                  </div>
                )}
                {!isOwner && !isSignedIn && (
                  <Button variant="outline" className="w-full" onClick={handleConnectWallet}>
                    Connect wallet to make an offer
                  </Button>
                )}
              </div>
            )}

            {/* Holders grid */}
            {balances && balances.length > 0 && (
              <div className="rounded-xl border border-border p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {uniqueHolders === 1 ? "Owner" : `${uniqueHolders} holders`}
                </p>
                <div className="space-y-2">
                  {balances.slice(0, 8).map((b) => (
                    <div key={b.owner} className="flex items-center justify-between text-sm">
                      <Link href={`/creator/${b.owner}`} className="hover:text-primary transition-colors font-medium">
                        <AddressDisplay address={b.owner} chars={6} showCopy={false} />
                      </Link>
                      <span className="text-muted-foreground text-xs">× {b.amount}</span>
                    </div>
                  ))}
                  {balances.length > 8 && (
                    <p className="text-xs text-muted-foreground">+{balances.length - 8} more holders</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 text-sm">
              <a href={`${EXPLORER_URL}/contract/${token.contractAddress}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                Contract <ExternalLink className="h-3 w-3" />
              </a>
              <ShareButton title={name ?? `Token #${token?.tokenId}`} variant="ghost" size="icon" />
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => setReportOpen(true)} title="Report">
                <Flag className="w-4 h-4" />
              </Button>
            </div>

            <ReportDialog target={{ type: "TOKEN", contract: token.contractAddress, tokenId: token.tokenId, name: name ?? undefined }} open={reportOpen} onOpenChange={setReportOpen} />
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

          <TabsContent value="overview" className="mt-4 space-y-6">
            {hasTemplateData && (
              <IPTypeDisplay attributes={token.metadata?.attributes as { trait_type?: string; value?: string }[] | null} />
            )}
            {attributes.filter((a) => isDisplayAttr(a)).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Attributes</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attributes.filter((a) => isDisplayAttr(a)).map((attr, i) => (
                    <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 text-center overflow-hidden">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{attr.trait_type ?? "Trait"}</p>
                      <p className="text-sm font-semibold mt-0.5 truncate">{attr.value ?? "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
          </div>
          <div className="flex-1 overflow-hidden">
            <CommentsSection contract={contract} tokenId={tokenId} className="h-full rounded-none border-0" />
          </div>
        </DialogContent>
      </Dialog>

      {purchaseOrder && (
        <PurchaseDialog order={purchaseOrder} open onOpenChange={(v) => { if (!v) setPurchaseOrder(null); }} onSuccess={mutateListings} />
      )}
      <ListingDialog open={listOpen} onOpenChange={setListOpen} assetContract={contract} tokenId={tokenId} tokenName={name} tokenStandard="ERC1155" onSuccess={mutateListings} />
      <OfferDialog open={offerOpen} onOpenChange={setOfferOpen} assetContract={contract} tokenId={tokenId} tokenName={name} tokenStandard="ERC1155" />
      <CancelOrderDialog order={orderToCancel} open={cancelOpen} onOpenChange={(v) => { setCancelOpen(v); if (!v) setOrderToCancel(null); }} onSuccess={mutateListings} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} contractAddress={contract} tokenId={tokenId} tokenName={name} hasActiveListing={activeListings.length > 0} onSuccess={mutateListings} />
    </div>
  );
}
