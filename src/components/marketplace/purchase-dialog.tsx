"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle, CheckCircle2, ExternalLink, Minus, Plus,
  RefreshCw, ShieldCheck, ShoppingCart, Zap,
} from "lucide-react";
import { fireConfetti } from "@/lib/confetti";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { ConnectWallet } from "@/components/ConnectWallet";
import { EXPLORER_URL } from "@/lib/constants";
import { formatDisplayPrice, ipfsToHttp } from "@/lib/utils";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import {
  MarketplaceErrorState,
  MarketplaceTxLink,
} from "@/components/marketplace/marketplace-dialog-primitives";
import type { ApiOrder } from "@medialane/sdk";

interface PurchaseDialogProps {
  order: ApiOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = "details" | "processing" | "success";

function TokenHero({ order, quantity }: { order: ApiOrder; quantity: number }) {
  const image = order.token?.image ? ipfsToHttp(order.token.image) : null;
  const name = order.token?.name || `Token #${order.nftTokenId}`;
  const unitPrice = order.price?.formatted ? parseFloat(order.price.formatted) : null;
  const totalPrice = unitPrice !== null ? unitPrice * quantity : null;
  const showTotal = quantity > 1 && totalPrice !== null;

  return (
    <div>
      <div className="relative h-32 w-full bg-muted overflow-hidden shrink-0">
        {image ? (
          <Image src={image} alt={name} fill sizes="448px" className="h-full w-full object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent flex items-center justify-center text-4xl font-bold text-muted-foreground/30">
            #{order.nftTokenId}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-5 pt-4 pb-1 gap-4">
        <div className="min-w-0">
          <p className="font-bold text-lg leading-tight truncate">{name}</p>
          <div className="flex items-center gap-1 mt-1">
            <Zap className="h-3 w-3 text-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-500">Digital Asset Ownership</span>
          </div>
        </div>
        {order.price ? (
          <div className="shrink-0 text-right">
            <p className="flex items-center gap-1.5 font-bold text-2xl justify-end">
              <CurrencyIcon symbol={order.price.currency} size={18} />
              {showTotal
                ? formatDisplayPrice(totalPrice!.toFixed(order.price.decimals <= 6 ? 2 : 4))
                : formatDisplayPrice(order.price.formatted)}
            </p>
            {showTotal ? (
              <p className="text-xs text-muted-foreground">
                {formatDisplayPrice(order.price.formatted)} x {quantity} {order.price.currency}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{order.price.currency}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SuccessScreen({
  order,
  quantity,
  txHash,
  onClose,
  onViewPortfolio,
}: {
  order: ApiOrder;
  quantity: number;
  txHash: string | null;
  onClose: () => void;
  onViewPortfolio: () => void;
}) {
  const image = order.token?.image ? ipfsToHttp(order.token.image) : null;
  const name = order.token?.name ?? null;
  const is1155 = order.offer?.itemType === "ERC1155";
  const assetHref = `/asset/${order.nftContract}/${order.nftTokenId}`;
  const unitPrice = order.price?.formatted ? parseFloat(order.price.formatted) : null;
  const totalPrice = unitPrice !== null ? unitPrice * quantity : null;
  const headline = is1155 && quantity > 1 ? `You own ${quantity} editions!` : "You own it!";

  return (
    <div className="flex flex-col">
      <div className="relative h-56 w-full bg-muted overflow-hidden shrink-0">
        {image ? (
          <Image src={image} alt={name ?? ""} fill sizes="448px" className="h-full w-full object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-purple-500/10 to-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
          <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-white/20 shrink-0">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-xl leading-tight">{headline}</p>
            {name ? <p className="text-white/75 text-sm font-medium truncate mt-0.5">{name}</p> : null}
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="rounded-xl border border-border divide-y divide-border text-sm">
          {order.price ? (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Price paid</span>
              <span className="font-semibold flex items-center gap-1.5">
                <CurrencyIcon symbol={order.price.currency} size={13} />
                {totalPrice !== null && quantity > 1
                  ? `${formatDisplayPrice(totalPrice.toFixed(order.price.decimals <= 6 ? 2 : 4))} ${order.price.currency}`
                  : `${formatDisplayPrice(order.price.formatted)} ${order.price.currency}`}
              </span>
            </div>
          ) : null}
          {txHash ? (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Transaction</span>
              <MarketplaceTxLink txHash={txHash} explorerUrl={EXPLORER_URL} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button variant="outline" className="flex-1" asChild>
            <Link href={assetHref} onClick={onClose}>View asset</Link>
          </Button>
          <Button className="flex-1" onClick={onViewPortfolio}>
            View portfolio
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PurchaseDialog({ order, open, onOpenChange, onSuccess }: PurchaseDialogProps) {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { checkoutCart, isProcessing, txHash, error, resetState } = useMarketplace();
  // The marketplace contract reverts ("Cannot fill own order") if the buyer
  // is the order's offerer. Guard the buy path so users never submit a
  // transaction that is guaranteed to fail.
  const isOwnOrder =
    isConnected &&
    !!address &&
    order.offerer.toLowerCase() === address.toLowerCase();
  const [step, setStep] = useState<Step>("details");
  const [quantity, setQuantity] = useState(1);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const isERC1155 = order.offer.itemType === "ERC1155";
  const maxQty = isERC1155
    ? Math.max(1, parseInt(order.remainingAmount ?? order.offer.startAmount ?? "1", 10))
    : 1;

  useEffect(() => {
    if (open) {
      resetState();
      setStep("details");
      setQuantity(1);
      setSuccessTxHash(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuy = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (isOwnOrder) {
      toast.error("This is your own listing — you can't buy it.");
      return;
    }

    try {
      setStep("processing");
      let considerationAmount = order.consideration.startAmount;
      if (isERC1155 && quantity > 1) {
        const totalUnits = parseInt(order.offer.startAmount || "1", 10) || 1;
        const perUnitRaw = BigInt(order.consideration.startAmount) / BigInt(totalUnits);
        considerationAmount = (perUnitRaw * BigInt(quantity)).toString();
      }

      const item = {
        orderHash: order.orderHash,
        considerationToken: order.consideration.token,
        considerationAmount,
        offerIdentifier: order.offer.identifier,
        isERC1155,
        quantity: quantity.toString(),
      };
      const hash = await checkoutCart([item as any]);
      if (hash) {
        setSuccessTxHash(hash);
        setStep("success");
        fireConfetti();
        onSuccess?.();
      } else {
        setStep("details");
      }
    } catch (e) {
      setStep("details");
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!isProcessing) onOpenChange(nextOpen);
  };

  const handleDone = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  const handleViewPortfolio = () => {
    onOpenChange(false);
    router.push("/portfolio/assets");
    onSuccess?.();
  };

  const isTerminalError = !isProcessing && !!error && !!txHash && step !== "success";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-12px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl">
        <DialogTitle className="sr-only">Complete purchase</DialogTitle>
        <DialogDescription className="sr-only">
          Review the asset, price, quantity, and transaction status for this marketplace purchase.
        </DialogDescription>
        {step === "success" ? (
          <SuccessScreen order={order} quantity={quantity} txHash={successTxHash ?? txHash} onClose={handleDone} onViewPortfolio={handleViewPortfolio} />
        ) : isTerminalError ? (
          <MarketplaceErrorState
            tokenImage={order.token?.image ? ipfsToHttp(order.token.image) : null}
            name={order.token?.name || `Token #${order.nftTokenId}`}
            title="Purchase failed"
            description="The transaction was submitted, but the purchase could not be completed."
            error={error}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            onRetry={() => {
              resetState();
              setStep("details");
            }}
            onDone={() => onOpenChange(false)}
          />
        ) : step === "processing" || isProcessing ? (
          <div className="flex flex-col">
            <TokenHero order={order} quantity={quantity} />
            <div className="px-5 py-8 flex flex-col items-center text-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="font-bold text-lg">Confirming purchase...</p>
                <p className="text-sm text-muted-foreground mt-1">Approve the wallet prompts and keep this window open.</p>
              </div>
              {txHash ? <MarketplaceTxLink txHash={txHash} explorerUrl={EXPLORER_URL} /> : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <TokenHero order={order} quantity={quantity} />
            <div className="px-5 py-5 space-y-4">
              {isERC1155 && maxQty > 1 ? (
                <div className="rounded-xl border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Quantity</span>
                    <span className="text-muted-foreground">{maxQty} available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      max={maxQty}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(maxQty, parseInt(e.target.value, 10) || 1)))}
                      className="h-9 text-center font-semibold"
                    />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              {isOwnOrder ? (
                <div className="space-y-2">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This is your own listing — you can&apos;t buy it. To take it off the market, cancel the listing instead.
                    </AlertDescription>
                  </Alert>
                  <Button
                    className="w-full h-12 text-base font-semibold rounded-[11px]"
                    variant="secondary"
                    onClick={() => onOpenChange(false)}
                  >
                    Close
                  </Button>
                </div>
              ) : isConnected ? (
                <div className="space-y-3">
                  <div className="btn-border-animated p-[1px] rounded-xl">
                    <Button
                      className="w-full h-12 text-base font-semibold text-white rounded-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-background/30"
                      onClick={handleBuy}
                      disabled={isProcessing}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Buy now
                    </Button>
                  </div>
                  <div className="flex items-start justify-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-[10px] text-center text-muted-foreground">
                      The asset transfers atomically after your wallet confirms the trade. Gas is sponsored when available.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <ConnectWallet
                    label="Connect wallet to trade"
                    className="w-full h-12 text-base font-semibold rounded-[11px] bg-primary text-primary-foreground hover:bg-primary/90"
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    Your Starknet wallet is required to sign and complete the trade.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
