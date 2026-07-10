"use client";

import { useState } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useParams, useRouter } from "next/navigation";
import { Calendar, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Contract, CairoOption, CairoOptionVariant, cairo } from "starknet";
import { normalizeAddress, IPTicketCollectionABI } from "@medialane/sdk";
import { starknetProvider } from "@/lib/starknet";
import { EXPLORER_URL } from "@/lib/constants";
import { uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { useTicketEvents } from "@/hooks/use-tickets";

const schema = z.object({
  name: z.string().min(1, "Event name required").max(100),
  description: z.string().max(1000).optional(),
  maxSupply: z
    .string()
    .min(1, "Supply required")
    .regex(/^\d+$/, "Must be a positive integer")
    .refine((v) => parseInt(v, 10) >= 1, "Minimum supply is 1"),
  royaltyBps: z.coerce.number().min(0).max(10000).default(250),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function dateToUnixTimestamp(dateStr: string | undefined): number | undefined {
  if (!dateStr) return undefined;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return undefined;
  return Math.floor(d.getTime() / 1000);
}

export default function CreateEventPage() {
  const params = useParams<{ contract: string }>();
  const contract = normalizeAddress("STARKNET", params.contract);
  const { isConnected } = useWallet();
  const { executeAuto } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();
  const { mutate } = useTicketEvents(contract);
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "uploading" | "submitting" | "done">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", maxSupply: "100", royaltyBps: 250 },
  });

  async function onSubmit(values: FormValues) {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    try {
      setStatus("uploading");
      const siwsToken = await getValidToken();
      if (!siwsToken) throw new Error("Authentication required — please sign in");
      const metadataUri = await uploadJsonToIpfs(
        {
          name: values.name,
          description: values.description ?? "",
          attributes: [
            { trait_type: "Type", value: "IP Ticket" },
            { trait_type: "Max Supply", value: values.maxSupply },
          ],
        },
        siwsToken,
      );

      setStatus("submitting");
      const startTime = dateToUnixTimestamp(values.startDate);
      const endTime = dateToUnixTimestamp(values.endDate);

      const col = new Contract({ abi: IPTicketCollectionABI as any, address: contract, providerOrAccount: starknetProvider });
      const call = col.populate("create_event", [
        cairo.uint256(values.maxSupply),
        startTime != null
          ? new CairoOption(CairoOptionVariant.Some, startTime)
          : new CairoOption(CairoOptionVariant.None),
        endTime != null
          ? new CairoOption(CairoOptionVariant.Some, endTime)
          : new CairoOption(CairoOptionVariant.None),
        values.royaltyBps,
        metadataUri,
      ]);

      const txH = await executeAuto([call]);
      if (!txH) throw new Error("Transaction failed");
      setTxHash(txH);
      rewardToast("launch_launchpad");
      void mutate();
      setStatus("done");
      setTimeout(() => router.push(`/launchpad/tickets/${contract}`), 1500);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Failed to create event");
      setStatus("idle");
    }
  }

  if (!isConnected) {
    return <ConnectGate><div /></ConnectGate>;
  }

  const busy = status === "uploading" || status === "submitting";

  return (
    <ClaimRouteShell
      icon={<Calendar className="h-4 w-4 text-white" />}
      title="Create event"
      subtitle="Add a new event to your ticket collection."
      gated={false}
      aside={
        <ClaimRail
          steps={[
            "Fill in the event name and supply",
            "Optionally set a time window — tickets are only valid during the window",
            "Metadata is pinned to IPFS and the event is registered on-chain",
          ]}
          trustIcon={Calendar}
          trustLead="Immutable on-chain."
          trust="Once created, the event record is permanent. Pause minting any time, but the event itself stays."
        />
      }
    >
      {status === "done" ? (
        <div className="p-8 text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto">
            <Calendar className="h-7 w-7 text-teal-500" />
          </div>
          <p className="font-semibold">Event created!</p>
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
          <p className="text-xs text-muted-foreground">Returning to your collection…</p>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event name</FormLabel>
                  <FormControl>
                    <Input placeholder="Summer Concert 2026" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this event about?" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="maxSupply"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max supply</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="100" {...field} />
                    </FormControl>
                    <FormDescription>Total tickets available.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="royaltyBps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Royalty %</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        placeholder="2.5"
                        value={field.value ? (field.value / 100).toString() : ""}
                        onChange={(e) =>
                          field.onChange(Math.round(parseFloat(e.target.value || "0") * 100))
                        }
                      />
                    </FormControl>
                    <FormDescription>On secondary sales.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Start date{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>Tickets valid from.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      End date{" "}
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormDescription>Tickets expire after.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {status === "uploading" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading metadata…
                </>
              ) : status === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating event…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Create event
                </>
              )}
            </Button>
          </form>
        </Form>
      )}
    </ClaimRouteShell>
  );
}
