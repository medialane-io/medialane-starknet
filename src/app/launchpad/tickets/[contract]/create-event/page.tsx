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
import { useParams, useRouter } from "next/navigation";
import { Calendar, Loader2, ImagePlus, X, ShieldCheck, ChevronDown } from "lucide-react";
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
import type { TxStatus } from "@/hooks/use-tx";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { ClaimRail } from "@medialane/ui";
import { toast } from "sonner";
import { FadeIn } from "@/components/ui/motion-primitives";
import { Contract, CairoOption, CairoOptionVariant, cairo } from "starknet";
import { normalizeAddress, IPTicketCollectionABI } from "@medialane/sdk";
import { starknetProvider } from "@/lib/starknet";
import { absoluteUrl } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { useTicketEvents } from "@/hooks/use-tickets";
import {
  LICENSE_TYPES,
  GEOGRAPHIC_SCOPES,
  AI_POLICIES,
  DERIVATIVES_OPTIONS,
} from "@/types/ip";

const schema = z.object({
  name: z.string().min(1, "Event name required").max(100),
  description: z.string().max(1000).optional(),
  external_url: z
    .string()
    .max(500)
    .refine((v) => !v || v.startsWith("http://") || v.startsWith("https://"), {
      message: "Must start with http:// or https://",
    })
    .optional(),
  maxSupply: z
    .string()
    .min(1, "Supply required")
    .regex(/^\d+$/, "Must be a positive integer")
    .refine((v) => parseInt(v, 10) >= 1, "Minimum supply is 1"),
  royalty: z.coerce.number().min(0).max(50).default(2.5),
  licenseType: z.string().min(1),
  commercialUse: z.enum(["Yes", "No"]),
  derivatives: z.enum(["Allowed", "Not Allowed", "Share-Alike"]),
  attribution: z.enum(["Required", "Not Required"]),
  geographicScope: z.string(),
  aiPolicy: z.enum(["Allowed", "Not Allowed", "Training Only"]),
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

export default function CreateEventPage() {
  const params = useParams<{ contract: string }>();
  const contract = normalizeAddress("STARKNET", params.contract);
  const { isConnected } = useWallet();
  const { executeAuto } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();
  const { mutate } = useTicketEvents(contract);
  const router = useRouter();

  const [mintStep, setMintStep] = useState<MintStep>("idle");
  const [dialogTxStatus, setDialogTxStatus] = useState<TxStatus>("idle");
  const [mintError, setMintError] = useState<string | null>(null);
  const [licensingOpen, setLicensingOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      external_url: "",
      maxSupply: "100",
      royalty: 2.5,
      licenseType: "CC BY-SA",
      commercialUse: "Yes",
      derivatives: "Share-Alike",
      attribution: "Required",
      geographicScope: "Worldwide",
      aiPolicy: "Not Allowed",
    },
  });

  useEffect(() => {
    if (!contract) return;
    const suggested = absoluteUrl(`/collections/${contract}`);
    if (!form.getValues("external_url")) {
      form.setValue("external_url", suggested);
    }
  }, [contract, form]);

  const handleReset = () => {
    setMintStep("idle");
    setDialogTxStatus("idle");
    setMintError(null);
  };

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
      const signedData = await signedRes.json();
      if (!signedRes.ok || !signedData.url) throw new Error("Failed to get upload URL");
      const fd = new FormData();
      fd.append("file", file, file.name);
      fd.append("network", "public");
      fd.append("name", file.name);
      const up = await fetch(signedData.url, { method: "POST", body: fd });
      const { data } = await up.json();
      if (!data?.cid) throw new Error("No CID");
      setImageUri(`ipfs://${data.cid}`);
      toast.success("Image uploaded");
    } catch (err) {
      if (previewRef.current) { URL.revokeObjectURL(previewRef.current); previewRef.current = null; }
      setImagePreview(null);
      const t = uploadFailureToast(err);
      toast.error(t.title, { description: t.description });
    } finally {
      setImageUploading(false);
    }
  };

  async function onSubmit(values: FormValues) {
    if (!isConnected) { toast.error("Connect your wallet first"); return; }
    if (!imageUri) { toast.error("Upload an event image first"); return; }

    setMintError(null);
    setDialogTxStatus("idle");
    setMintStep("uploading");

    try {
      const siwsToken = await getValidToken();
      if (!siwsToken) throw new Error("Authentication required — please sign in");

      const metadataForm = new FormData();
      metadataForm.set("name", values.name);
      metadataForm.set("description", values.description ?? "");
      metadataForm.set("imageUri", imageUri);
      if (values.external_url) metadataForm.set("external_url", values.external_url);
      metadataForm.set("ipType", "NFT");
      metadataForm.set("licenseType", values.licenseType);
      metadataForm.set("commercialUse", values.commercialUse);
      metadataForm.set("derivatives", values.derivatives);
      metadataForm.set("attribution", values.attribution);
      metadataForm.set("geographicScope", values.geographicScope);
      metadataForm.set("aiPolicy", values.aiPolicy);
      metadataForm.set("royalty", String(values.royalty));
      metadataForm.append("tmpl_Type", "IP Ticket");
      metadataForm.append("tmpl_Token Standard", "ERC-1155");
      metadataForm.append("tmpl_Max Supply", values.maxSupply);
      metadataForm.append("tmpl_Collection Contract", contract);

      const uploadRes = await fetch("/api/pinata", withSiwsAuth(siwsToken, { method: "POST", body: metadataForm }));
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || uploadData.error || !uploadData.uri) {
        throw new Error(uploadData.error ?? "Metadata upload failed");
      }
      const metadataUri: string = uploadData.uri;

      setMintStep("processing");
      setDialogTxStatus("submitting");

      const startTime = dateToUnixTimestamp(values.startDate);
      const endTime = dateToUnixTimestamp(values.endDate);
      const royaltyBps = Math.round(values.royalty * 100);

      const col = new Contract({ abi: IPTicketCollectionABI as any, address: contract, providerOrAccount: starknetProvider });
      const call = col.populate("create_event", [
        cairo.uint256(values.maxSupply),
        startTime != null
          ? new CairoOption(CairoOptionVariant.Some, startTime)
          : new CairoOption(CairoOptionVariant.None),
        endTime != null
          ? new CairoOption(CairoOptionVariant.Some, endTime)
          : new CairoOption(CairoOptionVariant.None),
        royaltyBps,
        metadataUri,
      ]);

      const txH = await executeAuto([call]);
      if (!txH) throw new Error("Transaction failed");
      setDialogTxStatus("confirming");
      setDialogTxStatus("confirmed");
      rewardToast("launch_launchpad");
      void mutate();
      setMintStep("success");
    } catch (err: any) {
      setMintError(err?.message ?? "Failed to create event");
      setDialogTxStatus("idle");
      setMintStep("error");
    }
  }

  if (!isConnected) {
    return <ConnectGate><div /></ConnectGate>;
  }

  const busy = mintStep === "uploading" || mintStep === "processing";

  return (
    <>
      <MintProgressDialog
        open={mintStep !== "idle"}
        mintStep={mintStep}
        txStatus={dialogTxStatus}
        assetName={form.getValues("name")}
        imagePreview={imagePreview}
        txHash={null}
        error={mintError}
        onMintAnother={handleReset}
        uploadStepLabel="Upload event metadata"
        processingTitle="Creating event on Starknet…"
        successTitle="Event created!"
        successSubtitle={`"${form.getValues("name")}" is now live — you can start minting tickets.`}
        mintAnotherLabel="Add another event"
        primaryActionLabel="Back to collection"
        primaryActionHref={`/launchpad/tickets/${contract}`}
      />

      <ClaimRouteShell
        icon={<Calendar className="h-4 w-4 text-white" />}
        title="Create event"
        subtitle="Add a new event to your ticket collection."
        gated={false}
        aside={
          <ClaimRail
            steps={[
              "Upload an event image and fill in the details",
              "Set licensing terms — saved permanently with the event",
              "Set ticket supply and optional time window",
              "Metadata is pinned to IPFS and the event is registered on-chain",
            ]}
            trustIcon={Calendar}
            trustLead="Immutable on-chain."
            trust="Once created, the event record is permanent. The metadata and licensing terms are locked to this event forever."
          />
        }
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* ── Image ── */}
            <FadeIn delay={0.04}>
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Event image <span className="text-destructive">*</span>
                </p>
                <div className="flex items-center gap-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !imageUploading && fileInputRef.current?.click()}
                    onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
                    className="relative h-20 w-20 rounded-2xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-teal-500/50 transition-colors"
                  >
                    {imagePreview
                      ? <Image src={imagePreview} alt="Event" fill className="object-cover" />
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
                        ? <span className="text-teal-500">✓ Uploaded to IPFS</span>
                        : "JPG, PNG, SVG or WebP · max 10 MB"}
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* ── Name ── */}
            <FadeIn delay={0.06}>
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Event name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Summer Concert 2026" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FadeIn>

            {/* ── Description ── */}
            <FadeIn delay={0.08}>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="What is this event about?" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FadeIn>

            {/* ── External URL ── */}
            <FadeIn delay={0.1}>
              <FormField control={form.control} name="external_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>External link <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="https://yourwebsite.com/event" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </FadeIn>

            {/* ── Licensing Terms ── */}
            <FadeIn delay={0.12}>
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
                        Set how others can use this IP — saved permanently with it.
                      </p>
                      <FormField control={form.control} name="licenseType" render={({ field }) => (
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
                            return def ? <p className="text-xs text-muted-foreground mt-1">{def.description}</p> : null;
                          })()}
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="commercialUse" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Commercial Use</FormLabel>
                          <ToggleGroup value={field.value} options={["Yes", "No"]} onChange={field.onChange} />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="derivatives" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Derivatives</FormLabel>
                          <ToggleGroup value={field.value} options={DERIVATIVES_OPTIONS} onChange={field.onChange} />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="attribution" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Attribution</FormLabel>
                          <ToggleGroup value={field.value} options={["Required", "Not Required"]} onChange={field.onChange} />
                        </FormItem>
                      )} />
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
                          <FormField control={form.control} name="geographicScope" render={({ field }) => (
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
                          )} />
                          <FormField control={form.control} name="aiPolicy" render={({ field }) => (
                            <FormItem>
                              <FormLabel>AI &amp; Data Mining</FormLabel>
                              <ToggleGroup value={field.value} options={AI_POLICIES} onChange={field.onChange} />
                            </FormItem>
                          )} />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </FadeIn>

            {/* ── Supply + Royalty ── */}
            <FadeIn delay={0.14}>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="maxSupply" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max supply <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="100" {...field} />
                    </FormControl>
                    <FormDescription>Total tickets available.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="royalty" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Royalty % (0–50)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        step={0.5}
                        placeholder="2.5"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>On secondary sales.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </FadeIn>

            {/* ── Date window ── */}
            <FadeIn delay={0.16}>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormDescription>Tickets valid from.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormDescription>Tickets expire after.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </FadeIn>

            {/* ── Submit ── */}
            <FadeIn delay={0.2}>
              <Button
                type="submit"
                disabled={busy || imageUploading}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                {mintStep === "uploading" ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading metadata…</>
                ) : mintStep === "processing" ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating event…</>
                ) : (
                  <><Calendar className="h-4 w-4 mr-2" />Create event</>
                )}
              </Button>
            </FadeIn>

          </form>
        </Form>
      </ClaimRouteShell>
    </>
  );
}
