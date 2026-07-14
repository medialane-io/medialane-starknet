"use client";

// Mint tickets — the ip-tickets service action on the collection page.
// One transaction: mint(recipient, ticket_id, quantity), owner-only on-chain.

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Ticket } from "lucide-react";
import { toast } from "sonner";
import { Contract, cairo } from "starknet";
import { normalizeAddress, IPTicketCollectionABI } from "@medialane/sdk";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { MintProgressDialog, type MintStep } from "@/components/marketplace/mint-progress-dialog";
import type { TxStatus } from "@/hooks/use-tx";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useWallet } from "@/hooks/use-wallet";
import { rewardToast } from "@/lib/reward-toast";
import { starknetProvider } from "@/lib/starknet";

const schema = z.object({
  ticketId: z
    .string()
    .min(1, "Ticket ID required")
    .regex(/^\d+$/, "Must be a positive integer"),
  recipient: z.string().min(1, "Recipient address required"),
  amount: z
    .string()
    .min(1, "Quantity required")
    .regex(/^\d+$/, "Must be a positive integer")
    .refine((v) => parseInt(v, 10) >= 1, "Minimum 1"),
});
type FormValues = z.infer<typeof schema>;

export function MintTicketsDialog({
  contractAddress,
  open,
  onOpenChange,
}: {
  contractAddress: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const contract = normalizeAddress("STARKNET", contractAddress);
  const { address, isConnected } = useWallet();
  const { executeAuto } = usePaymasterTransaction();

  const [mintStep, setMintStep] = useState<MintStep>("idle");
  const [dialogTxStatus, setDialogTxStatus] = useState<TxStatus>("idle");
  const [mintError, setMintError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ticketId: "1", recipient: address ?? "", amount: "1" },
  });

  const resetTx = () => {
    setMintStep("idle");
    setDialogTxStatus("idle");
    setMintError(null);
  };

  const handleMintMore = () => {
    resetTx();
    form.reset({ ticketId: form.getValues("ticketId"), recipient: "", amount: "1" });
  };

  const handleDone = () => {
    resetTx();
    onOpenChange(false);
  };

  async function onSubmit(values: FormValues) {
    if (!isConnected || !address) {
      toast.error("Connect your wallet first");
      return;
    }

    setMintError(null);
    setMintStep("processing");
    setDialogTxStatus("submitting");

    try {
      const col = new Contract({ abi: IPTicketCollectionABI as any, address: contract, providerOrAccount: starknetProvider });
      const recipientNorm = normalizeAddress("STARKNET", values.recipient);
      const call = col.populate("mint", [
        recipientNorm,
        cairo.uint256(values.ticketId),
        cairo.uint256(values.amount),
      ]);

      const hash = await executeAuto([call]);
      if (!hash) throw new Error("Transaction failed");
      setDialogTxStatus("confirming");
      setDialogTxStatus("confirmed");
      rewardToast("launch_launchpad");
      setMintStep("success");
    } catch (err: any) {
      setMintError(err?.message ?? "Mint failed");
      setDialogTxStatus("idle");
      setMintStep("error");
    }
  }

  return (
    <>
      <MintProgressDialog
        open={mintStep !== "idle"}
        mintStep={mintStep}
        txStatus={dialogTxStatus}
        assetName={`Ticket #${form.getValues("ticketId")}`}
        imagePreview={null}
        txHash={null}
        error={mintError}
        onMintAnother={handleMintMore}
        uploadStepLabel="Prepare transaction"
        processingTitle="Minting tickets on Starknet…"
        successTitle="Tickets minted!"
        successSubtitle={`${form.getValues("amount")} ticket(s) sent to the recipient's wallet.`}
        mintAnotherLabel="Mint more"
        primaryActionLabel="Done"
        onPrimaryAction={handleDone}
      />

      <Dialog open={open && mintStep === "idle"} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-brand-blue" />
              Mint tickets
            </DialogTitle>
            <DialogDescription>
              Send tickets directly to a wallet. Recipients hold their tickets — you cannot revoke them.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="ticketId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ticket ID</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="1" {...field} />
                    </FormControl>
                    <FormDescription>Tickets are numbered in the order you created them, starting at 1.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recipient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient address</FormLabel>
                    <FormControl>
                      <Input placeholder="0x…" {...field} />
                    </FormControl>
                    <FormDescription>The wallet that will receive the tickets.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={mintStep === "processing"}
                className="w-full bg-brand-blue hover:bg-brand-electric text-white"
              >
                <Ticket className="h-4 w-4 mr-2" />
                Mint tickets
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
