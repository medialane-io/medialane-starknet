"use client";

import { useState } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Ticket, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form, FormControl, FormField, FormItem,
  FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { CreateTicketAside } from "@/components/claim/create-ticket-aside";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useMyTicketCollections } from "@/hooks/use-tickets";
import { getMedialaneClient } from "@/lib/medialane-client";
import { getTokenBySymbol } from "@medialane/sdk";
import { toast } from "sonner";
import { FadeIn } from "@/components/ui/motion-primitives";

const deploySchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  symbol: z.string().min(1, "Symbol required").max(10).regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only"),
});

const collectionSchema = z.object({
  metadataUri: z.string().min(1, "Metadata URI required").regex(/^(ipfs|ar):\/\//, "Must start with ipfs:// or ar://"),
  maxSupply: z.string().regex(/^\d+$/, "Must be a positive integer").refine((v) => parseInt(v, 10) >= 1, "Minimum 1"),
  priceAmount: z.string().default("").refine((v) => v === "" || !Number.isNaN(Number(v)), "Enter a valid price"),
  paymentToken: z.string().default("USDC"),
  expirationDate: z.string().min(1, "Expiration date required"),
  royalty: z.coerce.number().min(0).max(50).default(0),
});

type DeployValues = z.infer<typeof deploySchema>;
type CollectionValues = z.infer<typeof collectionSchema>;

export default function CreateTicketsPage() {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, address: activeAddress, isConnected } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;

  const { collections: myCollections, isLoading: loadingMyCollections, mutate } = useMyTicketCollections(activeAddress);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [done, setDone] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  const existingCollection = deployedAddress ?? myCollections[0]?.contractAddress ?? null;

  const deployForm = useForm<DeployValues>({
    resolver: zodResolver(deploySchema),
    defaultValues: { name: "", symbol: "" },
  });

  const collectionForm = useForm<CollectionValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: { metadataUri: "", maxSupply: "100", priceAmount: "", paymentToken: "USDC", expirationDate: "", royalty: 0 },
  });

  const onDeploy = async (values: DeployValues) => {
    if (!signer || !activeAddress) { toast.error("Connect a wallet first"); return; }
    setIsDeploying(true);
    try {
      const client = getMedialaneClient();
      await client.services.ticket.deployTicketCollection(signer, { name: values.name, symbol: values.symbol });
      toast.success("Ticket contract deployed");
      rewardToast("create_ticket_collection");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deploy ticket contract");
    } finally {
      setIsDeploying(false);
    }
  };

  const onCreateCollection = async (values: CollectionValues) => {
    if (!signer || !existingCollection) { toast.error("Deploy your ticket contract first"); return; }
    setIsCreating(true);
    try {
      const price = values.priceAmount ? Number(values.priceAmount) : 0;
      const token = price > 0 ? getTokenBySymbol(values.paymentToken) : null;
      if (price > 0 && !token) { toast.error("Unsupported payment token"); return; }

      const client = getMedialaneClient();
      await client.services.ticket.createTicketCollection(signer, {
        collection: existingCollection,
        price: price > 0 ? BigInt(Math.round(price * 10 ** (token!.decimals))) : 0n,
        maxSupply: BigInt(values.maxSupply),
        expiration: Math.floor(new Date(values.expirationDate).getTime() / 1000),
        royaltyBps: Math.round(values.royalty * 100),
        paymentToken: price > 0 ? token!.address : undefined,
        metadataUri: values.metadataUri,
      });
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket collection");
    } finally {
      setIsCreating(false);
    }
  };

  if (done) {
    return (
      <div className="container max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-teal-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-teal-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Tickets created</h1>
          <p className="text-muted-foreground">
            Your ticket collection is live on Starknet. It will appear in the launchpad within a minute once indexed.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link href="/launchpad/tickets">Back to Tickets launchpad</Link>
          </Button>
          <Button
            onClick={() => { setDone(false); collectionForm.reset(); }}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            Create another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ConnectGate title="Connect your wallet" subtitle="Connect your Starknet wallet to sell tickets.">
      <ClaimRouteShell
        gated={false}
        icon={<Ticket className="h-4 w-4 text-white" />}
        title="Sell Tickets"
        subtitle="Deploy your own ticket contract once, then create as many events as you like under it."
        aside={<CreateTicketAside />}
      >
        <div className="space-y-6">
          {!isConnected || loadingMyCollections ? null : !existingCollection ? (
            <FadeIn>
              <Form {...deployForm}>
                <form onSubmit={deployForm.handleSubmit(onDeploy)} className="space-y-5">
                  <p className="text-sm font-medium">Step 1 — Deploy your ticket contract (once, free)</p>
                  <FormField control={deployForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract name *</FormLabel>
                      <FormControl><Input placeholder="My Events" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={deployForm.control} name="symbol" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="MYEVT"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          className="max-w-[160px]"
                        />
                      </FormControl>
                      <FormDescription>Short ticker shown in wallets.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" size="lg" className="w-full rounded-xl" disabled={isDeploying}>
                    {isDeploying
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deploying…</>
                      : <><Ticket className="h-4 w-4 mr-2" />Deploy Ticket Contract</>}
                  </Button>
                </form>
              </Form>
            </FadeIn>
          ) : (
            <FadeIn>
              <Form {...collectionForm}>
                <form onSubmit={collectionForm.handleSubmit(onCreateCollection)} className="space-y-5">
                  <p className="text-sm font-medium">Step 2 — Create your event</p>
                  <FormField control={collectionForm.control} name="metadataUri" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Metadata URI *</FormLabel>
                      <FormControl><Input placeholder="ipfs://bafybei…" {...field} /></FormControl>
                      <FormDescription>ipfs:// or ar:// only — enforced on-chain.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={collectionForm.control} name="maxSupply" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max supply *</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex gap-3">
                    <FormField control={collectionForm.control} name="priceAmount" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Price (0 = free)</FormLabel>
                        <FormControl><Input type="number" min={0} step="0.01" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={collectionForm.control} name="paymentToken" render={({ field }) => (
                      <FormItem className="w-28">
                        <FormLabel>Token</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={collectionForm.control} name="expirationDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expires *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormDescription>Tickets lose access after this date — they stay transferable.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={collectionForm.control} name="royalty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Royalty %</FormLabel>
                      <FormControl><Input type="number" min={0} max={50} step="0.5" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" size="lg" className="w-full rounded-xl" disabled={isCreating}>
                    {isCreating
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                      : <><Ticket className="h-4 w-4 mr-2" />Create Event</>}
                  </Button>
                </form>
              </Form>
            </FadeIn>
          )}
        </div>
      </ClaimRouteShell>
    </ConnectGate>
  );
}
