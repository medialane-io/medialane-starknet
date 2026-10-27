"use client";

import { useForm } from "react-hook-form";
import { useUsdPrices } from "@/hooks/use-usd-prices";
import { usdValueFor } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@medialane/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@medialane/ui/form";
import { Button } from "@medialane/ui/button";
import { Input } from "@medialane/ui/input";
import { Alert, AlertDescription } from "@medialane/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { EXPLORER_URL, DURATION_OPTIONS } from "@/lib/constants";
import { resolveImage } from "@/lib/utils";
import { orderFormSchema } from "@/lib/order-form";
import { useOnOpen } from "@/hooks/use-on-open";
import {
  DurationPicker,
  MarketplaceSuccessState,
  MarketplaceProcessingState,
} from "@medialane/ui";

const schema = orderFormSchema.pick({ price: true, durationSeconds: true }).extend({ message: z.string().optional() });
type FormValues = z.infer<typeof schema>;

interface CounterOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nftContract: string;
  tokenId: string;
  originalOrderHash: string;
  tokenName?: string;
  tokenImage?: string | null;
  currentBid?: string;
  currencySymbol: string;
  currencyDecimals: number;
  onSuccess?: () => void;
}

export function CounterOfferDialog({
  open, onOpenChange, nftContract, tokenId, tokenName, tokenImage: tokenImageRaw,
  currentBid, currencySymbol, onSuccess,
}: CounterOfferDialogProps) {
  const tokenImage = resolveImage(tokenImageRaw);
  const { isConnected } = useWallet();
  const { makeOffer, isProcessing, isConfirmed, txHash, error, resetState } = useMarketplace();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { price: "", durationSeconds: 604800, message: "" },
  });

  const usdPrices = useUsdPrices();
  const watchedPrice = form.watch("price");
  const usdEquivalent = usdValueFor(watchedPrice || undefined, currencySymbol, usdPrices);

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) return;
    await makeOffer(nftContract, tokenId, values.price, currencySymbol, values.durationSeconds);
  };

  useOnOpen(open, () => { resetState(); form.reset(); });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        {isConfirmed ? (
          <MarketplaceSuccessState
            title="Counter-offer submitted!"
            description={`Your counter on ${tokenName || `#${tokenId}`} is live.`}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            name={tokenName || `#${tokenId}`}
            tokenImage={tokenImage}
            onDone={() => { onOpenChange(false); onSuccess?.(); }}
          />
        ) : isProcessing ? (
          <MarketplaceProcessingState title="Submitting counter-offer…" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Counter offer</DialogTitle>
              {currentBid && <DialogDescription>Current bid: {currentBid}</DialogDescription>}
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your offer ({currencySymbol})</FormLabel>
                    <FormControl>
                      <Input type="number" step="any" placeholder="0.00" {...field} />
                    </FormControl>
                    {usdEquivalent && (
                      <p className="text-xs text-muted-foreground">≈ {usdEquivalent}</p>
                    )}
                    <FormMessage />
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
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full h-11" disabled={isProcessing || !isConnected}>
                  <ArrowLeftRight className="h-4 w-4 mr-2" />Submit counter-offer
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
