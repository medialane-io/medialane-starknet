"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { getService } from "@medialane/sdk";
import { withSiwsAuth } from "@/lib/pinata-fetch";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useTx } from "@/hooks/use-tx";
import { useWallet } from "@/hooks/use-wallet";
import { useMedialaneClient } from "@/hooks/use-medialane-client";
import { useCollectionsByOwner } from "@/hooks/use-collections";
import { MintProgressDialog } from "@/components/marketplace/mint-progress-dialog";
import type { MintStep } from "@/components/marketplace/mint-progress-dialog";
import { invalidatePortfolioCache } from "@/lib/portfolio-cache";
import { cn } from "@/lib/utils";
import { absoluteUrl } from "@/lib/seo";
import {
  IP_TYPES,
  LICENSE_TYPES,
  GEOGRAPHIC_SCOPES,
  AI_POLICIES,
  DERIVATIVES_OPTIONS,
  type IPType,
} from "@/types/ip";
import { IPTypeFields, type MetadataField } from "@/components/create/ip-type-fields";
import {
  Upload,
  ChevronDown,
  ShieldCheck,
  Boxes,
  Plus,
  ImagePlus,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { Call } from "starknet";

const schema = z.object({
  collectionId: z.string().min(1, "Select a collection"),
  name: z.string().min(1, "Name required").max(100),
  description: z.string().max(1000).optional(),
  external_url: z
    .string()
    .max(500)
    .refine((v) => !v || v.startsWith("http://") || v.startsWith("https://"), {
      message: "Must start with http:// or https://",
    })
    .optional(),
  ipType: z.enum(IP_TYPES),
  licenseType: z.string().min(1, "License required"),
  commercialUse: z.enum(["Yes", "No"]),
  derivatives: z.enum(["Allowed", "Not Allowed", "Share-Alike"]),
  attribution: z.enum(["Required", "Not Required"]),
  geographicScope: z.string(),
  aiPolicy: z.enum(["Allowed", "Not Allowed", "Training Only"]),
  royalty: z.coerce.number().min(0).max(50),
  image: z.instanceof(File).optional(),
});

type FormValues = z.infer<typeof schema>;

function ToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-border overflow-hidden w-full">
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "flex-1 px-3 py-2 text-sm transition-colors",
            i > 0 && "border-l border-border",
            value === opt
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-background hover:bg-muted text-muted-foreground"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function CreateAssetPage() {
  const { execute: executeTransaction, status, txHash, error, statusMessage } = useTx();
  const { address: walletAddress } = useWallet();
  const { getValidToken } = useSiwsToken();
  const client = useMedialaneClient();

  // Fetch user's current Medialane ERC-721 collections from the API.
  const { collections: allCollections, isLoading: collectionsLoading } = useCollectionsByOwner(walletAddress ?? null);
  const collections = allCollections.filter(
    (c) => getService(c.service)?.id === "mip-erc721" && c.collectionId != null
  );

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [licensingOpen, setLicensingOpen] = useState(false);
  const [ipTypeOpen, setIpTypeOpen] = useState(false);
  const [mintStep, setMintStep] = useState<MintStep>("idle");
  const [mintError, setMintError] = useState<string | null>(null);
  const [templateFields, setTemplateFields] = useState<MetadataField[]>([]);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const hasWallet = !!walletAddress;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      collectionId: "",
      name: "",
      description: "",
      external_url: "",
      ipType: "NFT",
      licenseType: "CC BY-SA",
      commercialUse: "Yes",
      derivatives: "Share-Alike",
      attribution: "Required",
      geographicScope: "Worldwide",
      aiPolicy: "Not Allowed",
      royalty: 0,
    },
  });

  // When a collection is selected, pre-fill external_url with the collection page URL
  const selectedCollectionId = form.watch("collectionId");
  useEffect(() => {
    const col = collections.find((c) => c.collectionId === selectedCollectionId);
    if (col?.contractAddress && !form.getValues("external_url")) {
      form.setValue("external_url", absoluteUrl(`/collections/${col.contractAddress}`));
    }
  }, [selectedCollectionId, collections, form]);

  const handleLicenseChange = (value: string) => {
    form.setValue("licenseType", value);
    const def = LICENSE_TYPES.find((l) => l.value === value);
    if (def) {
      form.setValue("commercialUse", def.commercialUse);
      form.setValue("derivatives", def.derivatives);
      form.setValue("attribution", def.attribution);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!hasWallet) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!walletAddress) return;

    setMintError(null);
    setMintStep("uploading");

    // [TEMP-DEBUG service-model] mint-input snapshot for diagnosis. Remove after.
    const _sel = collections.find((c) => c.collectionId === values.collectionId);
    const mintDbg: Record<string, unknown> = {
      wallet: walletAddress,
      collectionIdInput: values.collectionId,
      selectedCollection: _sel
        ? {
            contractAddress: _sel.contractAddress,
            collectionId: _sel.collectionId,
            service: _sel.service,
            source: _sel.source,
            standard: _sel.standard,
            owner: _sel.owner,
            name: _sel.name,
          }
        : null,
    };

    try {
      // 1. Upload image + metadata to IPFS via /api/pinata
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("description", values.description ?? "");
      if (values.external_url) formData.set("external_url", values.external_url);
      formData.set("creator", walletAddress);
      formData.set("ipType", values.ipType);
      formData.set("licenseType", values.licenseType);
      formData.set("commercialUse", values.commercialUse);
      formData.set("derivatives", values.derivatives);
      formData.set("attribution", values.attribution);
      formData.set("geographicScope", values.geographicScope);
      formData.set("aiPolicy", values.aiPolicy);
      formData.set("royalty", String(values.royalty));
      const token = await getValidToken();
      if (imageFile) {
        // Upload image directly to Pinata via signed URL (bypasses Next.js 4 MB body limit)
        const signedRes = await fetch("/api/pinata/signed-url", withSiwsAuth(token, { method: "POST" }));
        const signedData = await signedRes.json();
        if (!signedRes.ok || !signedData.url) throw new Error("Failed to get upload URL");
        const imgFormData = new FormData();
        imgFormData.append("file", imageFile, imageFile.name);
        imgFormData.append("network", "public");
        imgFormData.append("name", imageFile.name);
        const uploadRes2 = await fetch(signedData.url, { method: "POST", body: imgFormData });
        if (!uploadRes2.ok) throw new Error("Image upload to IPFS failed");
        const uploadJson = await uploadRes2.json();
        const cid = uploadJson.data?.cid;
        if (!cid) throw new Error("Image upload returned no CID");
        formData.set("imageUri", `ipfs://${cid}`);
      }

      // Forward suggested and custom traits — keyed as "tmpl_{trait_type}".
      templateFields.forEach(({ traitType, value }) => {
        if (traitType.trim() && value.trim()) formData.append(`tmpl_${traitType.trim()}`, value.trim());
      });

      const uploadRes = await fetch("/api/pinata", withSiwsAuth(token, { method: "POST", body: formData }));
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.error) {
        throw new Error(uploadData.error ?? "IPFS upload failed");
      }
      const tokenUri: string = uploadData.uri;
      mintDbg.tokenUri = tokenUri;
      if (!tokenUri) throw new Error("IPFS upload returned no URI");

      setMintStep("processing");

      // 2. Create mint intent — backend validates ownership onchain + encodes Cairo calldata
      const intentRes = await client.api.createMintIntent({
        owner: walletAddress,
        collectionId: values.collectionId,
        recipient: walletAddress,
        tokenUri,
      });

      const intentData = intentRes.data as { calls?: { contractAddress: string; [key: string]: unknown }[] } | undefined;
      mintDbg.intentCalls = intentData?.calls ?? null;
      mintDbg.intentCallsCount = intentData?.calls?.length ?? 0;
      if (!intentData?.calls?.length) {
        throw new Error("Mint intent returned no calls");
      }

      // 3. Execute directly with the connected wallet
      const result = await executeTransaction(intentData.calls as Call[]);

      if (result === null) {
        throw new Error("Mint transaction reverted on chain");
      }

      setMintStep("success");
      invalidatePortfolioCache(walletAddress);
    } catch (err: unknown) {
      // [TEMP-DEBUG service-model] dump mint-input snapshot; pair with the
      // [TX-DEBUG] block from use-tx.ts for the on-chain/submission reason.
      mintDbg.executeResult =
        mintStep === "processing" ? "executeTransaction returned null (see [TX-DEBUG])" : "failed before execute";
      mintDbg.thrown = err instanceof Error ? err.message : String(err);
      try {
        // eslint-disable-next-line no-console
        console.error(
          "[MINT-DEBUG]\n" +
            JSON.stringify(mintDbg, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2),
        );
      } catch { /* noop */ }
      setMintError(err instanceof Error ? err.message : "Something went wrong");
      setMintStep("error");
    }
  };

  const handleMintAnother = () => {
    setMintStep("idle");
    setMintError(null);
    form.reset({
      collectionId: "",
      name: "",
      description: "",
      external_url: "",
      ipType: "NFT",
      licenseType: "CC BY-SA",
      commercialUse: "Yes",
      derivatives: "Share-Alike",
      attribution: "Required",
      geographicScope: "Worldwide",
      aiPolicy: "Not Allowed",
      royalty: 0,
    });
    setTemplateFields([]);
    setImageFile(null);
    setImagePreview(null);
  };

  return (
    <>
      <MintProgressDialog
        open={mintStep !== "idle"}
        mintStep={mintStep}
        txStatus={status}
        assetName={form.getValues("name") ?? ""}
        imagePreview={imagePreview}
        txHash={txHash}
        error={mintError}
        onMintAnother={handleMintAnother}
      />

      <div className="container max-w-2xl mx-auto px-4 pt-14 pb-8 space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <ImagePlus className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Create</span>
          </div>
          <h1 className="text-3xl font-bold">Create IP Asset</h1>
          <p className="text-muted-foreground">
            Mint your creative work as a programmable NFT on Starknet with immutable licensing embedded in IPFS metadata.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Collection selector */}
            <FormField
              control={form.control}
              name="collectionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Boxes className="h-4 w-4" />
                    Collection *
                  </FormLabel>
                  {collectionsLoading ? (
                    <Skeleton className="h-10 w-full rounded-md" />
                  ) : collections.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        You don&apos;t have any collections yet. Create one first.
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/create/collection">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Create collection
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a collection" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {collections.map((col) => (
                          <SelectItem key={col.collectionId!} value={col.collectionId!}>
                            {col.name || col.symbol || `Collection #${col.collectionId}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Cover image */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cover image</label>
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                role="button"
                tabIndex={0}
                aria-label="Upload image"
                onClick={() => document.getElementById("image-upload")?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.getElementById("image-upload")?.click(); } }}
              >
                {imagePreview ? (
                  <Image src={imagePreview} alt="Preview" width={320} height={192} className="mx-auto max-h-48 w-auto rounded-lg object-contain" unoptimized />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-8 w-8" />
                    <p className="text-sm">Click to upload (JPG, PNG, GIF, SVG, WebP · max 10 MB)</p>
                  </div>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("File too large", { description: "Maximum file size is 10 MB." });
                      e.target.value = "";
                      return;
                    }
                    if (!ALLOWED.includes(file.type)) {
                      toast.error("Unsupported format", { description: "Please upload a JPG, PNG, GIF, SVG, or WebP image." });
                      e.target.value = "";
                      return;
                    }
                    setImageFile(file);
                    form.setValue("image", file);
                    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
                    const objectUrl = URL.createObjectURL(file);
                    previewUrlRef.current = objectUrl;
                    setImagePreview(objectUrl);
                  }}
                />
              </div>
            </div>

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="My Creative Work" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your work, its story, and any context for buyers…"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* External URL */}
            <FormField
              control={form.control}
              name="external_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External link <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="https://yourwebsite.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Licensing Terms — optional, collapsed by default */}
            <Collapsible open={licensingOpen} onOpenChange={setLicensingOpen}>
              <div className="rounded-xl border border-border overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Licensing Terms</span>
                      <span className="text-xs text-muted-foreground font-normal">Optional · Berne Convention</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", licensingOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 space-y-4 border-t border-border/60 pt-4">
                    <p className="text-xs text-muted-foreground">
                      Set licensing terms for your work. These are embedded as immutable IPFS metadata and Berne Convention-compatible.
                    </p>
                    <FormField
                      control={form.control}
                      name="licenseType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License</FormLabel>
                          <Select value={field.value} onValueChange={handleLicenseChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {LICENSE_TYPES.map((l) => (
                                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(() => {
                            const def = LICENSE_TYPES.find((l) => l.value === field.value);
                            return def ? (
                              <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
                            ) : null;
                          })()}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="commercialUse"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commercial Use</FormLabel>
                          <ToggleGroup value={field.value} options={["Yes", "No"]} onChange={field.onChange} />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="derivatives"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Derivatives</FormLabel>
                          <ToggleGroup value={field.value} options={DERIVATIVES_OPTIONS} onChange={field.onChange} />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="attribution"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Attribution</FormLabel>
                          <ToggleGroup value={field.value} options={["Required", "Not Required"]} onChange={field.onChange} />
                        </FormItem>
                      )}
                    />
                    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")} />
                          Advanced options
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-4 pt-3">
                        <FormField
                          control={form.control}
                          name="geographicScope"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Territory</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {GEOGRAPHIC_SCOPES.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="aiPolicy"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>AI &amp; Data Mining</FormLabel>
                              <ToggleGroup value={field.value} options={AI_POLICIES} onChange={field.onChange} />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="royalty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Royalty % (0–50)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  max={50}
                                  step={0.5}
                                  placeholder="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* IP Type & template fields — optional, collapsed by default */}
            <Collapsible open={ipTypeOpen} onOpenChange={setIpTypeOpen}>
              <div className="rounded-xl border border-border overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">IP Type &amp; Metadata</span>
                      <span className="text-xs text-muted-foreground font-normal">Optional</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", ipTypeOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-5 pb-5 space-y-4 border-t border-border/60 pt-4">
                    <p className="text-xs text-muted-foreground">
                      Choose a content type to unlock optional metadata fields tailored to your work — artist credits, embed links, technical specs, and more.
                    </p>
                    <FormField
                      control={form.control}
                      name="ipType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IP Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {IP_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <IPTypeFields
                      ipType={form.watch("ipType") as IPType}
                      onChange={setTemplateFields}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            <div className={`btn-border-animated p-[1px] rounded-xl ${mintStep !== "idle" || collectionsLoading || collections.length === 0 ? "opacity-40 pointer-events-none" : ""}`}>
              <button
                type="submit"
                disabled={mintStep !== "idle" || collectionsLoading || collections.length === 0}
                className="w-full h-12 text-base font-semibold text-white rounded-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] bg-brand-blue"
              >
                Mint asset
              </button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Gas is free. Your PIN signs the mint transaction.
            </p>
          </form>
        </Form>
      </div>
    </>
  );
}
