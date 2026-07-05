"use client";

import { useState } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Users, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem,
  FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { CreateClubAside } from "@/components/claim/create-club-aside";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { getMedialaneClient } from "@/lib/medialane-client";
import { getTokenBySymbol } from "@medialane/sdk";
import { toast } from "sonner";
import { FadeIn } from "@/components/ui/motion-primitives";

const schema = z.object({
  name: z.string().min(1, "Name required").max(100),
  symbol: z.string().min(1, "Symbol required").max(10).regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only"),
  metadataUri: z.string().min(1, "Metadata URI required").regex(/^(ipfs|ar):\/\//, "Must start with ipfs:// or ar://"),
  maxMembers: z.string().default("").refine((v) => v === "" || /^\d+$/.test(v), "Must be a positive integer"),
  entryFeeAmount: z.string().default("").refine((v) => v === "" || !Number.isNaN(Number(v)), "Enter a valid amount"),
  paymentToken: z.string().default("USDC"),
});

type FormValues = z.infer<typeof schema>;

export default function CreateClubPage() {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", symbol: "", metadataUri: "", maxMembers: "", entryFeeAmount: "", paymentToken: "USDC" },
  });

  const onSubmit = async (values: FormValues) => {
    if (!signer) { toast.error("Connect a wallet first"); return; }
    setIsSubmitting(true);
    try {
      const fee = values.entryFeeAmount ? Number(values.entryFeeAmount) : 0;
      const token = fee > 0 ? getTokenBySymbol(values.paymentToken) : null;
      if (fee > 0 && !token) { toast.error("Unsupported payment token"); return; }

      const client = getMedialaneClient();
      await client.services.club.createClub(signer, {
        name: values.name,
        symbol: values.symbol,
        metadataUri: values.metadataUri,
        maxMembers: values.maxMembers ? Number(values.maxMembers) : undefined,
        entryFee: fee > 0 ? BigInt(Math.round(fee * 10 ** token!.decimals)) : undefined,
        paymentToken: fee > 0 ? token!.address : undefined,
      });
      setDone(true);
      rewardToast("create_club");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create club");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="container max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-indigo-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-indigo-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Club created</h1>
          <p className="text-muted-foreground">
            Your club and its membership card are live on Starknet. It will appear in the launchpad
            within a minute once indexed.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link href="/launchpad/club">Back to Club launchpad</Link>
          </Button>
          <Button
            onClick={() => { setDone(false); form.reset(); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Create another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ConnectGate title="Connect your wallet" subtitle="Connect your Starknet wallet to create a club.">
      <ClaimRouteShell
        gated={false}
        icon={<Users className="h-4 w-4 text-white" />}
        title="Create a Club"
        subtitle="Give your closest fans a membership card that unlocks more — free to publish."
        aside={<CreateClubAside />}
      >
        <FadeIn>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Club name *</FormLabel>
                  <FormControl><Input placeholder="Inner Circle" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="symbol" render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="CIRCLE"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      className="max-w-[160px]"
                    />
                  </FormControl>
                  <FormDescription>Short ticker shown in wallets.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="metadataUri" render={({ field }) => (
                <FormItem>
                  <FormLabel>Metadata URI *</FormLabel>
                  <FormControl><Input placeholder="ipfs://bafybei…" {...field} /></FormControl>
                  <FormDescription>ipfs:// or ar:// only — enforced on-chain.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="maxMembers" render={({ field }) => (
                <FormItem>
                  <FormLabel>Member cap <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input type="number" min={1} placeholder="Unlimited" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3">
                <FormField control={form.control} name="entryFeeAmount" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Entry fee <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Input type="number" min={0} step="0.01" placeholder="Free" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="paymentToken" render={({ field }) => (
                  <FormItem className="w-28">
                    <FormLabel>Token</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <Button type="submit" size="lg" className="w-full rounded-xl" disabled={isSubmitting}>
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                  : <><Users className="h-4 w-4 mr-2" />Create Club</>}
              </Button>
            </form>
          </Form>
        </FadeIn>
      </ClaimRouteShell>
    </ConnectGate>
  );
}
