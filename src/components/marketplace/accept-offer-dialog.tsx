"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, DollarSign } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMarketplace } from "@/hooks/use-marketplace";
import { EXPLORER_URL } from "@/lib/constants";
import { formatDisplayPrice, ipfsToHttp } from "@/lib/utils";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import {
  MarketplaceTxLink,
  MarketplaceSuccessState,
  MarketplaceErrorState,
} from "@/components/marketplace/marketplace-dialog-primitives";
import type { ApiOrder } from "@medialane/sdk";

interface AcceptOfferDialogProps {
  order: ApiOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = "confirm" | "processing" | "success" | "error";

export function AcceptOfferDialog({ order, open, onOpenChange, onSuccess }: AcceptOfferDialogProps) {
  const router = useRouter();
  const { acceptOffer, isProcessing, txHash, error, resetState } = useMarketplace();
  const [step, setStep] = useState<Step>("confirm");
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      resetState();
      setStep("confirm");
      setSuccessTxHash(null);
      setLocalError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!order) return null;

  const image = order.token?.image ? ipfsToHttp(order.token.image) : null;
  const name = order.token?.name || `#${order.nftTokenId}`;
  const tokenStandard = order.consideration?.itemType;

  const handleAccept = async () => {
    try {
      setStep("processing");
      setLocalError(null);
      const hash = await acceptOffer(
        order.orderHash,
        order.nftContract ?? "",
        order.nftTokenId ?? "",
        tokenStandard
      );
      if (hash) {
        setSuccessTxHash(hash);
        setStep("success");
        fireConfetti();
        onSuccess?.();
      } else {
        setLocalError(error || "Transaction failed");
        setStep("error");
      }
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Transaction failed");
      setStep("error");
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (step !== "processing") onOpenChange(nextOpen);
  };

  const handleDone = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  const handleRetry = () => {
    setStep("confirm");
    setLocalError(null);
    resetState();
  };

  const resolvedTxHash = successTxHash ?? txHash;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-sm p-0 overflow-hidden"
        onInteractOutside={step === "processing" ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={step === "processing" ? (e) => e.preventDefault() : undefined}
        {...(step === "processing" ? { hideClose: true } : {})}
      >
        <DialogTitle className="sr-only">
          {step === "success" ? "Offer accepted!" : step === "error" ? "Offer acceptance failed" : "Accept offer"}
        </DialogTitle>

        {/* ── Confirm ── */}
        {step === "confirm" && (
          <div className="flex flex-col">
            {/* Asset hero */}
            <div className="relative h-40 w-full bg-muted overflow-hidden shrink-0">
              {image ? (
                <Image src={image} alt={name} fill sizes="384px" className="h-full w-full object-cover" unoptimized />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent flex items-center justify-center">
                  <DollarSign className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <p className="text-white font-bold text-base leading-tight truncate">{name}</p>
                <p className="text-white/70 text-xs mt-0.5">Accept this offer to sell</p>
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Offer details */}
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
                  <span className="font-mono text-xs">
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

        {/* ── Processing ── */}
        {step === "processing" && (
          <div className="flex flex-col items-center gap-5 p-6 py-10">
            {image ? (
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-border shadow-md">
                <Image src={image} alt={name} width={80} height={80} className="h-full w-full object-cover" unoptimized />
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                </div>
              </div>
            ) : (
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            )}
            <div className="text-center space-y-1">
              <p className="font-bold text-lg">Accepting offer…</p>
              <p className="text-sm text-muted-foreground">Sign in your wallet and keep this window open.</p>
            </div>
            {txHash ? <MarketplaceTxLink txHash={txHash} explorerUrl={EXPLORER_URL} /> : null}
          </div>
        )}

        {/* ── Success ── */}
        {step === "success" && (
          <MarketplaceSuccessState
            tokenImage={image}
            name={name}
            title="Sold!"
            description={
              <>
                <span className="font-medium text-foreground">{name}</span> sold for{" "}
                <span className="font-semibold text-foreground">
                  {formatDisplayPrice(order.price?.formatted)} {order.price?.currency}
                </span>
              </>
            }
            txHash={resolvedTxHash}
            explorerUrl={EXPLORER_URL}
            onDone={handleDone}
            footer={
              <Button variant="outline" className="w-full h-11" onClick={() => { handleDone(); router.push("/portfolio/assets"); }}>
                View portfolio
              </Button>
            }
          />
        )}

        {/* ── Error ── */}
        {step === "error" && (
          <MarketplaceErrorState
            tokenImage={image}
            name={name}
            title="Transaction failed"
            description="The offer could not be accepted. Please try again."
            error={localError ?? error}
            txHash={resolvedTxHash}
            explorerUrl={EXPLORER_URL}
            onRetry={handleRetry}
            onDone={handleDone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
