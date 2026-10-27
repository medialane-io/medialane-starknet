"use client";

import { PriceBreakdown, SuccessScreen, TokenHero } from "@/components/marketplace/purchase-parts";
import { useState } from "react";
import { useOnOpen } from "@/hooks/use-on-open";
import { useRouter } from "next/navigation";
import { AlertCircle, Minus, Plus, RefreshCw, ShieldCheck, ShoppingCart } from "lucide-react";
import { useConfetti } from "@/hooks/use-confetti";
import { amountDue, orderTotal, type CheckoutItem } from "@/lib/checkout";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@medialane/ui/dialog";
import { Button } from "@medialane/ui/button";
import { Input } from "@medialane/ui/input";
import { Alert, AlertDescription } from "@medialane/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { ConnectWallet } from "@/components/ConnectWallet";
import { EXPLORER_URL } from "@/lib/constants";
import { resolveImage } from "@/lib/utils";
import { MarketplaceErrorState, MarketplaceTxLink } from "@medialane/ui";
import { normalizeAddress } from "@medialane/sdk";
import type { ApiOrder } from "@medialane/sdk";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { createSwapIntent } from "@/lib/swap-calls";
import { getMedialaneClient } from "@/lib/medialane-client";
import { PayWithPicker } from "@/components/marketplace/pay-with-picker";

interface PurchaseDialogProps {
  order: ApiOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PurchaseDialog({ order, open, onOpenChange, onSuccess }: PurchaseDialogProps) {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { checkoutCart, isProcessing, isConfirmed, isTerminalError, txHash, error, resetState } = useMarketplace();

  const isOwnOrder =
    isConnected &&
    !!address &&
    normalizeAddress("STARKNET", order.offerer) === normalizeAddress("STARKNET", address);
  const [preparing, setPreparing] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [paymentSymbol, setPaymentSymbol] = useState<string | null>(null);
  const isERC1155 = order.offer.itemType === "ERC1155";
  const maxQty = isERC1155
    ? Math.max(1, parseInt(order.remainingAmount ?? order.offer.startAmount ?? "1", 10))
    : 1;

  const requiredRaw = amountDue(order, quantity);
  const { raw: orderCurrencyBalance, isLoading: balanceLoading } = useTokenBalance(
    order.price?.currency ?? "",
    address ?? undefined
  );

  const needsSwap = !balanceLoading && orderCurrencyBalance !== null && orderCurrencyBalance < requiredRaw;
  const canBuy = !needsSwap || !!paymentSymbol;

  useOnOpen(open, () => {
    resetState();
    setQuantity(1);
    setPaymentSymbol(null);
  });

  useConfetti(isConfirmed);

  const handleBuy = async () => {
    setBuyError(null);
    if (!isConnected) return;
    if (isOwnOrder) {
      setBuyError("This is your own listing, so you cannot buy it.");
      return;
    }
    if (needsSwap && !paymentSymbol) return;

    let swap: Awaited<ReturnType<typeof createSwapIntent>> | undefined;
    if (paymentSymbol && order.price?.currency && address) {
      setPreparing(true);
      try {
        swap = await createSwapIntent(getMedialaneClient().api, {
          sellSymbol: paymentSymbol,
          buySymbol: order.price.currency,
          buyAmountRaw: amountDue(order, quantity).toString(),
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-12px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl">
        <DialogTitle className="sr-only">Complete purchase</DialogTitle>
        <DialogDescription className="sr-only">
          Review the asset, price, quantity, and transaction status for this marketplace purchase.
        </DialogDescription>
        {isConfirmed ? (
          <SuccessScreen order={order} quantity={quantity} txHash={txHash} onClose={handleDone} onViewPortfolio={handleViewPortfolio} />
        ) : isTerminalError ? (
          <MarketplaceErrorState
            tokenImage={resolveImage(order.token?.image)}
            name={order.token?.name || `Token #${order.nftTokenId}`}
            title="Purchase failed"
            description="The transaction was submitted, but the purchase could not be completed."
            error={error}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            onRetry={resetState}
            onDone={() => onOpenChange(false)}
          />
        ) : preparing || isProcessing ? (
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
              <PriceBreakdown order={order} quantity={quantity} />

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

              {isConnected && needsSwap && order.price?.currency ? (
                <PayWithPicker
                  orderCurrency={order.price.currency}
                  requiredRaw={requiredRaw}
                  walletAddress={address}
                  selected={paymentSymbol}
                  onSelect={setPaymentSymbol}
                />
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
                  {buyError && <p role="alert" className="text-sm text-destructive">{buyError}</p>}
                  <div className={`btn-border-animated p-[1px] rounded-xl ${!canBuy ? "opacity-50 pointer-events-none" : ""}`}>
                    <Button
                      className="w-full h-12 text-base font-semibold text-white rounded-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-background/30"
                      onClick={handleBuy}
                      disabled={isProcessing || !canBuy}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {needsSwap && !paymentSymbol ? "Select a token to pay with" : "Buy now"}
                    </Button>
                  </div>
                  <div className="flex items-start justify-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-2xs text-center text-muted-foreground">
                      Your asset arrives the moment your wallet confirms the trade.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="btn-border-animated p-[1px] rounded-2xl">
                    <ConnectWallet
                      label="Connect wallet to trade"
                      className="w-full h-12 text-base font-semibold bg-transparent text-white rounded-[15px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98]"
                    />
                  </div>
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
