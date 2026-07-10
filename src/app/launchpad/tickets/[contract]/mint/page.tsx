"use client";

import { useState } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useParams, useSearchParams } from "next/navigation";
import { Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  MintProgressDialog,
  type MintStep,
} from "@/components/marketplace/mint-progress-dialog";
import type { TxStatus } from "@/hooks/use-tx";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { ClaimRail } from "@medialane/ui";
import { toast } from "sonner";
import { normalizeAddress, IPTicketCollectionABI } from "@medialane/sdk";
import { Contract, cairo } from "starknet";
import { starknetProvider } from "@/lib/starknet";

const schema = z.object({
  eventId: z
    .string()
    .min(1, "Event ID required")
    .regex(/^\d+$/, "Must be a positive integer"),
  recipient: z.string().min(1, "Recipient address required"),
  amount: z
    .string()
    .min(1, "Amount required")
    .regex(/^\d+$/, "Must be a positive integer")
    .refine((v) => parseInt(v, 10) >= 1, "Minimum 1"),
});
type FormValues = z.infer<typeof schema>;

export default function MintTicketsPage() {
  const params = useParams<{ contract: string }>();
  const searchParams = useSearchParams();
  const contract = normalizeAddress("STARKNET", params.contract);
  const defaultEventId = searchParams.get("eventId") ?? "";
  const { address, isConnected } = useWallet();
  const { executeAuto } = usePaymasterTransaction();

  const [mintStep, setMintStep] = useState<MintStep>("idle");
  const [dialogTxStatus, setDialogTxStatus] = useState<TxStatus>("idle");
  const [mintError, setMintError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { eventId: defaultEventId, recipient: address ?? "", amount: "1" },
  });

  const handleReset = () => {
    setMintStep("idle");
    setDialogTxStatus("idle");
    setMintError(null);
    form.reset({ eventId: defaultEventId, recipient: "", amount: "1" });
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
        cairo.uint256(values.eventId),
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

  if (!isConnected) {
    return <ConnectGate><div /></ConnectGate>;
  }

  return (
    <>
      <MintProgressDialog
        open={mintStep !== "idle"}
        mintStep={mintStep}
        txStatus={dialogTxStatus}
        assetName={`Event #${form.getValues("eventId")} ticket`}
        imagePreview={null}
        txHash={null}
        error={mintError}
        onMintAnother={handleReset}
        uploadStepLabel="Prepare transaction"
        processingTitle="Minting tickets on Starknet…"
        successTitle="Tickets minted!"
        successSubtitle={`${form.getValues("amount")} ticket(s) sent to the recipient's wallet.`}
        mintAnotherLabel="Mint more"
        primaryActionLabel="Back to collection"
        primaryActionHref={`/launchpad/tickets/${contract}`}
      />

      <ClaimRouteShell
        icon={<Ticket className="h-4 w-4 text-white" />}
        title="Mint tickets"
        subtitle="Send tickets directly to an attendee's wallet."
        gated={false}
        aside={
          <ClaimRail
            steps={[
              "Enter the event ID, recipient address, and quantity",
              "The ticket is minted directly to the recipient's wallet",
              "Holders can prove validity at the door via the asset page",
            ]}
            trustIcon={Ticket}
            trustLead="Owner-only."
            trust="Only the collection owner can mint. Recipients hold their tickets — you cannot revoke them."
          />
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="eventId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event ID</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" placeholder="1" {...field} />
                  </FormControl>
                  <FormDescription>The token ID of the event to mint.</FormDescription>
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
                  <FormDescription>How many tickets to send.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={mintStep === "processing"}
              className={`w-full h-12 text-base font-semibold text-white rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-teal-600 ${mintStep === "processing" ? "opacity-40 pointer-events-none" : ""}`}
            >
              <Ticket className="h-4 w-4" />
              Mint tickets
            </button>
          </form>
        </Form>
      </ClaimRouteShell>
    </>
  );
}
