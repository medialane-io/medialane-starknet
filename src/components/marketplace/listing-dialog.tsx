"use client";

import { RewardEarned } from "@medialane/ui";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, Layers, ShieldCheck, Tag } from "lucide-react";
import { useConfetti } from "@medialane/ui/utils/use-confetti";
import { useOnOpen } from "@medialane/ui/utils/use-on-open";
import { LISTABLE_CURRENCIES, orderFormSchema } from "@/lib/order-form";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@medialane/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@medialane/ui/form";
import { Input } from "@medialane/ui/input";
import { Alert, AlertDescription } from "@medialane/ui/alert";
import { useWallet } from "@/hooks/use-wallet";
import { useMarketplace } from "@/hooks/use-marketplace";
import { DURATION_OPTIONS } from "@/lib/constants";
import { resolveImage } from "@/lib/utils";
import {
  PriceCurrencyInput,
  DurationPicker,
  isBusyPhase,
  TransactionDialogStates,
  successMessages,
  ListingAssetSummary,
} from "@medialane/ui";

const schema = orderFormSchema.extend({ amount: z.string().optional() });
type FormValues = z.infer<typeof schema>;

interface ListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetContract: string;
  tokenId: string;
  tokenName?: string;
  tokenStandard?: string;
  tokenImage?: string | null;
  onSuccess?: () => void;
}

export function ListingDialog({ open, onOpenChange, assetContract, tokenId, tokenName, tokenStandard, tokenImage: tokenImageRaw, onSuccess }: ListingDialogProps) {
  const tokenImage = resolveImage(tokenImageRaw);
  const { isConnected } = useWallet();
  const { createListing, phase, txHash, error, resetState } = useMarketplace();
  const busy = isBusyPhase(phase);
  const is1155 = tokenStandard === "ERC1155";
  const name = tokenName || `Token #${tokenId}`;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { price: "", currency: "USDC", durationSeconds: 63072000, amount: "1" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) return;
    if (is1155) {
      const qty = parseInt(values.amount ?? "", 10);
      if (!values.amount || Number.isNaN(qty) || qty < 1) {
        form.setError("amount", { message: "Enter a quantity of at least 1" });
        return;
      }
    }
    await createListing(
      assetContract,
      tokenId,
      values.price,
      values.currency,
      values.durationSeconds,
      tokenStandard,
      is1155 ? (values.amount?.trim() || "1") : undefined
    );
  };

  useConfetti(phase === "success");
  useOnOpen(open, () => { resetState(); form.reset(); });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-[calc(100%-6px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl flex flex-col max-h-[92svh]">
        <DialogTitle className="sr-only">Sell {name}</DialogTitle>
        <DialogDescription className="sr-only">
          Set pricing, currency, duration, and quantity to create an onchain marketplace listing.
        </DialogDescription>
        <TransactionDialogStates
          phase={phase}
          asset={{ name, image: tokenImage }}
          statusMessage="Submitting listing..."
          statusDescription="Approve the marketplace interaction in your wallet and keep this window open."
          txHash={txHash}
          error={error}
          success={successMessages.listed({ name, price: `${form.getValues("price")} ${form.getValues("currency")}${is1155 && form.getValues("amount") && form.getValues("amount") !== "1" ? ` × ${form.getValues("amount")}` : ""}` })}
          successActions={[{ label: "Done", onClick: () => { onOpenChange(false); onSuccess?.(); } }]}
          successChildren={<RewardEarned actionType="list_asset" />}
          errorTitle="Listing failed"
          errorDescription="The transaction was submitted, but the listing could not be completed."
          onRetry={resetState}
          onDone={() => onOpenChange(false)}
        >
            <div className="flex flex-col overflow-y-auto">
              <ListingAssetSummary
                name={name}
                image={tokenImage}
                fallbackIcon={<Tag className="h-6 w-6 text-brand-blue/40" />}
                badge={is1155 ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full border border-brand-purple/40 bg-brand-purple/15 text-brand-purple">
                    <Layers className="h-3 w-3" />
                    Multi-edition
                  </span>
                ) : undefined}
              />
              <div className="px-5 pb-5 pt-4">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="price" render={({ field }) => (
                      <FormItem>
                        <FormLabel>{is1155 ? "Price per edition" : "Price"}</FormLabel>
                        <FormControl>
                          <PriceCurrencyInput
                            {...field}
                            currency={form.watch("currency")}
                            currencies={LISTABLE_CURRENCIES}
                            onCurrencyChange={(c) => form.setValue("currency", c, { shouldDirty: true })}
                            disabled={busy}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {is1155 && (
                      <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input type="number" step="1" min="1" placeholder="1" disabled={busy} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    <FormField control={form.control} name="durationSeconds" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration</FormLabel>
                        <FormControl>
                          <DurationPicker options={DURATION_OPTIONS} value={field.value} onChange={field.onChange} disabled={busy} />
                        </FormControl>
                      </FormItem>
                    )} />
                    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                    <div className="pt-1 space-y-2">
                      <div className={`btn-border-animated p-[1px] rounded-xl ${(busy || !isConnected) ? "pointer-events-none" : ""}`}>
                        <button
                          type="submit"
                          className="w-full h-11 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-transparent disabled:opacity-60"
                          disabled={busy || !isConnected}
                        >
                          <Tag className="h-4 w-4" /> Sell
                        </button>
                      </div>
                      <div className="flex items-start justify-center gap-1.5">
                        <ShieldCheck className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                        <p className="text-2xs text-center text-muted-foreground">
                          Listings are fully onchain and permissionless. Assets stay in the wallet until it settles.
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
