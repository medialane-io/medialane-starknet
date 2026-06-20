"use client";

import { useState, useRef, useEffect } from "react";
import { withSiwsAuth } from "@/lib/pinata-fetch";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { uploadFailureToast } from "@/lib/upload-error";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { Layers, Loader2, ImagePlus, X } from "lucide-react";
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
import { toast } from "sonner";
import {
  COLLECTION_1155_CONTRACT_MAINNET,
  normalizeAddress,
} from "@medialane/sdk";
import { hash } from "starknet";
import { starknetProvider } from "@/lib/starknet";
import { serializeByteArray } from "@/lib/cairo-calldata";
import { invalidatePortfolioCache } from "@/lib/portfolio-cache";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";

const FACTORY = COLLECTION_1155_CONTRACT_MAINNET as `0x${string}`;
const COLLECTION_DEPLOYED_SELECTOR = hash.getSelectorFromName("CollectionDeployed");

const schema = z.object({
  name: z.string().min(1, "Name required").max(100),
  symbol: z
    .string()
    .min(1, "Symbol required")
    .max(10, "Max 10 characters")
    .regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only"),
  description: z.string().max(500).optional(),
  external_link: z
    .string()
    .max(500)
    .refine((v) => !v || v.startsWith("http://") || v.startsWith("https://"), {
      message: "Must start with http:// or https://",
    })
    .optional(),
});

type FormValues = z.infer<typeof schema>;

