"use client";

import { useEffect } from "react";
import Image from "next/image";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { useMarketplace } from "@/hooks/use-marketplace";
import { ipfsToHttp, formatDisplayPrice } from "@/lib/utils";
import {
  MarketplaceProcessingState,
  MarketplaceTxLink,
} from "@/components/marketplace/marketplace-dialog-primitives";
import { EXPLORER_URL } from "@/lib/constants";
import type { ApiOrder } from "@medialane/sdk";

interface CancelOrderDialogProps {
  order: ApiOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Controls the label shown — auto-detected from order type if omitted. */
  variant?: "listing" | "offer";
}

function TokenHero({ order, variant }: { order: ApiOrder; variant: "listing" | "offer" }) {
  const image = order.token?.image ? ipfsToHttp(order.token.image) : null;
  const name = order.token?.name || `Token #${order.nftTokenId}`;

  return (
    <div>
      <div className="relative h-44 w-full bg-muted overflow-hidden">
        {image ? (
          <Image src={image} alt={name} fill sizes="448px" className="h-full w-full object-cover" unoptimized />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-destructive/20 via-rose-500/10 to-transparent flex items-center justify-center text-4xl font-bold text-muted-foreground/30">
            #{order.nftTokenId}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      </div>
      <div className="flex items-end justify-between px-6 pt-3 pb-1">
        <div className="min-w-0">
          <p className="font-bold text-lg leading-tight truncate">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">Cancel {variant}</p>
        </div>
        {order.price && (
          <div className="shrink-0 text-right ml-4">
            <p className="flex items-center gap-1.5 font-bold text-xl justify-end">
              <CurrencyIcon symbol={order.price.currency} size={16} />
              {formatDisplayPrice(order.price.formatted)}
            </p>
            <p className="text-xs text-muted-foreground">{order.price.currency}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
  variant,
}: CancelOrderDialogProps) {
  const { cancelOrder, isProcessing, txHash, error, resetState } = useMarketplace();

  const resolvedVariant: "listing" | "offer" =
    variant ?? (order?.offer.itemType === "ERC721" || order?.offer.itemType === "ERC1155" ? "listing" : "offer");

  const tokenStandard =
    order?.offer.itemType === "ERC1155" || order?.consideration.itemType === "ERC1155"
      ? "ERC1155"
      : "ERC721";

  useEffect(() => {
    if (open) resetState();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = async () => {
    if (!order) return;
    const hash = await cancelOrder(order.orderHash, tokenStandard, resolvedVariant, { silent: true });
    if (hash) onSuccess?.();
  };

  const isSuccess = !isProcessing && !!txHash && !error;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-12px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl">
        <DialogTitle className="sr-only">Cancel marketplace {resolvedVariant}</DialogTitle>
        <DialogDescription className="sr-only">
          Cancel this onchain marketplace {resolvedVariant} and remove it from active trading.
        </DialogDescription>

        {/* ── Success ── */}
        {isSuccess ? (
          <div className="flex flex-col items-center gap-5 p-6 py-8">
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-500" />
            </div>
            {order?.token?.image && (
              <div className="h-24 w-24 rounded-2xl overflow-hidden border border-border shadow-md">
                <Image
                  src={ipfsToHttp(order.token.image)}
                  alt={order.token?.name || `Token #${order?.nftTokenId}`}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            )}
            <div className="text-center space-y-1">
              <p className="font-bold text-xl capitalize">{resolvedVariant} cancelled</p>
              <p className="text-sm text-muted-foreground">
                Your {resolvedVariant} for{" "}
                <span className="font-medium text-foreground">
                  {order?.token?.name || `Token #${order?.nftTokenId}`}
                </span>{" "}
                has been removed.
              </p>
            </div>
            {txHash ? <MarketplaceTxLink txHash={txHash} explorerUrl={EXPLORER_URL} /> : null}
            <Button className="w-full" onClick={() => onOpenChange(false)}>Done</Button>
          </div>

        ) : isProcessing ? (
          /* ── Processing ── */
          <MarketplaceProcessingState
            title="Submitting cancellation..."
            description="Confirm the wallet prompt and keep this window open."
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
          />

        ) : (
          /* ── Confirm ── */
          order && (
            <div className="space-y-0">
              <TokenHero order={order} variant={resolvedVariant} />
              <div className="px-6 pb-6 pt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will remove your {resolvedVariant} from the marketplace. This action cannot be undone.
                </p>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                    <X className="h-4 w-4 mr-1.5" />Keep it
                  </Button>
                  <Button variant="destructive" className="flex-1 h-11" onClick={handleConfirm}>
                    Cancel {resolvedVariant}
                  </Button>
                </div>
              </div>
            </div>
          )
        )}

      </DialogContent>
    </Dialog>
  );
}
