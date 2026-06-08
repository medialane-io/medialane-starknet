"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, HandCoins, Layers, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { fireConfetti } from "@/lib/confetti";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { EXPLORER_URL, DURATION_OPTIONS } from "@/lib/constants";
import { getListableTokens } from "@medialane/sdk";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import {
  CurrencyPicker,
  DurationPicker,
  MarketplaceErrorState,
  MarketplaceSuccessState,
  MarketplaceProcessingState,
  MarketplaceDialogHero,
} from "@/components/marketplace/marketplace-dialog-primitives";

const CURRENCIES = getListableTokens().map((t) => t.symbol);

const schema = z.object({
  price: z.string().min(1, "Price required").refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be positive"),
  currency: z.string().refine((v) => getListableTokens().some((t) => t.symbol === v), "Invalid currency"),
  durationSeconds: z.number().min(86400),
});
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

export function OfferDialog({ open, onOpenChange, assetContract, tokenId, tokenName, tokenStandard, tokenImage, onSuccess }: OfferDialogProps) {
  const { isConnected } = useWallet();
  const { makeOffer, isProcessing, txHash, error, resetState } = useMarketplace();
  const confettiFired = useRef(false);
  const [txStatus, setTxStatus] = useState<"idle" | "confirmed">("idle");
  const name = tokenName || `Token #${tokenId}`;
  const isCancelled = error?.toLowerCase().includes("request cancelled") ?? false;
  const isTerminalError = !isProcessing && !!error && !!txHash;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { price: "", currency: "USDC", durationSeconds: 604800 },
  });

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    const hash = await makeOffer(assetContract, tokenId, values.price, values.currency, values.durationSeconds, tokenStandard, { silent: true });
    if (hash) setTxStatus("confirmed");
  };

  useEffect(() => {
    if (txStatus === "confirmed" && !confettiFired.current) { confettiFired.current = true; fireConfetti(); }
    if (txStatus !== "confirmed") confettiFired.current = false;
  }, [txStatus]);

  useEffect(() => {
    if (open) { resetState(); form.reset(); setTxStatus("idle"); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-6px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl flex flex-col max-h-[92svh]">
        <DialogTitle className="sr-only">Make an offer on {name}</DialogTitle>
        <DialogDescription className="sr-only">
          Set an amount, currency, and expiry to submit an onchain marketplace offer.
        </DialogDescription>
        {txStatus === "confirmed" ? (
          <MarketplaceSuccessState
            title="Offer live!"
            description={
              <>
                Your offer on <span className="font-medium text-foreground">{name}</span> is now active.
              </>
            }
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            tokenImage={tokenImage}
            name={name}
            onDone={() => { onOpenChange(false); onSuccess?.(); }}
          />
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
              badge={
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white drop-shadow font-bold text-lg leading-tight truncate">{name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Zap className="h-3 w-3 text-emerald-300 drop-shadow" />
                      <span className="text-[11px] font-medium text-emerald-200 drop-shadow">Wallet offer</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                    #{tokenId}
                  </span>
                </div>
              }
            />
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
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency</FormLabel>
                      <FormControl>
                        <CurrencyPicker currencies={CURRENCIES} value={field.value} onChange={field.onChange} disabled={isProcessing} />
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
                      <p className="text-[10px] text-center text-muted-foreground">
                        Offers can be cancelled before acceptance and settle atomically if the owner accepts. Gas is sponsored when available.
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
