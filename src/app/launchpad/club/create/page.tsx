"use client";

import { useState, useRef, useEffect } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useAccount } from "@starknet-react/core";
import { hash } from "starknet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import Image from "next/image";
import { Users, Loader2, CheckCircle2, ImagePlus, X } from "lucide-react";
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
import { CreateClubAside } from "@/components/claim/create-club-aside";
import { useWallet } from "@/hooks/use-wallet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { getMedialaneClient } from "@/lib/medialane-client";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { uploadFileToIpfs, uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";
import { invalidatePortfolioCache } from "@/lib/portfolio-cache";
import { starknetProvider } from "@/lib/starknet";
import { serializeByteArray } from "@/lib/cairo-calldata";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import {
  STARKNET_IP_CLUB_FACTORY_CONTRACT,
  getTokenBySymbol,
  normalizeAddress,
  SUPPORTED_TOKENS,
} from "@medialane/sdk";
import { toast } from "sonner";
import { FadeIn } from "@/components/ui/motion-primitives";

const LISTABLE_TOKENS = SUPPORTED_TOKENS.filter((t) => t.listable);
const CLUB_DEPLOYED_SELECTOR = hash.getSelectorFromName("ClubDeployed");
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];

function serializeU256(n: bigint): string[] {
  const low = n & ((1n << 128n) - 1n);
  const high = n >> 128n;
  return [low.toString(), high.toString()];
}

function serializeOptionAddress(addr: string | undefined): string[] {
  return addr ? ["0", addr] : ["1"];
}

const schema = z.object({
  name: z.string().min(1, "Name required").max(100),
  symbol: z.string().min(1, "Symbol required").max(10).regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only"),
  description: z.string().max(500).optional(),
  maxSupply: z.string().default("").refine((v) => v === "" || (/^\d+$/.test(v) && parseInt(v, 10) >= 1), "Must be a positive integer"),
  entryFeeAmount: z.string().default("").refine((v) => v === "" || !Number.isNaN(Number(v)), "Enter a valid amount"),
  paymentToken: z.string().default("USDC"),
  royaltyBps: z.coerce.number().min(0).max(50).default(0),
});

type FormValues = z.infer<typeof schema>;

