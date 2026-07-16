"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { withSiwsAuth } from "@/lib/pinata-fetch";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { uploadFailureToast } from "@/lib/upload-error";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Image from "next/image";
import Link from "next/link";
import { Sparkles, Loader2, ImagePlus, X, Layers, ChevronDown, ShieldCheck } from "lucide-react";
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
import {
  MintProgressDialog,
  type MintStep,
} from "@/components/marketplace/mint-progress-dialog";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { toast } from "sonner";
import { FadeIn } from "@/components/ui/motion-primitives";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { MedialaneCollectionCard } from "@medialane/ui";
import { MintEditionAside } from "@/components/claim/mint-edition-aside";
import { normalizeAddress } from "@medialane/sdk";
import { hash } from "starknet";
import { starknetProvider } from "@/lib/starknet";
import { EXPLORER_URL } from "@/lib/constants";
import { absoluteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { invalidatePortfolioCache } from "@/lib/portfolio-cache";
import { serializeByteArray, encodeU256 } from "@/lib/cairo-calldata";
import {
  IP_TYPES,
  LICENSE_TYPES,
  GEOGRAPHIC_SCOPES,
  AI_POLICIES,
  DERIVATIVES_OPTIONS,
  type IPType,
} from "@/types/ip";
import { IPTypeFields, type MetadataField } from "@/components/create/ip-type-fields";
import { makeUploadDocument } from "@/lib/upload-document";
import type { TxStatus } from "@/hooks/use-tx";

const schema = z.object({
  value: z
    .string()
    .min(1, "Quantity required")
    .regex(/^\d+$/, "Must be a positive integer")
    .refine((v) => parseInt(v, 10) >= 1, "Minimum 1"),
  recipient: z.string().min(1, "Recipient address required"),
  name: z.string().min(1, "Token name required").max(100),
  description: z.string().max(500).optional(),
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
});

type FormValues = z.infer<typeof schema>;

/** Reads the token id the contract assigned, from the IPMinted event of a mint_edition tx. */
async function readAssignedEditionId(txHash: string, collection: string): Promise<string> {
  const receipt = await starknetProvider.getTransactionReceipt(txHash);
  const selector = hash.getSelectorFromName("IPMinted");
  const events = (receipt as unknown as { events?: Array<{ from_address: string; keys: string[] }> }).events ?? [];
  const ev = events.find(
    (e) =>
      BigInt(e.from_address) === BigInt(collection) &&
      e.keys?.[0] != null &&
      BigInt(e.keys[0]) === BigInt(selector),
  );
  if (!ev) throw new Error("Minted, but could not read the assigned token id from the receipt");
  // keys = [selector, token_id_low, token_id_high, recipient]; token_id is a u256 key.
  const low = BigInt(ev.keys[1] ?? 0);
  const high = BigInt(ev.keys[2] ?? 0);
  return (low + (high << 128n)).toString();
}

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

export default function MintNFTEditionsPage() {
  const { contract: rawContract } = useParams<{ contract: string }>();
  const collectionAddress = normalizeAddress("STARKNET", rawContract ?? "");

  const { isConnected, address: walletAddress } = useWallet();
  const { executeAuto } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();

  const [mintStep, setMintStep] = useState<MintStep>("idle");
  const [mintError, setMintError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [ownerCheck, setOwnerCheck] = useState<"loading" | "ok" | "denied">("loading");
  const [licensingOpen, setLicensingOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [ipTypeOpen, setIpTypeOpen] = useState(true);
  // Read only at submit time — keep in a ref so each keystroke in IPTypeFields
  // doesn't re-render this whole form (see /launchpad/single-editions flicker fix).
  const metadataFieldsRef = useRef<MetadataField[]>([]);
  const handleMetadataFields = useCallback((fields: MetadataField[]) => {
    metadataFieldsRef.current = fields;
  }, []);
  const [metadataResetKey, setMetadataResetKey] = useState(0);
  const [autoExternalUrl, setAutoExternalUrl] = useState("");
  // The on-chain-assigned edition id, read from the IPMinted event in the mint handler.
  const [mintedTokenId, setMintedTokenId] = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      value: "1",
      recipient: "",
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

  // Pre-fill recipient with connected wallet
  useEffect(() => {
    if (walletAddress && !form.getValues("recipient")) {
      form.setValue("recipient", walletAddress);
    }
  }, [walletAddress, form]);

  // Pre-fill external URL with the collection page (not the asset URL — the
  // token doesn't exist on-chain until mint completes, and indexers won't
  // resolve /asset/:contract/:tokenId until they pick up the Transfer event).
  // Pointing to the collection page gives collectors a working link the
  // moment the metadata JSON is written to IPFS. Creators can still override.
  useEffect(() => {
    if (!collectionAddress) return;
    const suggested = absoluteUrl(`/collections/${collectionAddress}`);
    const current = form.getValues("external_url");
    if (!current || current === autoExternalUrl) {
      form.setValue("external_url", suggested);
      setAutoExternalUrl(suggested);
    }
  }, [autoExternalUrl, collectionAddress, form]);

  // Verify the connected wallet is the collection owner before showing the form
  useEffect(() => {
    if (!walletAddress || !collectionAddress) return;
    starknetProvider.callContract({
      contractAddress: collectionAddress,
      entrypoint: "owner",
      calldata: [],
    }).then((result) => {
      const onChainOwner = normalizeAddress("STARKNET", result[0]);
      setOwnerCheck(onChainOwner === normalizeAddress("STARKNET", walletAddress) ? "ok" : "denied");
    }).catch(() => setOwnerCheck("ok"));
  }, [walletAddress, collectionAddress]);

  const handleLicenseChange = (value: string) => {
    form.setValue("licenseType", value);
    const def = LICENSE_TYPES.find((l) => l.value === value);
    if (def) {
      form.setValue("commercialUse", def.commercialUse);
      form.setValue("derivatives", def.derivatives);
      form.setValue("attribution", def.attribution);
    }
  };

  const handleImageSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10 MB"); return; }
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setImagePreview(url);
    setImageUri(null);
    setImageUploading(true);
    try {
      const token = await getValidToken();
      const signedRes = await fetch("/api/pinata/signed-url", withSiwsAuth(token, { method: "POST" }));
      const { url: uploadUrl } = await signedRes.json();
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("network", "public");
      fd.append("name", file.name);
      const up = await fetch(uploadUrl, { method: "POST", body: fd });
      const { data } = await up.json();
      if (!data?.cid) throw new Error("No CID");
      setImageUri(`ipfs://${data.cid}`);
      toast.success("Image uploaded to IPFS");
    } catch (err) {
      // Clear the preview so the form doesn't pretend an image is attached
      if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; }
      setImagePreview(null);
      const t = uploadFailureToast(err);
      toast.error(t.title, { description: t.description });
    } finally {
      setImageUploading(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!imageUri) { toast.error("Upload an image first"); return; }

    setMintStep("uploading");
    setMintError(null);
    setTxStatus("idle");
    setTxHash(null);

    try {
      const token = await getValidToken();
      const metadataForm = new FormData();
      metadataForm.set("name", values.name);
      metadataForm.set("description", values.description ?? "");
      metadataForm.set("imageUri", imageUri);
      if (values.external_url) metadataForm.set("external_url", values.external_url);
      metadataForm.set("ipType", values.ipType);
      metadataForm.set("licenseType", values.licenseType);
      metadataForm.set("commercialUse", values.commercialUse);
      metadataForm.set("derivatives", values.derivatives);
      metadataForm.set("attribution", values.attribution);
      metadataForm.set("geographicScope", values.geographicScope);
      metadataForm.set("aiPolicy", values.aiPolicy);
      metadataForm.set("royalty", String(values.royalty));

      const seenTraits = new Set<string>();
      const appendTrait = (traitType: string, value: string) => {
        const cleanTrait = traitType.trim();
        const cleanValue = value.trim();
        const key = cleanTrait.toLowerCase();
        if (!cleanTrait || !cleanValue || seenTraits.has(key)) return;
        seenTraits.add(key);
        metadataForm.append(`tmpl_${cleanTrait}`, cleanValue);
      };

      metadataFieldsRef.current.forEach(({ traitType, value }) => appendTrait(traitType, value));
      appendTrait("Token Standard", "ERC-1155");
      appendTrait("Editions", values.value);
      appendTrait("Collection Contract", collectionAddress);

      const uploadRes = await fetch("/api/pinata", withSiwsAuth(token, { method: "POST", body: metadataForm }));
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.error || !uploadData.uri) {
        throw new Error(uploadData.error ?? "Metadata upload failed");
      }
      const tokenUri: string = uploadData.uri;

      setMintStep("processing");
      setTxStatus("submitting");

      const [valueLow, valueHigh] = encodeU256(BigInt(values.value));

      // The contract assigns the edition id on-chain (sequential from 1).
      const txHashResult = await executeAuto([{
        contractAddress: collectionAddress,
        entrypoint: "mint_edition",
        calldata: [
          values.recipient,
          valueLow, valueHigh,
          ...serializeByteArray(tokenUri),
        ],
      }]);
      if (!txHashResult) throw new Error("Mint transaction failed");

      // Read the assigned id from the IPMinted event for the success/asset link.
      setMintedTokenId(await readAssignedEditionId(txHashResult, collectionAddress));

      setTxHash(txHashResult);
      setTxStatus("confirmed");
      setMintStep("success");
      rewardToast("mint_asset");
      if (walletAddress) invalidatePortfolioCache(walletAddress);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Failed to mint token");
      setTxStatus("error");
      setMintStep("error");
    }
  };

  const handleMintAnother = () => {
    setMintStep("idle");
    setMintError(null);
    setTxStatus("idle");
    setTxHash(null);
    setImagePreview(null);
    setImageUri(null);
    metadataFieldsRef.current = [];
    setMetadataResetKey((key) => key + 1);
    setAutoExternalUrl("");
    setMintedTokenId(null);
    form.reset({
      value: "1",
      recipient: walletAddress ?? "",
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
  };

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        <Sparkles className="h-10 w-10 text-brand-purple mx-auto" />
        <h1 className="text-2xl font-bold">Connect wallet to mint</h1>
        <p className="text-muted-foreground">Connect your Starknet wallet to mint tokens into your ERC-1155 collection.</p>
        <ConnectWallet label="Connect wallet" />
      </div>
    );
  }

  // ── Ownership check ───────────────────────────────────────────────────────
  if (ownerCheck === "denied") {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        <Sparkles className="h-10 w-10 text-muted-foreground mx-auto" />
        <h1 className="text-2xl font-bold">Not the owner</h1>
        <p className="text-muted-foreground">
          Only the collection owner can mint tokens. Connect the wallet that deployed this collection.
        </p>
        <Button asChild variant="outline">
          <Link href="/launchpad">Back to Launchpad</Link>
        </Button>
      </div>
    );
  }

  // ── Mint form ──────────────────────────────────────────────────────────────
  return (
    <>
      <ClaimRouteShell
        gated={false}
        icon={<Sparkles className="h-4 w-4 text-white" />}
        title="Mint an Edition"
        subtitle="Add a new piece to your collection — its details and authorship are saved permanently. Free to mint, and it's yours."
        headerAccessory={
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 max-w-full">
            <span className="tabular-nums text-xs text-foreground/80 truncate">Collection: {collectionAddress}</span>
          </div>
        }
        aside={
          <>
            <MedialaneCollectionCard
              image={imagePreview}
              name={form.watch("name")}
              collection="Edition"
              serial={Number(form.watch("value")) > 1 ? `× ${form.watch("value")}` : undefined}
              creator={walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : undefined}
            />
            <MintEditionAside />
          </>
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ── Image ── */}
            <FadeIn delay={0.06}>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Asset image <span className="text-destructive">*</span>
                </p>
                <div className="flex items-center gap-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !imageUploading && fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
                    className="relative h-20 w-20 rounded-2xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-brand-purple/50 transition-colors"
                  >
                    {imagePreview
                      ? <Image src={imagePreview} alt="Token" fill className="object-cover" />
                      : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
                    {imageUploading && (
                      <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSelect(f); }} />
                    <Button type="button" variant="outline" size="sm" disabled={imageUploading}
                      onClick={() => fileInputRef.current?.click()}>
                      {imageUploading
                        ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                        : imagePreview ? "Change" : "Upload image"}
                    </Button>
                    {imagePreview && (
                      <button type="button" onClick={() => { setImagePreview(null); setImageUri(null); }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                        <X className="h-3 w-3" /> Remove
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {imageUri
                        ? <span className="text-brand-purple">✓ Uploaded to IPFS</span>
                        : "JPG, PNG, SVG or WebP · max 10 MB"}
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* ── Name ── */}
            <FadeIn delay={0.08}>
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Token name *</FormLabel>
                  <FormControl><Input placeholder="Genesis Track #1" {...field} /></FormControl>
                  <FormDescription>Shown to collectors for this edition.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </FadeIn>

            {/* ── Description ── */}
            <FadeIn delay={0.1}>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe this IP asset…" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FadeIn>

            {/* ── External URL ── */}
            <FadeIn delay={0.12}>
              <FormField control={form.control} name="external_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>External link <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="https://yourwebsite.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FadeIn>

            {/* ── Licensing Terms ── */}
            <FadeIn delay={0.13}>
              <Collapsible open={licensingOpen} onOpenChange={setLicensingOpen}>
                <div className="sm:overflow-hidden sm:rounded-xl sm:border sm:border-border">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-0 py-3 sm:px-5 sm:py-4 hover:bg-muted/30 transition-colors"
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
                    <div className="px-0 pb-4 sm:px-5 sm:pb-5 space-y-4 border-t border-border/60 pt-4">
                      <p className="text-xs text-muted-foreground">
                        Set how others can use your edition — saved permanently with it.
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
                                <FormLabel>Royalty % (0-50)</FormLabel>
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
            </FadeIn>

            {/* ── IP Type & metadata traits ── */}
            <FadeIn delay={0.135}>
              <Collapsible open={ipTypeOpen} onOpenChange={setIpTypeOpen}>
                <div className="sm:overflow-hidden sm:rounded-xl sm:border sm:border-border">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-0 py-3 sm:px-5 sm:py-4 hover:bg-muted/30 transition-colors"
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
                    <div className="px-0 pb-4 sm:px-5 sm:pb-5 space-y-4 border-t border-border/60 pt-4">
                      <p className="text-xs text-muted-foreground">
                        Choose a content type to unlock suggested metadata, then add custom traits for your edition.
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
                        key={metadataResetKey}
                        ipType={form.watch("ipType") as IPType}
                        onChange={handleMetadataFields}
                      uploadDocument={makeUploadDocument(getValidToken)}
                      />
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </FadeIn>

            {/* ── Quantity ── */}
            <FadeIn delay={0.14}>
              <FormField control={form.control} name="value" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity *</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} placeholder="1" className="max-w-[180px]" {...field} />
                  </FormControl>
                  <FormDescription>Number of copies to mint for this token ID.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </FadeIn>

            {/* ── Recipient ── */}
            <FadeIn delay={0.16}>
              <FormField control={form.control} name="recipient" render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipient *</FormLabel>
                  <FormControl>
                    <Input placeholder="0x…" {...field} />
                  </FormControl>
                  <FormDescription>Wallet that receives the minted tokens. Defaults to your wallet.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </FadeIn>

            {/* ── Submit ── */}
            <FadeIn delay={0.2}>
              <Button
                type="submit"
                size="lg"
                className="w-full rounded-xl mt-2"
                disabled={imageUploading || mintStep !== "idle"}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Mint Edition
              </Button>
            </FadeIn>

          </form>
        </Form>
      </ClaimRouteShell>

      <MintProgressDialog
        open={mintStep !== "idle"}
        mintStep={mintStep}
        txStatus={txStatus}
        assetName={form.getValues("name")}
        imagePreview={imagePreview}
        txHash={txHash}
        error={mintError}
        onMintAnother={handleMintAnother}
        mintedTokenId={mintedTokenId ?? ""}
        assetHref={`/asset/${collectionAddress}/${mintedTokenId ?? ""}`}
        explorerAssetHref={`${EXPLORER_URL}/nft/${collectionAddress}/${mintedTokenId ?? ""}`}
      />
    </>
  );
}
