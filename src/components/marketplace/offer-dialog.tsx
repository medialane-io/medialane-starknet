"use client";

import { RewardEarned } from "@medialane/ui";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, HandCoins, Layers, ShieldCheck, Zap } from "lucide-react";
import { useConfetti } from "@/hooks/use-confetti";
import { useOnOpen } from "@/hooks/use-on-open";
import { LISTABLE_CURRENCIES, orderFormSchema } from "@/lib/order-form";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@medialane/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@medialane/ui/form";
import { Button } from "@medialane/ui/button";
import { Input } from "@medialane/ui/input";
import { Alert, AlertDescription } from "@medialane/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { EXPLORER_URL, DURATION_OPTIONS } from "@/lib/constants";
import { resolveImage } from "@/lib/utils";
import { CurrencyIcon } from "@medialane/ui/currency-icon";
import { useUsdPrices } from "@/hooks/use-usd-prices";
import { usdValueFor } from "@/lib/utils";
import {
  CurrencyPicker,
  DurationPicker,
  MarketplaceErrorState,
  TransactionSuccess,
  successMessages,
  MarketplaceProcessingState,
  MarketplaceDialogHero,
} from "@medialane/ui";

const schema = orderFormSchema;
type FormValues = z.infer<typeof schema>;

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
  const { makeOffer, isProcessing, isConfirmed, isTerminalError, txHash, error, resetState } = useMarketplace();
  const name = tokenName || `Token #${tokenId}`;
  const isCancelled = error?.toLowerCase().includes("request cancelled") ?? false;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
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

  useConfetti(isConfirmed);
  useOnOpen(open, () => { resetState(); form.reset(); });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-6px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl flex flex-col max-h-[92svh]">
        <DialogTitle className="sr-only">Make an offer on {name}</DialogTitle>
        <DialogDescription className="sr-only">
          Set an amount, currency, and expiry to submit an onchain marketplace offer.
        </DialogDescription>
        {isConfirmed ? (
          <TransactionSuccess
            name={name}
            image={tokenImage}
            {...successMessages.offered({ name, price: `${form.getValues("price")} ${form.getValues("currency")}` })}
            txHash={txHash}
            actions={[{ label: "Done", onClick: () => { onOpenChange(false); onSuccess?.(); } }]}
          >
            <RewardEarned actionType="make_offer" />
          </TransactionSuccess>
        ) : isTerminalError ? (
          <MarketplaceErrorState
            tokenImage={tokenImage}
            name={name}
            title="Offer failed"
            description="The transaction was submitted, but the offer could not be completed."
            error={error}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            onRetry={() => resetState()}
            onDone={() => onOpenChange(false)}
          />
        ) : isProcessing ? (
          <MarketplaceProcessingState
            title="Submitting offer..."
            description="Confirm the signatures in your wallet and keep this window open."
            imageUrl={tokenImage}
            imageAlt={name}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
          />
        ) : (
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
                  <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer amount</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input type="number" step="any" placeholder="0.00" className="pr-20" {...field} />
                        </FormControl>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                          <CurrencyIcon symbol={form.watch("currency")} size={14} />
                          <span className="text-xs font-bold">{form.watch("currency")}</span>
                        </div>
                      </div>
                      {usdEquivalent && (
                        <p className="text-xs text-muted-foreground mt-1">≈ {usdEquivalent}</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <CurrencyPicker currencies={LISTABLE_CURRENCIES} value={field.value} onChange={field.onChange} disabled={isProcessing} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="durationSeconds" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration</FormLabel>
                      <FormControl>
                        <DurationPicker options={DURATION_OPTIONS} value={field.value} onChange={field.onChange} disabled={isProcessing} cols={4} />
                      </FormControl>
                    </FormItem>
                  )} />
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
                    <Button type="submit" className="w-full h-11" disabled={isProcessing || !isConnected}>
                      <HandCoins className="h-4 w-4 mr-2" />Submit offer
                    </Button>
                    <div className="flex items-start justify-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-2xs text-center text-muted-foreground">
                        You can cancel your offer anytime before it's accepted.
                      </p>
                    </div>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