export default function CreateClubPage() {
  const { account } = useAccount();
  const { address: activeAddress } = useWallet();
  const { executeAuto } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); };
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", symbol: "", description: "", maxSupply: "", entryFeeAmount: "", paymentToken: "USDC", royaltyBps: 0 },
  });

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

  const onSubmit = async (values: FormValues) => {
    if (!activeAddress) { toast.error("Connect a wallet first"); return; }
    if (imageFile && !imageUri && !imageUploading) {
      toast.error("Image upload failed", { description: "Please re-upload the club image." });
      return;
    }

    const fee = values.entryFeeAmount ? Number(values.entryFeeAmount) : 0;
    const token = fee > 0 ? getTokenBySymbol(values.paymentToken) : null;
    if (fee > 0 && !token) { toast.error("Unsupported payment token"); return; }

    setIsSubmitting(true);
    try {
      // 1. Pin collection metadata JSON to IPFS so wallets resolve the image.
      let baseUri = imageUri ?? "";
      if (imageUri) {
        try {
          const siwsToken = await getValidToken();
          if (!siwsToken) throw new Error("no siws token");
          const metaUri = await uploadJsonToIpfs({
            name: values.name,
            description: values.description || "",
            image: imageUri,
            external_link: `https://medialane.io/account/${activeAddress}`,
          }, siwsToken);
          baseUri = metaUri;
        } catch { /* non-fatal — deploy still proceeds with imageUri */ }
      }

      // 2. Register intent so sync-tx can associate the image with this collection.
      if (imageUri) {
        try {
          const client = getMedialaneClient();
          await client.api.createCollectionIntent({
            owner: activeAddress,
            name: values.name,
            symbol: values.symbol,
            description: values.description || undefined,
            image: imageUri,
            baseUri: baseUri || undefined,
          });
        } catch { /* non-fatal */ }
      }

      // 3. Build and deploy on-chain via paymaster.
      const maxSupplyBn = values.maxSupply ? BigInt(values.maxSupply) : 0xffffffffffffffffn;
      const entryFeeBn = fee > 0 ? BigInt(Math.round(fee * 10 ** token!.decimals)) : 0n;
      const royaltyBpsBn = BigInt(Math.round(values.royaltyBps * 100));
      const paymentTokenAddr = entryFeeBn > 0n ? token?.address : undefined;

      const txHash = await executeAuto([{
        contractAddress: STARKNET_IP_CLUB_FACTORY_CONTRACT,
        entrypoint: "deploy_club",
        calldata: [
          ...serializeByteArray(values.name),
          ...serializeByteArray(values.symbol),
          ...serializeByteArray(baseUri),
          ...serializeU256(maxSupplyBn),
          ...serializeU256(entryFeeBn),
          ...serializeOptionAddress(paymentTokenAddr),
          ...serializeU256(royaltyBpsBn),
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
          e.keys?.[0] && BigInt(e.keys[0]) === BigInt(CLUB_DEPLOYED_SELECTOR)
        );
        if (deployEvent?.keys?.[1]) {
          addr = normalizeAddress("STARKNET", deployEvent.keys[1]);
        }
      } catch { /* non-fatal */ }

      // 5. Sync-tx so backend associates the intent image with this collection.
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

      // 6. Fast-path register so the collection appears immediately.
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
              source: "MEDIALANE_IP_CLUB",
            }),
          });
        } catch { /* non-fatal */ }
      }

      setDone(true);
      rewardToast("create_club");
      if (activeAddress) invalidatePortfolioCache(activeAddress);
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
            <CheckCircle2 className="h-10 w-10 text-indigo-400" />
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
            onClick={() => { setDone(false); form.reset(); clearImage(); }}
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
        subtitle="Give your closest fans a membership card — free to publish, no platform fee."
        aside={<CreateClubAside />}
      >
        <FadeIn>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Club image */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Club image</p>
                <div className="flex items-start gap-4">
                  <div
                    className="relative h-28 w-28 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                    role="button"
                    tabIndex={0}
                    aria-label="Upload club image"
                    onClick={() => !imageUploading && fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        if (!imageUploading) fileInputRef.current?.click();
                      }
                    }}
                  >
                    {imagePreview ? (
                      <Image src={imagePreview} alt="Club image" fill className="object-cover" />
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
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" /> Remove
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">JPG, PNG, GIF, SVG, WebP · max 10 MB</p>
                  </div>
                </div>
              </div>

              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Club name *</FormLabel>
                  <FormControl><Input placeholder="Inner Circle" {...field} /></FormControl>
                  <FormDescription>Your club&apos;s public name — shown on membership cards.</FormDescription>
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
                  <FormDescription>Short ticker shown in wallets — 2 to 10 uppercase letters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Textarea placeholder="What is this club about?" rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="maxSupply" render={({ field }) => (
                <FormItem>
                  <FormLabel>Member cap <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input type="number" min={1} placeholder="Unlimited" {...field} /></FormControl>
                  <FormDescription>Leave blank for no limit.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="flex gap-3">
                <FormField control={form.control} name="entryFeeAmount" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Entry fee <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Input type="number" min={0} step="0.01" placeholder="Free" {...field} /></FormControl>
                    <FormDescription>Members pay this to join. Proceeds go to your wallet.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="paymentToken" render={({ field }) => (
                  <FormItem className="w-28">
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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

              <FormField control={form.control} name="royaltyBps" render={({ field }) => (
                <FormItem>
                  <FormLabel>Royalty <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        step={0.5}
                        placeholder="0"
                        className="max-w-[120px]"
                        {...field}
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormDescription>On-chain royalty on secondary sales (0–50%). Paid to your wallet.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" size="lg" className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isSubmitting || imageUploading}>
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
