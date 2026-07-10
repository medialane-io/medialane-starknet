"use client";

import { useState } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { ClaimRail } from "@medialane/ui";
import { toast } from "sonner";
import { normalizeAddress, IPTicketCollectionABI } from "@medialane/sdk";
import { Contract, cairo } from "starknet";
import { starknetProvider } from "@/lib/starknet";
import { EXPLORER_URL } from "@/lib/constants";

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
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "minting" | "done">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { eventId: defaultEventId, recipient: address ?? "", amount: "1" },
  });

  async function onSubmit(values: FormValues) {
    if (!isConnected || !address) {
      toast.error("Connect your wallet first");
      return;
    }
    setStatus("minting");
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
      setTxHash(hash);
      rewardToast("launch_launchpad");
      setStatus("done");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Mint failed");
      setStatus("idle");
    }
  }

  if (!isConnected) {
    return <ConnectGate><div /></ConnectGate>;
  }

  return (
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
      {status === "done" ? (
        <div className="p-8 text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto">
            <Ticket className="h-7 w-7 text-teal-500" />
          </div>
          <p className="font-semibold">Tickets minted!</p>
          {txHash && (
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              View transaction
            </a>
          )}
          <div className="flex gap-2 justify-center pt-2">
            <Button size="sm" variant="outline" onClick={() => { setStatus("idle"); form.reset({ eventId: defaultEventId, recipient: "", amount: "1" }); }}>
              Mint more
            </Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => router.push(`/launchpad/tickets/${contract}`)}>
              Back to collection
            </Button>
          </div>
        </div>
      ) : (
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

            <Button
              type="submit"
              disabled={status === "minting"}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {status === "minting" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Minting…</>
              ) : (
                "Mint tickets"
              )}
            </Button>
          </form>
        </Form>
      )}
    </ClaimRouteShell>
  );
}
