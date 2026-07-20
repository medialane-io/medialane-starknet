"use client";

import { useState, useRef, useEffect } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { withSiwsAuth } from "@/lib/pinata-fetch";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { uploadFailureToast } from "@/lib/upload-error";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { Users, Loader2, ChevronRight, ImagePlus, X } from "lucide-react";
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
import {
  CollectionProgressDialog,
  type CollectionStep,
} from "@/components/marketplace/collection-progress-dialog";
import type { TxStatus } from "@/hooks/use-tx";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { ClaimRail, MedialaneCollectionCard } from "@medialane/ui";
import { toast } from "sonner";
import { Contract, hash } from "starknet";
import { normalizeAddress, STARKNET_IP_CLUB_FACTORY_CONTRACT } from "@medialane/sdk";
import { IPClubFactoryABI } from "@medialane/sdk/starknet";
import { starknetProvider } from "@/lib/starknet";
import { useMyClubCollections } from "@/hooks/use-club";

const CLUB_DEPLOYED_SELECTOR = hash.getSelectorFromName("ClubDeployed");
const FACTORY = STARKNET_IP_CLUB_FACTORY_CONTRACT as string;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];

const schema = z.object({
  name: z.string().min(1, "Name required").max(100),
  symbol: z
    .string()
    .min(1, "Symbol required")
    .max(10, "Max 10 characters")
    .regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only"),
  description: z.string().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

async function readDeployedAddress(txHash: string): Promise<string | null> {
  try {
    const receipt = await starknetProvider.getTransactionReceipt(txHash);
    const events = (receipt as any).events ?? [];
    for (const ev of events) {
      if (ev.keys?.[0] === CLUB_DEPLOYED_SELECTOR) {
        return ev.keys?.[1] ? normalizeAddress("STARKNET", ev.keys[1]) : null;
      }
    }
  } catch {}
  return null;
}

export default function CreateClubPage() {
  const { address, isConnected } = useWallet();
  const { executeAuto } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();
  const { mutate } = useMyClubCollections(address ?? null);

  const [collectionStep, setCollectionStep] = useState<CollectionStep>("idle");
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [dialogTxStatus, setDialogTxStatus] = useState<TxStatus>("idle");

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
    defaultValues: { name: "", symbol: "", description: "" },
  });

  const handleReset = () => {
    setCollectionStep("idle");
    setCollectionError(null);
    setDeployedAddress(null);
    setDialogTxStatus("idle");
    form.reset();
    setImagePreview(null);
    setImageUri(null);
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
  };

  const handleImageSelect = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported format", { description: "Please upload a JPG, PNG, GIF, SVG, or WebP image." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image too large", { description: `Max 10 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB.` });
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setImagePreview(objectUrl);
    setImageUri(null);
    setImageUploading(true);
    try {
      const token = await getValidToken();
      const signedRes = await fetch("/api/pinata/signed-url", withSiwsAuth(token, { method: "POST" }));
      const signedData = await signedRes.json();
      if (!signedRes.ok || !signedData.url) throw new Error("Failed to get upload URL");
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("network", "public");
      fd.append("name", file.name);
      const uploadRes = await fetch(signedData.url, { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { data } = await uploadRes.json();
      if (!data?.cid) throw new Error("No CID returned");
      setImageUri(`ipfs://${data.cid}`);
      toast.success("Image uploaded");
    } catch (err) {
      const t = uploadFailureToast(err);
      toast.error(t.title, { description: t.description });
      setImagePreview(null);
      setImageUri(null);
    } finally {
      setImageUploading(false);
    }
  };

  async function onSubmit(values: FormValues) {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!FACTORY) { toast.error("IP Club not yet available on this chain"); return; }
    if (imagePreview && !imageUri && !imageUploading) {
      toast.error("Image upload failed", { description: "Please re-upload your club image." });
      return;
    }

    setCollectionError(null);
    setDialogTxStatus("idle");
    setCollectionStep("processing");

    try {
      // Pin collection metadata to IPFS first so the URI can go on-chain in the deploy tx.
      // base_uri on the contract is the authoritative source — the backend is just a cache.
      // If an image was provided, a failed pin is fatal: deploying with an empty
      // base_uri would permanently strip the club image (contracts are immutable).
      let baseUri = "";
      if (imageUri) {
        const token = await getValidToken();
        const res = await fetch("/api/pinata/json", withSiwsAuth(token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            description: values.description || "",
            image: imageUri,
          }),
        }));
        const pinData = await res.json();
        if (!res.ok || !pinData?.uri) {
          throw new Error(pinData?.error ?? "Club metadata upload failed — please try again");
        }
        // Bare file URI — a trailing slash makes resolvers treat it as a
        // directory and probe <uri>/collection.json, which doesn't exist.
        baseUri = pinData.uri;
      }

      const factory = new Contract({ abi: IPClubFactoryABI as any, address: FACTORY, providerOrAccount: starknetProvider });
      const call = factory.populate("deploy_collection", [values.name, values.symbol, baseUri]);

      setDialogTxStatus("submitting");
      const txH = await executeAuto([call]);
      if (!txH) throw new Error("Transaction failed");
      setDialogTxStatus("confirming");

      const addr = await readDeployedAddress(txH);

      void mutate();
      setDeployedAddress(addr);
      setDialogTxStatus("confirmed");
      setCollectionStep("success");
      rewardToast("create_club");
    } catch (err: any) {
      setCollectionError(err?.message ?? "Something went wrong");
      setDialogTxStatus("idle");
      setCollectionStep("error");
    }
  }

  if (!isConnected) {
    return (
      <ConnectGate
        title="Connect wallet to create a club"
        subtitle="Connect your Starknet wallet to create a membership club."
      >
        <div />
      </ConnectGate>
    );
  }

  return (
    <>
      <CollectionProgressDialog
        open={collectionStep !== "idle"}
        collectionStep={collectionStep}
        txStatus={dialogTxStatus}
        collectionName={form.getValues("name")}
        imagePreview={imagePreview}
        txHash={null}
        error={collectionError}
        onCreateAnother={handleReset}
        createAnotherLabel="Create another"
        firstStepLabel="Deploy club"
        mintHref={deployedAddress ? `/collections/${deployedAddress}` : undefined}
        mintLabel="Create memberships"
        deployedAddress={deployedAddress}
      />

      <ClaimRouteShell
        icon={<Users className="h-4 w-4 text-white" />}
        title="Create Club"
        subtitle="One club — create membership tiers and mint cards to your community."
        gated={false}
        aside={
          <>
          <MedialaneCollectionCard
            image={imagePreview}
            name={form.watch("name")}
            collection={form.watch("symbol") || "Club"}
            creator={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : undefined}
          />
          <ClaimRail
            included={[
              { icon: Users, title: "One club, many tiers", desc: "Create as many membership tiers as you need without deploying again." },
              { icon: ChevronRight, title: "You keep full control", desc: "Only you can create tiers and mint membership cards." },
            ]}
            steps={[
              "Create your club — set name, symbol, and cover image",
              "Create membership tiers — each gets its own supply and optional validity window",
              "Mint membership cards and sell them on the marketplace like any asset",
            ]}
            trustIcon={Users}
            trustLead="Your club, your rules."
            trust="Only you can create tiers and mint cards. Members keep their cards and trade them freely."
          />
          </>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

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
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!imageUploading) fileInputRef.current?.click(); } }}
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
                <div className="space-y-2 flex-1 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={imageUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUploading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</> : imagePreview ? "Change image" : "Upload image"}
                  </Button>
                  {imagePreview && (
                    <button type="button" onClick={() => { setImagePreview(null); setImageUri(null); }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
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

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Club name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="My Club" {...field} />
                  </FormControl>
                  <FormDescription>Your club&apos;s name — shown in wallets and explorers.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      placeholder="CLUB"
                      maxLength={10}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>Short ticker — 2 to 10 uppercase letters.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your club — what does membership unlock?"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={collectionStep !== "idle" || imageUploading}
              className={`w-full h-12 text-base font-semibold text-white rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-brand-purple ${collectionStep !== "idle" || imageUploading ? "opacity-40 pointer-events-none" : ""}`}
            >
              <Users className="h-4 w-4" />
              Create Club
            </button>
          </form>
        </Form>
      </ClaimRouteShell>
    </>
  );
}
