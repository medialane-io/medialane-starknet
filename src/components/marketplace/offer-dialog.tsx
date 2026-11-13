"use client";

import { RewardEarned, usdValueFor } from "@medialane/ui";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, HandCoins, Layers, ShieldCheck, Zap } from "lucide-react";
import { useConfetti } from "@medialane/ui/utils/use-confetti";
import { useOnOpen } from "@medialane/ui/utils/use-on-open";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@medialane/ui/dialog";
import { Form } from "@medialane/ui/form";
import { Alert, AlertDescription } from "@medialane/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { DURATION_OPTIONS } from "@/lib/constants";
import { resolveImage } from "@/lib/utils";
import { useUsdPrices } from "@medialane/ui/utils/use-usd-prices";
import {
  OrderFields,
  GradientButton,
  orderFormSchema,
  type OrderFormValues,
  isBusyPhase,
  TransactionDialogStates,
  successMessages,
  MarketplaceDialogHero,
} from "@medialane/ui";

type FormValues = OrderFormValues;

interface OfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetContract: string;
  tokenId: string;
  tokenName?: string;
  tokenStandard?: string;
  tokenImage?: string | null;
  onSuccess?: () => void;
}

export function OfferDialog({ open, onOpenChange, assetContract, tokenId, tokenName, tokenStandard, tokenImage: tokenImageRaw, onSuccess }: OfferDialogProps) {
  const tokenImage = resolveImage(tokenImageRaw);
  const { isConnected } = useWallet();
  const { makeOffer, phase, txHash, error, resetState } = useMarketplace();
  const busy = isBusyPhase(phase);
  const name = tokenName || `Token #${tokenId}`;
  const isCancelled = error?.toLowerCase().includes("request cancelled") ?? false;

  const form = useForm<FormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: { price: "", currency: "USDC", durationSeconds: 604800 },
  });

  const usdPrices = useUsdPrices();
  const watchedPrice = form.watch("price");
  const watchedCurrency = form.watch("currency");
  const usdEquivalent = usdValueFor(watchedPrice || undefined, watchedCurrency, usdPrices);

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) return;
    await makeOffer(assetContract, tokenId, values.price, values.currency, values.durationSeconds, tokenStandard);
  };

  useConfetti(phase === "success");
  useOnOpen(open, () => { resetState(); form.reset(); });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-6px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl flex flex-col max-h-[92svh]">
        <DialogTitle className="sr-only">Make an offer on {name}</DialogTitle>
        <DialogDescription className="sr-only">
          Set an amount, currency, and expiry to submit an onchain marketplace offer.
        </DialogDescription>
        <TransactionDialogStates
          phase={phase}
          asset={{ name, image: tokenImage }}
          statusMessage="Submitting offer..."
          statusDescription="Confirm the signatures in your wallet and keep this window open."
          txHash={txHash}
          error={error}
          success={successMessages.offered({ name, price: `${form.getValues("price")} ${form.getValues("currency")}` })}
          successActions={[{ label: "Done", onClick: () => { onOpenChange(false); onSuccess?.(); } }]}
          successChildren={<RewardEarned actionType="make_offer" />}
          errorTitle="Offer failed"
          errorDescription="The transaction was submitted, but the offer could not be completed."
          onRetry={resetState}
          onDone={() => onOpenChange(false)}
        >
            <div className="flex flex-col">
              <MarketplaceDialogHero
                tokenImage={tokenImage}
                tokenName={tokenName}
                tokenId={tokenId}
                fallbackIcon={<Layers className="h-10 w-10 text-muted-foreground/35" />}
              />
              <div className="flex items-end justify-between gap-3 px-5 pt-4">
                <div className="min-w-0">
                  <p className="font-bold text-lg leading-tight truncate">{name}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Zap className="h-3 w-3 text-emerald-500" />
                    <span className="text-2xs font-medium text-emerald-500">Wallet offer</span>
                  </div>
                </div>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div>
                  <DialogTitle>Make an offer</DialogTitle>
                  <DialogDescription>
                    Choose an amount and expiry. The offer is signed from your wallet and visible to the owner.
                  </DialogDescription>
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <OrderFields form={form} durationOptions={DURATION_OPTIONS} busy={busy} priceLabel="Offer price" />
                    {usdEquivalent && (
                      <p className="text-xs text-muted-foreground -mt-1">≈ {usdEquivalent}</p>
                    )}
                    {error && (
                      <Alert
                        variant={isCancelled ? "default" : "destructive"}
                        className={isCancelled ? "border-border/60 bg-muted/30 text-muted-foreground" : undefined}
                      >
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-3">
                      <GradientButton type="submit" disabled={busy || !isConnected}>
                        <HandCoins className="h-4 w-4" />Submit offer
                      </GradientButton>
                      <div className="flex items-start justify-center gap-1.5">
                        <ShieldCheck className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-2xs text-center text-muted-foreground">
                          Offers can be cancelled anytime before they are accepted.
                        </p>
                      </div>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </TransactionDialogStates>
      </DialogContent>
    </Dialog>
  );
}
