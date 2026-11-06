"use client";

import { useOnOpen } from "@/hooks/use-on-open";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { useConfetti } from "@/hooks/use-confetti";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@medialane/ui/dialog";
import { useMarketplace } from "@/hooks/use-marketplace";
import { formatDisplayPrice, resolveImage } from "@/lib/utils";
import { CurrencyIcon } from "@medialane/ui/currency-icon";
import {
  isBusyPhase,
  MarketplaceConfirmStep,
  MarketplaceDialogHero,
  RewardEarned,
  TransactionDialogStates,
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
  const { acceptOffer, phase, txHash, error, resetState } = useMarketplace();
  const busy = isBusyPhase(phase);

  useOnOpen(open, resetState);
  useConfetti(phase === "success");

  if (!order) return null;

  const image = resolveImage(order.token?.image);
  const name = order.token?.name || `#${order.nftTokenId}`;
  const tokenStandard = order.consideration?.itemType;
  const priceLabel = `${formatDisplayPrice(order.price?.formatted)} ${order.price?.currency}`;

  const handleAccept = async () => {
    const hash = await acceptOffer(order.orderHash, tokenStandard);
    if (hash) onSuccess?.();
  };

  const handleClose = (nextOpen: boolean) => {
    if (!busy) onOpenChange(nextOpen);
  };

  const handleDone = () => {
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-[calc(100%-12px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl"
        onInteractOutside={busy ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={busy ? (e) => e.preventDefault() : undefined}
        {...(busy ? { hideClose: true } : {})}
      >
        <DialogTitle className="sr-only">
          {phase === "success" ? "Offer accepted!" : "Accept offer"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Review the offer price and transaction status before accepting this marketplace offer.
        </DialogDescription>

        <TransactionDialogStates
          phase={phase}
          asset={{ name, image }}
          statusMessage="Accepting offer..."
          statusDescription="Approve the wallet prompts and keep this window open."
          txHash={txHash}
          error={error}
          success={successMessages.accepted({ name, price: priceLabel })}
          successActions={[
            { label: "Done", onClick: handleDone },
            { label: "View portfolio", onClick: () => { handleDone(); router.push("/portfolio/assets"); } },
          ]}
          successChildren={<RewardEarned actionType="offer_accepted_seller" />}
          errorTitle="Offer acceptance failed"
          errorDescription="The transaction could not be completed. Your asset is still yours."
          onRetry={resetState}
          onDone={handleDone}
        >
          <MarketplaceDialogHero
            tokenImage={image}
            tokenName={name}
            tokenId={order.nftTokenId ?? ""}
            fallbackIcon={<HandCoins className="h-10 w-10 text-muted-foreground" />}
          />
          <MarketplaceConfirmStep
            summary={
              <div className="rounded-xl border border-border divide-y divide-border text-sm">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">You receive</span>
                  <span className="font-bold flex items-center gap-1.5">
                    <CurrencyIcon symbol={order.price?.currency} size={13} />
                    {priceLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Offer from</span>
                  <span className="tabular-nums text-xs">
                    {order.offerer.slice(0, 8)}…{order.offerer.slice(-6)}
                  </span>
                </div>
              </div>
            }
            description="Accept this offer to sell"
            error={error}
            secondaryLabel="Cancel"
            onSecondary={() => onOpenChange(false)}
            primaryLabel="Accept & sell"
            onPrimary={handleAccept}
          />
        </TransactionDialogStates>
      </DialogContent>
    </Dialog>
  );
}