export default function CreateNFTEditionsCollectionPage() {
  const { isConnected, address: walletAddress } = useWallet();
  const { executeAuto } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();

  const [collectionStep, setCollectionStep] = useState<CollectionStep>("idle");
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [dialogTxStatus, setDialogTxStatus] = useState<TxStatus>("idle");

  // Image upload state
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
    defaultValues: { name: "", symbol: "", description: "", external_link: "" },
  });

  // Default external_link to the creator's public profile on medialane.io —
  // matches the ERC-721 create-collection form and gives collectors a
  // landing page even when the creator doesn't have a personal site yet.
  // The creator can still override before submitting.
  useEffect(() => {
    if (walletAddress && !form.getValues("external_link")) {
      form.setValue("external_link", `https://medialane.io/account/${walletAddress}`);
    }
  }, [walletAddress, form]);

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];

  const handleImageSelect = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
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

  const handleReset = () => {
    setCollectionStep("idle");
    setCollectionError(null);
    setDeployedAddress(null);
    setDialogTxStatus("idle");
    form.reset();
    clearImage();
  };

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (imageFile && !imageUri && !imageUploading) {
      toast.error("Image upload failed", { description: "Please re-upload your collection image." });
      return;
    }

    setCollectionError(null);
    setDialogTxStatus("idle");
    setCollectionStep("processing");

    try {
      // 1. Pin metadata JSON to IPFS
      let collectionMetaUri: string | undefined;
      if (imageUri) {
        try {
          const token = await getValidToken();
          const r = await fetch("/api/pinata/json", withSiwsAuth(token, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: values.name,
              description: values.description || "",
              image: imageUri,
              external_link: values.external_link || "",
            }),
          }));
          const d = await r.json();
          if (d.uri) collectionMetaUri = d.uri;
        } catch { /* non-fatal */ }
      }

      // 2. Execute deploy_collection on the factory.
      // Build calldata manually using byteArray.byteArrayFromString().
      // v2 factory signature: deploy_collection(name, symbol, base_uri)
      setDialogTxStatus("submitting");
      const txHash = await executeAuto([{
        contractAddress: FACTORY,
        entrypoint: "deploy_collection",
        calldata: [
          ...serializeByteArray(values.name),
          ...serializeByteArray(values.symbol),
          ...serializeByteArray(collectionMetaUri ?? ""),
        ],
      }]);

      if (!txHash) throw new Error("Transaction failed — no hash returned");
      setDialogTxStatus("confirming");

      // 3. Extract deployed collection address from CollectionDeployed event in the receipt.
      // Best-effort: if event parsing fails the tx still succeeded — the collection will
      // appear in portfolio once the indexer processes the event on the next poll cycle.
      let addr: string | null = null;
      try {
        let receipt: any = null;
        for (let attempt = 0; attempt < 2 && !receipt; attempt++) {
          try {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
            receipt = await starknetProvider.getTransactionReceipt(txHash);
          } catch { /* retry */ }
        }
        const events = receipt?.events ?? [];
        const deployEvent = events.find((e: any) =>
          e.keys?.[0] && BigInt(e.keys[0]) === BigInt(COLLECTION_DEPLOYED_SELECTOR)
        );
        if (deployEvent?.keys?.[1]) addr = normalizeAddress("STARKNET", deployEvent.keys[1]);
      } catch { /* non-fatal */ }

      // 4. Register with backend so the collection appears in portfolio immediately.
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
              standard: "ERC1155",
              source: "MEDIALANE_ERC1155",
            }),
          });
        } catch { /* non-fatal */ }
      }

      if (walletAddress) invalidatePortfolioCache(walletAddress);
      setDeployedAddress(addr);
      setDialogTxStatus("confirmed");
      setCollectionStep("success");
    } catch (err) {
      setCollectionError(err instanceof Error ? err.message : "Something went wrong");
      setDialogTxStatus("idle");
      setCollectionStep("error");
    }
  };

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
        createAnotherLabel="Deploy another"
        firstStepLabel="Prepare metadata"
        mintHref={deployedAddress ? `/launchpad/nfteditions/${deployedAddress}/mint` : undefined}
        deployedAddress={deployedAddress}
      />

      <ConnectGate
        title="Connect wallet to create a collection"
        subtitle="Connect your Starknet wallet to create an editions collection."
      >
      <div className="container max-w-2xl mx-auto px-4 pt-14 pb-8 space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">IP Collection · ERC-1155</span>
          </div>
          <h1 className="text-3xl font-bold">Create IP Collection</h1>
          <p className="text-muted-foreground">
            Deploy a multi-edition ERC-1155 collection on Starknet. Gas is free.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ── Collection image ── */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Collection image</p>
              <div className="flex items-start gap-4">
                <div
                  className="relative h-28 w-28 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                  role="button"
                  tabIndex={0}
                  aria-label="Upload collection image"
                  onClick={() => !imageUploading && fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!imageUploading) fileInputRef.current?.click(); } }}
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
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={imageUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUploading
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                      : imageFile ? "Change image" : "Upload image"}
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
                    {imageUri && <span className="ml-2 text-emerald-500 font-medium">✓ Uploaded to IPFS</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Name ── */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Collection name *</FormLabel>
                <FormControl><Input placeholder="My Creative Works" {...field} /></FormControl>
                <FormDescription>The display name for your collection.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* ── Symbol ── */}
            <FormField control={form.control} name="symbol" render={({ field }) => (
              <FormItem>
                <FormLabel>Symbol *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="MCW"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormDescription>Short ticker (2–10 uppercase letters). Shown in wallets and explorers.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* ── Description ── */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Describe your collection and what kind of work it contains…" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* ── External link ── */}
            <FormField control={form.control} name="external_link" render={({ field }) => (
              <FormItem>
                <FormLabel>External link <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                <FormControl><Input placeholder="https://yourwebsite.com" {...field} /></FormControl>
                <FormDescription>Your website, portfolio, or social profile. Stored in collection metadata on IPFS.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* ── Submit ── */}
            <div className={`btn-border-animated p-[1px] rounded-xl ${collectionStep !== "idle" || imageUploading ? "opacity-40 pointer-events-none" : ""}`}>
              <button
                type="submit"
                disabled={collectionStep !== "idle" || imageUploading}
                className="w-full h-12 text-base font-semibold text-white rounded-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-violet-600"
              >
                <Layers className="h-4 w-4" />
                Deploy Collection
              </button>
            </div>

          </form>
        </Form>
      </div>
      </ConnectGate>
    </>
  );
}
