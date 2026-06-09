"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AlertCircle, ArrowRightLeft, Loader2 } from "lucide-react";
import {
  MarketplaceProcessingState,
  MarketplaceSuccessState,
} from "@/components/marketplace/marketplace-dialog-primitives";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";


import { useTransfer } from "@/hooks/use-transfer";
import { EXPLORER_URL } from "@/lib/constants";

// Schema defined outside component — no component-level variables needed.
// Self-transfer check is done in onSubmit with form.setError for better UX.
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
  /** ERC-721 default; pass "ERC1155" for edition assets so the hook
   *  routes through `safe_transfer_from` instead of `transfer_from`. */
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
  tokenImage,
  tokenStandard,
  onSuccess,
  hasActiveListing = false,
}: TransferDialogProps) {
  const {
    transferToken,
    walletAddress,
    hasWallet,
    isProcessing,
    isLoadingWallet,
    txStatus,
    txHash,
    error,
    resetState,
  } = useTransfer();

  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { toAddress: "" },
  });

  const onSubmit = async (values: FormValues) => {
    if (walletAddress) {
      try {
        if (BigInt(values.toAddress) === BigInt(walletAddress)) {
          form.setError("toAddress", { message: "Cannot transfer to yourself" });
          return;
        }
      } catch {
        // BigInt parse failed — safe to continue.
      }
    }
    setPendingAddress(values.toAddress);
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
      setPendingAddress(null);
      onOpenChange(v);
    }
  };

  const isSuccess = txStatus === "confirmed" && !error;
  const displayName = tokenName || `Token #${tokenId}`;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer asset</DialogTitle>
          </DialogHeader>

          {isSuccess ? (
            <MarketplaceSuccessState
              title="Transfer complete!"
              description={`${displayName} has been sent successfully.`}
              txHash={txHash}
              explorerUrl={EXPLORER_URL}
              name={displayName}
              tokenImage={tokenImage}
              onDone={() => {
                resetState();
                form.reset();
                setPendingAddress(null);
                onOpenChange(false);
                onSuccess?.();
              }}
            />
          ) : isProcessing ? (
            <MarketplaceProcessingState
              title={txStatus === "submitting" ? "Submitting transfer…" : "Confirming on Starknet…"}
            />
          ) : (
            <div className="space-y-4">
              {/* Asset info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <Badge variant="outline" className="font-mono">
                  #{tokenId}
                </Badge>
                <span className="text-sm font-medium truncate">{displayName}</span>
              </div>

              {/* Irreversibility warning */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This action is irreversible. Double-check the recipient address
                  before confirming.
                </AlertDescription>
              </Alert>

              {/* Active listing warning */}
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

                  <Button
                    type="submit"
                    className="w-full h-11"
                    disabled={isProcessing || isLoadingWallet}
                  >
                    {isLoadingWallet ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading wallet…
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                        Transfer
                      </>
                    )}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground">
                    Gas is free. Your PIN authorises the transfer.
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
