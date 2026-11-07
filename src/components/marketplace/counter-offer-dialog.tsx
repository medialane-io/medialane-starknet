"use client";

import { useForm } from "react-hook-form";
import { useUsdPrices } from "@medialane/ui/utils/use-usd-prices";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, ArrowLeftRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@medialane/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@medialane/ui/form";
import { Button } from "@medialane/ui/button";
import { Input } from "@medialane/ui/input";
import { Alert, AlertDescription } from "@medialane/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { DURATION_OPTIONS } from "@/lib/constants";
import { resolveImage } from "@/lib/utils";
import { orderFormSchema } from "@/lib/order-form";
import { useOnOpen } from "@medialane/ui/utils/use-on-open";
import {
  DurationPicker,
  isBusyPhase,
  MarketplaceDialogHero,
  TransactionDialogStates,
  successMessages,
  usdValueFor,
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
  const { makeOffer, phase, txHash, error, resetState } = useMarketplace();
  const busy = isBusyPhase(phase);

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

  const name = tokenName || `#${tokenId}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-6px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl flex flex-col max-h-[92svh]">
        <DialogTitle className="sr-only">Counter offer</DialogTitle>
        <DialogDescription className="sr-only">
          Propose a different price to the buyer with a new onchain offer.
        </DialogDescription>

        <TransactionDialogStates
          phase={phase}
          asset={{ name, image: tokenImage }}
          statusMessage="Submitting counter-offer…"
          txHash={txHash}
          error={error}
          success={successMessages.countered({ name, price: `${form.getValues("price")} ${currencySymbol}` })}
          successActions={[{ label: "Done", onClick: () => { onOpenChange(false); onSuccess?.(); } }]}
          errorTitle="Counter-offer failed"
          errorDescription="The transaction was submitted, but the counter-offer could not be completed."
          onRetry={resetState}
          onDone={() => onOpenChange(false)}
        >
          <MarketplaceDialogHero
            tokenImage={tokenImage}
            tokenName={tokenName}
            tokenId={tokenId}
            fallbackIcon={<ArrowLeftRight className="h-12 w-12 text-brand-blue/30" />}
          />
          <div className="px-5 pb-5 pt-3 space-y-4">
            <div className="min-w-0">
              <p className="font-bold text-base leading-tight truncate">{name}</p>
              {currentBid && <p className="mt-1 text-xs text-muted-foreground">Current bid: {currentBid}</p>}
            </div>
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
                          <DurationPicker options={DURATION_OPTIONS} value={field.value} onChange={field.onChange} disabled={busy} cols={4} />
                        </FormControl>
                      </FormItem>
                    )} />
                    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                    <Button type="submit" className="w-full h-11" disabled={busy || !isConnected}>
                      <ArrowLeftRight className="h-4 w-4 mr-2" />Submit counter-offer
                    </Button>
                  </form>
                </Form>
          </div>
        </TransactionDialogStates>
      </DialogContent>
    </Dialog>
  );
}
