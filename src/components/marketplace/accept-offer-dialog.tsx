"use client";

import { RewardEarned } from "@medialane/ui";

import { useOnOpen } from "@/hooks/use-on-open";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, DollarSign } from "lucide-react";
import { useConfetti } from "@/hooks/use-confetti";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@medialane/ui/dialog";
import { Button } from "@medialane/ui/button";
import { useMarketplace } from "@/hooks/use-marketplace";
import { EXPLORER_URL } from "@/lib/constants";
import { formatDisplayPrice, resolveImage } from "@/lib/utils";
import { CurrencyIcon } from "@medialane/ui/currency-icon";
import {
  MarketplaceErrorState,
  MarketplaceProcessingState,
  TransactionSuccess,
  successMessages,
} from "@medialane/ui";
import type { ApiOrder } from "@medialane/sdk";

interface AcceptOfferDialogProps {
  order: ApiOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AcceptOfferDialog({ order, open, onOpenChange, onSuccess }: AcceptOfferDialogProps) {
  const router = useRouter();
  const { acceptOffer, isProcessing, isConfirmed, txHash, error, resetState } = useMarketplace();
  const step = isProcessing ? "processing" : isConfirmed ? "success" : error ? "error" : "confirm";

  useOnOpen(open, resetState);
  useConfetti(isConfirmed);

  if (!order) return null;

  const image = resolveImage(order.token?.image);
  const name = order.token?.name || `#${order.nftTokenId}`;
  const tokenStandard = order.consideration?.itemType;

  const handleAccept = async () => {
    const hash = await acceptOffer(order.orderHash, tokenStandard);
    if (hash) onSuccess?.();
  };

  const handleClose = (nextOpen: boolean) => {
    if (step !== "processing") onOpenChange(nextOpen);
  };

  const handleDone = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[calc(100%-12px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl"
        onInteractOutside={step === "processing" ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={step === "processing" ? (e) => e.preventDefault() : undefined}
        {...(step === "processing" ? { hideClose: true } : {})}
      >
        <DialogTitle className="sr-only">
          {step === "success" ? "Offer accepted!" : step === "error" ? "Offer acceptance failed" : "Accept offer"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Review the offer price and transaction status before accepting this marketplace offer.
        </DialogDescription>

        {step === "confirm" && (
          <div className="flex flex-col">

            <div className="flex flex-col items-center gap-3 px-5 pt-6 shrink-0">
              <div className="relative h-32 w-32 rounded-2xl overflow-hidden border border-border bg-muted">
                {image ? (
                  <Image src={image} alt={name} fill sizes="128px" className="h-full w-full object-cover" unoptimized />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/20 via-brand-purple/10 to-transparent flex items-center justify-center">
                    <DollarSign className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="text-center min-w-0 max-w-full">
                <p className="font-bold text-base leading-tight truncate">{name}</p>
                <p className="text-muted-foreground text-xs mt-0.5">Accept this offer to sell</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">

              <div className="rounded-xl border border-border divide-y divide-border text-sm">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">You receive</span>
                  <span className="font-bold flex items-center gap-1.5">
                    <CurrencyIcon symbol={order.price?.currency} size={13} />
                    {formatDisplayPrice(order.price?.formatted)} {order.price?.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Offer from</span>
                  <span className="tabular-nums text-xs">
                    {order.offerer.slice(0, 8)}…{order.offerer.slice(-6)}
                  </span>
                </div>
              </div>

              <div className="btn-border-animated p-[1px] rounded-xl">
                <Button
                  className="w-full h-12 text-base font-semibold text-white rounded-[11px] bg-background/30"
                  onClick={handleAccept}
                  disabled={isProcessing}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept & sell
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "processing" && (
          <MarketplaceProcessingState
            title="Accepting offer..."
            description="Approve the wallet prompts and keep this window open."
            imageUrl={image}
            imageAlt={name}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
          />
        )}

        {step === "success" && (
          <TransactionSuccess
            name={name}
            image={image}
            {...successMessages.accepted({ name, price: `${formatDisplayPrice(order.price?.formatted)} ${order.price?.currency}` })}
            txHash={txHash}
            actions={[
              { label: "Done", onClick: handleDone },
              { label: "View portfolio", onClick: () => { handleDone(); router.push("/portfolio/assets"); } },
            ]}
          >
            <RewardEarned actionType="offer_accepted_seller" />
          </TransactionSuccess>
        )}

        {step === "error" && (
          <MarketplaceErrorState
            tokenImage={image}
            name={name}
            title="Offer acceptance failed"
            description="The transaction could not be completed. Your asset is still yours."
            error={error}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            onRetry={resetState}
            onDone={handleDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
