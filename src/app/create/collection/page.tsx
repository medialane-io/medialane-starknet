"use client";

import { useState, useRef, useEffect } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { CollectionProgressDialog } from "@/components/marketplace/collection-progress-dialog";
import type { CollectionStep } from "@/components/marketplace/collection-progress-dialog";
import { ConnectGate } from "@/components/connect-gate";
import { invalidatePortfolioCache } from "@/lib/portfolio-cache";
import { useTx } from "@/hooks/use-tx";
import { useWallet } from "@/hooks/use-wallet";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { MedialaneCollectionCard } from "@medialane/ui";
import { CreateCollectionAside } from "@/components/claim/create-collection-aside";
import { useMedialaneClient } from "@/hooks/use-medialane-client";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { uploadFailureToast } from "@/lib/upload-error";
import { uploadFileToIpfs, uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import { Layers, Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import type { Call } from "starknet";

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

export default function CreateCollectionPage() {
  const { execute: executeTransaction, status, txHash } = useTx();
  const { address: walletAddress, isConnected: hasWallet } = useWallet();
  const client = useMedialaneClient();
  const { getValidToken } = useSiwsToken();

  const [collectionStep, setCollectionStep] = useState<CollectionStep>("idle");
  const [collectionError, setCollectionError] = useState<string | null>(null);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", symbol: "", description: "", external_link: "" },
  });

  // Once the wallet address is known, pre-fill the external_link with the creator page URL
  useEffect(() => {
    if (walletAddress && !form.getValues("external_link")) {
      form.setValue("external_link", `https://medialane.io/account/${walletAddress}`);
    }
  }, [walletAddress, form]);

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];

  const handleImageSelect = async (file: File) => {
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported format", { description: "Please upload a JPG, PNG, GIF, SVG, or WebP image." });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", {
        description: `Max size is 10 MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please compress or resize it first.`,
      });
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
      if (!siwsToken) throw new Error("Please sign in with your wallet to upload images.");
      const upload = await uploadFileToIpfs(file, siwsToken);
      setImageUri(upload.uri);
      toast.success("Image uploaded");
    } catch (err: unknown) {
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
    // If the user selected an image but the upload failed, block submission
    if (imageFile && !imageUri && !imageUploading) {
      toast.error("Image upload failed", { description: "Please re-upload your collection image before continuing." });
      return;
    }
    if (!hasWallet) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!walletAddress) return;

    setCollectionError(null);
    setCollectionStep("processing");

    try {
      // 1. Upload collection metadata JSON to IPFS so permissionless dapps can resolve
      //    the collection image onchain (base_uri → collection metadata → image field).
      let baseUri: string | undefined;
      if (imageUri) {
        const metaToken = await getValidToken();
        if (!metaToken) throw new Error("Please sign in with your wallet to upload collection metadata.");
        baseUri = await uploadJsonToIpfs({
          name: values.name,
          description: values.description || "",
          image: imageUri,
          external_link: values.external_link || "https://medialane.io",
        }, metaToken);
      }

      // 2. Create collection intent — pre-signed, returns calls immediately
      const intentRes = await client.api.createCollectionIntent({
        owner: walletAddress,
        name: values.name,
        symbol: values.symbol,
        description: values.description || undefined,
        image: imageUri || undefined,
        baseUri,
      });

      const intentData = intentRes.data;
      if (intentData.requiresSignature) {
        throw new Error("Collection intent should be pre-signed but requires a signature");
      }
      const calls = intentData.calls as Call[];
      if (!calls || calls.length === 0) throw new Error("No calls returned from intent");

      // 3. Execute directly with the connected wallet
      const result = await executeTransaction(calls);

      if (result === null) {
        throw new Error("Collection transaction reverted on chain");
      }

      // Immediately register the collection from the tx so it appears in portfolio without waiting for the indexer.
      try {
        await Promise.race([
          fetch(`${MEDIALANE_BACKEND_URL}/v1/collections/sync-tx`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(MEDIALANE_API_KEY ? { "x-api-key": MEDIALANE_API_KEY } : {}) },
            body: JSON.stringify({ txHash: result }),
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(), 6000)),
        ]);
      } catch {
        // timeout or error — indexer will catch up regardless
      }

      setCollectionStep("success");
      rewardToast("create_collection");
      invalidatePortfolioCache(walletAddress);
    } catch (err: unknown) {
      setCollectionError(err instanceof Error ? err.message : "Something went wrong");
      setCollectionStep("error");
    }
  };

  const handleCreateAnother = () => {
    setCollectionStep("idle");
    setCollectionError(null);
    form.reset();
    clearImage();
  };

  return (
    <>
      <CollectionProgressDialog
        open={collectionStep !== "idle"}
        collectionStep={collectionStep}
        txStatus={status}
        collectionName={form.getValues("name") ?? ""}
        imagePreview={imagePreview}
        txHash={txHash}
        error={collectionError}
        onCreateAnother={handleCreateAnother}
        mintHref="/create/asset"
      />

      <ConnectGate
        title="Connect to create a collection"
        subtitle="Connect your wallet to deploy a collection on Starknet."
      >
      <ClaimRouteShell
        gated={false}
        icon={<Layers className="h-4 w-4 text-white" />}
        title="Create a Collection"
        subtitle="Set up a collection to mint your work into — free to publish, and it's yours."
        aside={
          <>
            {/* Live collectors-card preview of the collection being created */}
            <MedialaneCollectionCard
              image={imagePreview}
              name={form.watch("name") || "My Creative Works"}
              collection={form.watch("symbol") || "Collection"}
              creator={walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : undefined}
            />
            <CreateCollectionAside />
          </>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
                    ) : imageFile ? (
                      "Change image"
                    ) : (
                      "Upload image"
                    )}
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
                    {imageUri && (
                      <span className="ml-2 text-emerald-500 font-medium">✓ Uploaded</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection name *</FormLabel>
                  <FormControl>
                    <Input placeholder="My Creative Works" {...field} />
                  </FormControl>
                  <FormDescription>The display name for your collection.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="MCW"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormDescription>
                    Short ticker (2–10 uppercase letters). Shown in wallets and marketplaces.
                  </FormDescription>
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
                    <Textarea
                      placeholder="Describe your collection and what kind of work it contains…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="external_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External link <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="https://yourwebsite.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your website, portfolio, or social profile — saved with your collection so it travels with it.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={collectionStep !== "idle" || imageUploading}
              className={`w-full h-12 text-base font-semibold text-white rounded-xl flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-brand-blue ${collectionStep !== "idle" || imageUploading ? "opacity-40 pointer-events-none" : ""}`}
            >
              <Layers className="h-4 w-4" />
              Create collection
            </button>
            <p className="text-xs text-center text-muted-foreground">
              Zero platform fees to publish.
            </p>
          </form>
        </Form>
      </ClaimRouteShell>
      </ConnectGate>
    </>
  );
}
