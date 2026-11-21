"use client";

import { useState } from "react";
import { useOnOpen } from "@medialane/ui/utils/use-on-open";
import { useRouter } from "next/navigation";
import { AlertCircle, ShoppingCart } from "lucide-react";
import { useConfetti } from "@medialane/ui/utils/use-confetti";
import { orderTotal, type CheckoutItem } from "@/lib/checkout";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@medialane/ui/dialog";
import { Button } from "@medialane/ui/button";
import { Alert, AlertDescription } from "@medialane/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { ConnectWallet } from "@/components/ConnectWallet";
import { resolveImage } from "@/lib/utils";
import { assetHref } from "@/lib/routes";
import { ActionButton, isBusyPhase, PurchasePanel, TransactionDialogStates, successMessages, type TransactionPhase } from "@medialane/ui";
import { normalizeAddress } from "@medialane/sdk";
import type { ApiOrder } from "@medialane/sdk";
import { createSwapIntent } from "@/lib/swap-calls";
import { getMedialaneClient } from "@/lib/medialane-client";

interface PurchaseDialogProps {
  order: ApiOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PurchaseDialog({ order, open, onOpenChange, onSuccess }: PurchaseDialogProps) {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { checkoutCart, phase: writePhase, txHash, error, resetState } = useMarketplace();

  const isOwnOrder =
    isConnected &&
    !!address &&
    normalizeAddress("STARKNET", order.offerer) === normalizeAddress("STARKNET", address);
  const [preparing, setPreparing] = useState(false);
  const phase: TransactionPhase = preparing ? "preparing" : writePhase;
  const busy = isBusyPhase(phase);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentSymbol, setPaymentSymbol] = useState<string | null>(null);
  const isERC1155 = order.offer.itemType === "ERC1155";

  const assetName = order.token?.name || `Token #${order.nftTokenId}`;
  const assetImage = resolveImage(order.token?.image);
  const swapFrom = paymentSymbol && paymentSymbol !== order.price?.currency ? paymentSymbol : null;

  useOnOpen(open, () => {
    resetState();
    setQuantity(1);
    setPaymentSymbol(null);
  });

  useConfetti(phase === "success");

  const handleBuy = async () => {
    setBuyError(null);
    if (!isConnected) return;
    if (isOwnOrder) {
      setBuyError("This is your own listing, so you cannot buy it.");
      return;
    }
    if (!paymentSymbol) return;

    let swap: Awaited<ReturnType<typeof createSwapIntent>> | undefined;
    if (swapFrom && order.price?.currency && address) {
      setPreparing(true);
      try {
        swap = await createSwapIntent(getMedialaneClient(), {
          sellSymbol: swapFrom,
          buySymbol: order.price.currency,
          buyAmountRaw: getMedialaneClient().purchaseCost(order, quantity).total.toString(),
          takerAddress: address,
        });
      } catch {
        setBuyError("The price moved before the swap could be prepared. Please try again.");
        return;
      } finally {
        setPreparing(false);
      }
    }

    const item: CheckoutItem = {
      orderHash: order.orderHash,
      considerationToken: order.consideration.token,
      considerationAmount: orderTotal(order, quantity).toString(),
      offerIdentifier: order.offer.identifier,
      isERC1155,
      quantity: quantity.toString(),
    };
    const hash = await checkoutCart([item], swap);
    if (hash) onSuccess?.();
  };

  const handleClose = (nextOpen: boolean) => {
    if (!busy) onOpenChange(nextOpen);
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-12px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl">
        <DialogTitle className="sr-only">Complete purchase</DialogTitle>
        <DialogDescription className="sr-only">
          Review the asset, price, quantity, and transaction status for this marketplace purchase.
        </DialogDescription>
        <TransactionDialogStates
          phase={phase}
          asset={{ name: assetName, image: assetImage }}
          statusMessage="Confirming purchase..."
          statusDescription="Approve the wallet prompts and keep this window open."
          txHash={txHash}
          error={error}
          success={successMessages.purchased({ name: order.token?.name ?? "the asset", quantity: isERC1155 ? quantity : 1 })}
          successActions={[
            { label: "View asset", href: assetHref("STARKNET", order.nftContract, order.nftTokenId), onClick: handleDone },
            { label: "View portfolio", onClick: handleViewPortfolio },
          ]}
          errorTitle="Purchase failed"
          errorDescription="The transaction was submitted, but the purchase could not be completed."
          onRetry={resetState}
          onDone={() => onOpenChange(false)}
        >
            <PurchasePanel
              order={order}
              image={assetImage}
              quantity={quantity}
              onQuantityChange={setQuantity}
              walletAddress={isConnected && !isOwnOrder ? address ?? null : null}
              payWith={paymentSymbol}
              onPayWithChange={setPaymentSymbol}
              error={buyError ?? error}
            >
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
                <ActionButton solid onClick={handleBuy} disabled={busy || !paymentSymbol} className="w-full">
                  <ShoppingCart className="h-4 w-4" />
                  Buy now
                </ActionButton>
              ) : (
                <div className="space-y-2">
                  <ActionButton solid big asChild className="w-full">
                    <ConnectWallet label="Connect wallet to trade" />
                  </ActionButton>
                  <p className="text-center text-xs text-muted-foreground">
                    Your Starknet wallet is required to sign and complete the trade.
                  </p>
                </div>
              )}
            </PurchasePanel>
        </TransactionDialogStates>
      </DialogContent>
    </Dialog>
  );
}
