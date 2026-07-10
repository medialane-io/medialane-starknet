"use client";

import { useState, useRef, useEffect } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { hash } from "starknet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import Image from "next/image";
import { Ticket, Loader2, CheckCircle2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem,
  FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { CreateTicketAside } from "@/components/claim/create-ticket-aside";
import { StepNav } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useMyTicketCollections } from "@/hooks/use-tickets";
import { getMedialaneClient } from "@/lib/medialane-client";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { uploadFileToIpfs, uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";
import { invalidatePortfolioCache } from "@/lib/portfolio-cache";
import { starknetProvider } from "@/lib/starknet";
import { serializeByteArray } from "@/lib/cairo-calldata";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import {
  STARKNET_IP_TICKETS_FACTORY_CONTRACT,
  getTokenBySymbol,
  normalizeAddress,
  SUPPORTED_TOKENS,
} from "@medialane/sdk";
import { toast } from "sonner";
import { FadeIn } from "@/components/ui/motion-primitives";

const LISTABLE_TOKENS = SUPPORTED_TOKENS.filter((t) => t.listable);
const COLLECTION_DEPLOYED_SELECTOR = hash.getSelectorFromName("CollectionDeployed");

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];

// ── Schemas ───────────────────────────────────────────────────────────────────

const deploySchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  symbol: z.string().min(1, "Symbol required").max(10).regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only"),
  description: z.string().max(500).optional(),
});

