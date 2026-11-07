"use client";

import { useOnOpen } from "@medialane/ui/utils/use-on-open";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@medialane/ui/dialog";
import { useMarketplace } from "@/hooks/use-marketplace";
import { resolveImage } from "@/lib/utils";
import {
  isBusyPhase,
  MarketplaceConfirmStep,
  OrderSummaryHero,
  TransactionDialogStates,
  successMessages,
} from "@medialane/ui";
import type { ApiOrder } from "@medialane/sdk";

interface CancelOrderDialogProps {
  order: ApiOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;

  variant?: "listing" | "offer";
}

export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
  variant,
}: CancelOrderDialogProps) {
  const { cancelOrder, phase, txHash, error, resetState } = useMarketplace();
  const image = resolveImage(order?.token?.image);

  const resolvedVariant: "listing" | "offer" =
    variant ?? (order?.offer.itemType === "ERC721" || order?.offer.itemType === "ERC1155" ? "listing" : "offer");

  const tokenStandard =
    order?.offer.itemType === "ERC1155" || order?.consideration.itemType === "ERC1155"
      ? "ERC1155"
      : "ERC721";

  useOnOpen(open, resetState);

  const handleConfirm = async () => {
    if (!order) return;
    const hash = await cancelOrder(order.orderHash, tokenStandard);
    if (hash) onSuccess?.();
  };


  const name = order?.token?.name || `Token #${order?.nftTokenId}`;
  const kindLabel = resolvedVariant === "listing" ? "Listing" : "Offer";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isBusyPhase(phase)) onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-12px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl">
        <DialogTitle className="sr-only">Cancel marketplace {resolvedVariant}</DialogTitle>
        <DialogDescription className="sr-only">
          Cancel this onchain marketplace {resolvedVariant} and remove it from active trading.
        </DialogDescription>

        <TransactionDialogStates
          phase={phase}
          statusMessage="Submitting cancellation..."
          txHash={txHash}
          error={error}
          success={successMessages.cancelled({ kind: resolvedVariant })}
          asset={{ name, image }}
          errorTitle={`${kindLabel} cancellation failed`}
          errorDescription={`The transaction was submitted, but this ${resolvedVariant} could not be cancelled.`}
          onRetry={resetState}
          onDone={() => onOpenChange(false)}
        >
          {order && (
            <div className="space-y-0">
              <OrderSummaryHero
                name={name}
                image={image}
                subtitle={<span className="capitalize">Cancel {resolvedVariant}</span>}
                tone="destructive"
                price={order.price}
              />
              <MarketplaceConfirmStep
                description={`This will remove your ${resolvedVariant} from the marketplace. This action cannot be undone.`}
                error={error}
                secondaryLabel="Keep it"
                onSecondary={() => onOpenChange(false)}
                primaryLabel={`Cancel ${resolvedVariant}`}
                onPrimary={handleConfirm}
                primaryVariant="destructive"
              />
            </div>
          )}
        </TransactionDialogStates>
      </DialogContent>
    </Dialog>
  );
}
