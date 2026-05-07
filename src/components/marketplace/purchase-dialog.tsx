"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AlertCircle, ShoppingCart } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { ConnectWallet } from "@/components/ConnectWallet";
import { EXPLORER_URL } from "@/lib/constants";
import { formatDisplayPrice, ipfsToHttp } from "@/lib/utils";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import {
  MarketplaceSuccessState,
  MarketplaceProcessingState,
} from "@/components/marketplace/marketplace-dialog-primitives";
import type { ApiOrder } from "@medialane/sdk";

interface PurchaseDialogProps {
  order: ApiOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function PurchaseDialog({ order, open, onOpenChange, onSuccess }: PurchaseDialogProps) {
  const { isConnected } = useUnifiedWallet();
  const { checkoutCart, isProcessing, txHash, error, resetState } = useMarketplace();
  const confettiFired = useRef(false);
  const [txStatus, setTxStatus] = useState<"idle" | "confirmed">("idle");
  const isERC1155 = order.offer.itemType === "ERC1155";
  const maxQty = isERC1155 && order.remainingAmount ? parseInt(order.remainingAmount, 10) : 1;
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (txStatus === "confirmed" && !confettiFired.current) { confettiFired.current = true; fireConfetti(); }
    if (txStatus !== "confirmed") confettiFired.current = false;
  }, [txStatus]);

  useEffect(() => {
    if (open) { resetState(); setTxStatus("idle"); setQuantity(1); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuy = async () => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    try {
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
      if (hash) setTxStatus("confirmed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    }
  };

  const price = order.price;
  const tokenName = order.token?.name || `Token #${order.nftTokenId}`;
  const tokenImg = order.token?.image ? ipfsToHttp(order.token.image) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        {txStatus === "confirmed" ? (
          <MarketplaceSuccessState
            title="Purchase confirmed!"
            description="The asset is now yours."
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            tokenImage={tokenImg}
            name={tokenName}
            onDone={() => { onOpenChange(false); onSuccess?.(); }}
          />
        ) : isProcessing ? (
          <MarketplaceProcessingState title="Processing purchase…" imageUrl={tokenImg} imageAlt={tokenName} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{isConnected ? "Complete purchase" : "Connect wallet to trade"}</DialogTitle>
              <DialogDescription>
                {isConnected
                  ? "Confirm the details below to buy this asset."
                  : "Connect your wallet first, then you can confirm this purchase."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {tokenImg && (
                <img src={tokenImg} alt={tokenName} className="w-full aspect-square object-cover rounded-xl" />
              )}
              {price && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">{isERC1155 ? "Price per edition" : "Price"}</span>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CurrencyIcon symbol={price.currency} size={14} />
                    <span>{price.formatted ?? formatDisplayPrice(price.raw ?? "")}</span>
                    <span className="text-xs text-muted-foreground">{price.currency}</span>
                  </div>
                </div>
              )}
              {isERC1155 && maxQty > 1 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Quantity</span>
                    <span className="text-muted-foreground">{order.remainingAmount} available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
                      <span className="text-lg leading-none">−</span>
                    </Button>
                    <Input type="number" min={1} max={maxQty} value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(maxQty, parseInt(e.target.value, 10) || 1)))}
                      className="h-8 text-center" />
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0"
                      onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty}>
                      <span className="text-lg leading-none">+</span>
                    </Button>
                  </div>
                </div>
              )}
              {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
              {isConnected ? (
                <div className="btn-border-animated p-[1px] rounded-xl">
                  <Button
                    className="w-full h-12 text-base font-semibold text-white rounded-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-background/30"
                    onClick={handleBuy}
                    disabled={isProcessing}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />Buy now
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ConnectWallet
                    label="Connect wallet to trade"
                    className="w-full h-12 text-base font-semibold rounded-[11px] bg-primary text-primary-foreground hover:bg-primary/90"
                  />
                  <p className="text-center text-xs text-muted-foreground">
                    Your wallet is required to sign and complete the trade.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
