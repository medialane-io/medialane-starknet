"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, ArrowRightLeft } from "lucide-react";
import {
  MarketplaceProcessingState,
  TransactionSuccess,
  successMessages,
  shortenAddress,
} from "@medialane/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@medialane/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@medialane/ui/form";
import { Button } from "@medialane/ui/button";
import { Input } from "@medialane/ui/input";
import { resolveImage } from "@/lib/utils";
import { Alert, AlertDescription } from "@medialane/ui/alert";

import { useTransfer } from "@/hooks/use-transfer";

const schema = z.object({
  toAddress: z
    .string()
    .min(1, "Recipient address is required")
    .regex(
      /^0x[0-9a-fA-F]{1,64}$/,
      "Must be a valid Starknet address (starts with 0x, hex characters only)"
    ),
});

type FormValues = z.infer<typeof schema>;

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractAddress: string;
  tokenId: string;
  tokenName?: string;
  tokenImage?: string | null;

  tokenStandard?: "ERC721" | "ERC1155";
  onSuccess?: () => void;
  hasActiveListing?: boolean;
}

export function TransferDialog({
  open,
  onOpenChange,
  contractAddress,
  tokenId,
  tokenName,
  tokenImage: tokenImageRaw,
  tokenStandard,
  onSuccess,
  hasActiveListing = false,
}: TransferDialogProps) {
  const tokenImage = resolveImage(tokenImageRaw);
  const {
    transferToken,
    walletAddress,
    isProcessing,
    isConfirmed,
    txHash,
    error,
    resetState,
  } = useTransfer();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { toAddress: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (walletAddress && BigInt(values.toAddress) === BigInt(walletAddress)) {
      form.setError("toAddress", { message: "Cannot transfer to yourself" });
      return;
    }
    await transferToken({
      contractAddress,
      tokenId,
      toAddress: values.toAddress,
      tokenStandard,
    });
  };

  const handleClose = (v: boolean) => {
    if (!isProcessing) {
      resetState();
      form.reset();
      onOpenChange(v);
    }
  };

  const displayName = tokenName || `Token #${tokenId}`;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer asset</DialogTitle>
          </DialogHeader>

          {isConfirmed ? (
            <TransactionSuccess
              name={displayName}
              image={tokenImage}
              {...successMessages.transferred({ name: displayName, to: shortenAddress(form.getValues("toAddress")) })}
              txHash={txHash}
              actions={[
                {
                  label: "Done",
                  onClick: () => {
                    resetState();
                    form.reset();
                    onOpenChange(false);
                    onSuccess?.();
                  },
                },
              ]}
            />
          ) : isProcessing ? (
            <MarketplaceProcessingState title="Submitting transfer…" />
          ) : (
            <div className="space-y-4">

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium truncate">{displayName}</span>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This action is irreversible. Double-check the recipient address
                  before confirming.
                </AlertDescription>
              </Alert>

              {hasActiveListing && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This token has an active listing. A buyer could still complete
                    the purchase after you transfer it. Cancel the listing first,
                    or proceed with caution.
                  </AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="toAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="0x..."
                            disabled={isProcessing}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full h-11" disabled={isProcessing}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transfer
                  </Button>
                  <p className="text-2xs text-center text-muted-foreground">
                    Confirm in your wallet to complete the transfer.
                  </p>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </>
  );
}
