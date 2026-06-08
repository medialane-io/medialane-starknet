"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { EXPLORER_URL, DURATION_OPTIONS } from "@/lib/constants";
import {
  DurationPicker,
  MarketplaceSuccessState,
  MarketplaceProcessingState,
} from "@/components/marketplace/marketplace-dialog-primitives";

const schema = z.object({
  price: z.string().min(1, "Price required").refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be positive"),
  durationSeconds: z.number().min(86400),
  message: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface CounterOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nftContract: string;
  tokenId: string;
  originalOrderHash: string;
  tokenName?: string;
  currentBid?: string;
  currencySymbol: string;
  currencyDecimals: number;
  onSuccess?: () => void;
}

export function CounterOfferDialog({
  open, onOpenChange, nftContract, tokenId, tokenName,
  currentBid, currencySymbol, onSuccess,
}: CounterOfferDialogProps) {
  const { isConnected } = useWallet();
  const { makeOffer, isProcessing, txHash, error, resetState } = useMarketplace();
  const [done, setDone] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { price: "", durationSeconds: 604800, message: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    try {
      await makeOffer(nftContract, tokenId, values.price, currencySymbol, values.durationSeconds, undefined, { silent: true });
      setDone(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Counter-offer failed");
    }
  };

  useEffect(() => {
    if (open) { resetState(); form.reset(); setDone(false); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isProcessing) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <MarketplaceSuccessState
            title="Counter-offer submitted!"
            description={`Your counter on ${tokenName || `#${tokenId}`} is live.`}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            name={tokenName || `#${tokenId}`}
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