const collectionSchema = z.object({
  metadataUri: z.string().min(1, "Image URI required").regex(/^(ipfs|ar):\/\//, "Must start with ipfs:// or ar://"),
  maxSupply: z.string().regex(/^\d+$/, "Must be a positive integer").refine((v) => parseInt(v, 10) >= 1, "Minimum 1"),
  priceAmount: z.string().default("").refine((v) => v === "" || !Number.isNaN(Number(v)), "Enter a valid price"),
  paymentToken: z.string().default("USDC"),
  expirationDate: z.string().min(1, "Expiration date required"),
  royalty: z.coerce.number().min(0).max(50).default(0),
});

type DeployValues = z.infer<typeof deploySchema>;
type CollectionValues = z.infer<typeof collectionSchema>;

const STEPS = [
  { label: "Your ticket collection" },
  { label: "Event details" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreateTicketsPage() {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, address: activeAddress, isConnected } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;

  const { executeAuto } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();
  const { collections: myCollections, isLoading: loadingMyCollections, mutate } = useMyTicketCollections(activeAddress ?? null);

  const [isDeploying, setIsDeploying] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [done, setDone] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);

  // Image upload state (step 1)
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Image upload state (step 2)
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [imagePreview2, setImagePreview2] = useState<string | null>(null);
  const [imageUploading2, setImageUploading2] = useState(false);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const previewUrlRef2 = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (previewUrlRef2.current) URL.revokeObjectURL(previewUrlRef2.current);
    };
  }, []);

  const existingCollection = deployedAddress ?? myCollections[0]?.contractAddress ?? null;
  const currentStep = !existingCollection ? 1 : 2;

  const deployForm = useForm<DeployValues>({
    resolver: zodResolver(deploySchema),
    defaultValues: { name: "", symbol: "", description: "" },
  });

  const collectionForm = useForm<CollectionValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: { metadataUri: "", maxSupply: "100", priceAmount: "", paymentToken: "USDC", expirationDate: "", royalty: 0 },
  });

  // ── Image handling ──────────────────────────────────────────────────────────

  const handleImageSelect = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Unsupported format", { description: "Please upload a JPG, PNG, GIF, SVG, or WebP image." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large", { description: `Max 10 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.` });
      return;
    }
    setImageFile(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setImagePreview(objectUrl);
    setImageUri(null);
    setImageUploading(true);
    try {
      const siwsToken = await getValidToken();
      if (!siwsToken) throw new Error("Sign in with your wallet to upload images.");
      const uploaded = await uploadFileToIpfs(file, siwsToken);
      setImageUri(uploaded.uri);
      toast.success("Image uploaded to IPFS");
    } catch (err) {
      const t = uploadFailureToast(err);
      toast.error(t.title, { description: t.description });
      setImageUri(null);
    } finally {
      setImageUploading(false);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUri(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageSelect2 = async (file: File) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Unsupported format", { description: "Please upload a JPG, PNG, GIF, SVG, or WebP image." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large", { description: `Max 10 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.` });
      return;
    }
    setImageFile2(file);
    if (previewUrlRef2.current) URL.revokeObjectURL(previewUrlRef2.current);
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef2.current = objectUrl;
    setImagePreview2(objectUrl);
    setImageUploading2(true);
    try {
      const siwsToken = await getValidToken();
      if (!siwsToken) throw new Error("Sign in with your wallet to upload images.");
      const uploaded = await uploadFileToIpfs(file, siwsToken);
      collectionForm.setValue("metadataUri", uploaded.uri);
      toast.success("Event image uploaded to IPFS");
    } catch (err) {
      const t = uploadFailureToast(err);
      toast.error(t.title, { description: t.description });
    } finally {
      setImageUploading2(false);
    }
  };

  const clearImage2 = () => {
    setImageFile2(null);
    setImagePreview2(null);
    collectionForm.setValue("metadataUri", "");
    if (fileInputRef2.current) fileInputRef2.current.value = "";
  };

  // ── Step 1: Create ticket collection ───────────────────────────────────────

  const onDeploy = async (values: DeployValues) => {
    if (!activeAddress) { toast.error("Connect a wallet first"); return; }
    if (imageFile && !imageUri && !imageUploading) {
      toast.error("Image upload failed", { description: "Please re-upload the collection image." });
      return;
    }
    setIsDeploying(true);
    try {
      // 1. Pin metadata JSON to IPFS so wallets can resolve the collection image.
      let collectionMetaUri: string | undefined;
      if (imageUri) {
        try {
          const siwsToken = await getValidToken();
          if (!siwsToken) throw new Error("no siws token");
          collectionMetaUri = await uploadJsonToIpfs({
            name: values.name,
            description: values.description || "",
            image: imageUri,
            external_link: `https://medialane.io/account/${activeAddress}`,
          }, siwsToken);
        } catch { /* non-fatal — collection still deploys */ }
      }

      // 2. Register intent with backend so sync-tx can associate the image.
      if (imageUri) {
        try {
          const client = getMedialaneClient();
          await client.api.createCollectionIntent({
            owner: activeAddress,
            name: values.name,
            symbol: values.symbol,
            description: values.description || undefined,
            image: imageUri,
            baseUri: collectionMetaUri,
          });
        } catch { /* non-fatal */ }
      }

      // 3. Deploy on-chain via paymaster.
      const txHash = await executeAuto([{
        contractAddress: STARKNET_IP_TICKETS_FACTORY_CONTRACT,
        entrypoint: "deploy_ticket_collection",
        calldata: [
          ...serializeByteArray(values.name),
          ...serializeByteArray(values.symbol),
        ],
      }]);

      if (!txHash) throw new Error("Transaction failed — no hash returned");

      // 4. Extract deployed collection address from receipt events.
      let addr: string | null = null;
      try {
        let receipt: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 2 && !receipt; attempt++) {
          try {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
            receipt = await starknetProvider.getTransactionReceipt(txHash) as Record<string, unknown>;
          } catch { /* retry */ }
        }
        const events = (receipt?.events as Array<{ keys?: string[] }>) ?? [];
        const deployEvent = events.find((e) =>
          e.keys?.[0] && BigInt(e.keys[0]) === BigInt(COLLECTION_DEPLOYED_SELECTOR)
        );
        if (deployEvent?.keys?.[1]) {
          addr = normalizeAddress("STARKNET", deployEvent.keys[1]);
          setDeployedAddress(addr);
        }
      } catch { /* non-fatal — falls back to indexer */ }

      // 5. Sync-tx so the backend associates the intent image with this collection.
      try {
        await Promise.race([
          fetch(`${MEDIALANE_BACKEND_URL}/v1/collections/sync-tx`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(MEDIALANE_API_KEY ? { "x-api-key": MEDIALANE_API_KEY } : {}),
            },
            body: JSON.stringify({ txHash }),
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(), 6000)),
        ]);
      } catch { /* non-fatal */ }

      // 6. Fast-path register so the collection appears in the browse page immediately.
      if (addr) {
        try {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
          await fetch(`${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/collections/register`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              contractAddress: addr,
              startBlock: 0,
              standard: "ERC721",
              source: "MEDIALANE_IP_TICKETS",
            }),
          });
        } catch { /* non-fatal */ }
      }

      toast.success("Ticket collection created");
      rewardToast("create_ticket_collection");
      if (activeAddress) invalidatePortfolioCache(activeAddress);
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ticket collection");
    } finally {
      setIsDeploying(false);
    }
  };

  // ── Step 2: Create event (ticket collection entry) ─────────────────────────

  const onCreateCollection = async (values: CollectionValues) => {
    if (!signer || !existingCollection) { toast.error("Create your ticket collection first"); return; }
    if (imageUploading2) { toast.error("Image still uploading, please wait"); return; }
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
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setIsCreating(false);
    }
  };

  // ── Done state ─────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="container max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-teal-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-teal-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Event created</h1>
          <p className="text-muted-foreground">
            Your ticket event is live on Starknet. It will appear in the launchpad within a minute once indexed.
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
            Add another event
          </Button>
        </div>
      </div>
    );
  }

  // ── Main layout ────────────────────────────────────────────────────────────

  return (
    <ConnectGate title="Connect your wallet" subtitle="Connect your Starknet wallet to sell tickets.">
      <ClaimRouteShell
        gated={false}
        icon={<Ticket className="h-4 w-4 text-white" />}
        title="Sell Tickets"
        subtitle="Create your ticket collection once, then add as many events as you like."
        aside={<CreateTicketAside />}
      >
        <div className="space-y-6">
          {isConnected && !loadingMyCollections && (
            <StepNav
              steps={STEPS}
              current={currentStep}
              accentText="text-teal-500"
              accentBg="bg-teal-600"
            />
          )}

          {!isConnected || loadingMyCollections ? null : !existingCollection ? (

            // ── Step 1 form ────────────────────────────────────────────────
            <FadeIn>
              <Form {...deployForm}>
                <form onSubmit={deployForm.handleSubmit(onDeploy)} className="space-y-5">

                  {/* Collection image */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Collection image</p>
                    <div className="flex items-start gap-4">
                      <div
                        className="relative h-28 w-28 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        aria-label="Upload collection image"
                        onClick={() => !imageUploading && fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (!imageUploading) fileInputRef.current?.click();
                          }
                        }}
                      >
                        {imagePreview ? (
                          <Image src={imagePreview} alt="Collection image" fill className="object-cover" />
                        ) : (
                          <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        )}
                        {imageUploading && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 flex-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageSelect(file);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={imageUploading}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {imageUploading ? (
                            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                          ) : imageFile ? "Change image" : "Upload image"}
                        </Button>
                        {imageFile && (
                          <button
                            type="button"
                            onClick={clearImage}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" /> Remove
                          </button>
                        )}
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, GIF, SVG or WebP · max 10 MB
                          {imageUri && <span className="ml-2 text-emerald-500 font-medium">✓ Uploaded</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  <FormField control={deployForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collection name *</FormLabel>
                      <FormControl><Input placeholder="My Events" {...field} /></FormControl>
                      <FormDescription>Your brand name — shown in wallets and explorers.</FormDescription>
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
                      <FormDescription>Short ticker — 2 to 10 uppercase letters.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={deployForm.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe your events and what kind of tickets you sell…"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={isDeploying || imageUploading}
                  >
                    {isDeploying
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                      : <><Ticket className="h-4 w-4 mr-2" />Create Ticket Collection</>}
                  </Button>
                </form>
              </Form>
            </FadeIn>

          ) : (

            // ── Step 2 form ────────────────────────────────────────────────
            <FadeIn>
              <Form {...collectionForm}>
                <form onSubmit={collectionForm.handleSubmit(onCreateCollection)} className="space-y-5">
                  {/* Event image upload */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Event image *</p>
                    <div className="flex items-start gap-4">
                      <div
                        className="relative h-28 w-28 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                        role="button"
                        tabIndex={0}
                        aria-label="Upload event image"
                        onClick={() => !imageUploading2 && fileInputRef2.current?.click()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (!imageUploading2) fileInputRef2.current?.click();
                          }
                        }}
                      >
                        {imagePreview2 ? (
                          <Image src={imagePreview2} alt="Event image" fill className="object-cover" />
                        ) : (
                          <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        )}
                        {imageUploading2 && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 flex-1">
                        <input
                          ref={fileInputRef2}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageSelect2(file);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={imageUploading2}
                          onClick={() => fileInputRef2.current?.click()}
                        >
                          {imageUploading2 ? (
                            <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                          ) : imageFile2 ? "Change image" : "Upload image"}
                        </Button>
                        {imageFile2 && (
                          <button
                            type="button"
                            onClick={clearImage2}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="h-3 w-3" /> Remove
                          </button>
                        )}
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, GIF, SVG or WebP · max 10 MB
                          {collectionForm.watch("metadataUri") && (
                            <span className="ml-2 text-emerald-500 font-medium">✓ Uploaded</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <FormField control={collectionForm.control} name="maxSupply" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tickets available *</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} /></FormControl>
                      <FormDescription>Maximum number of tickets that can be sold.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="flex gap-3">
                    <FormField control={collectionForm.control} name="priceAmount" render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Price per ticket</FormLabel>
                        <FormControl><Input type="number" min={0} step="0.01" placeholder="0 = free" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={collectionForm.control} name="paymentToken" render={({ field }) => (
                      <FormItem className="w-28">
                        <FormLabel>Currency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LISTABLE_TOKENS.map((t) => (
                              <SelectItem key={t.symbol} value={t.symbol}>{t.symbol}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <FormField control={collectionForm.control} name="expirationDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valid until *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormDescription>Tickets lose access after this date — they stay tradeable.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={collectionForm.control} name="royalty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resale royalty %</FormLabel>
                      <FormControl><Input type="number" min={0} max={50} step="0.5" placeholder="0" {...field} /></FormControl>
                      <FormDescription>You earn this percentage whenever a ticket is resold.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
                    disabled={isCreating || imageUploading2}
                  >
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
