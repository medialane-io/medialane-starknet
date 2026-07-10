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
import { useRouter } from "next/navigation";
import { Ticket, Loader2, ChevronRight, ImagePlus } from "lucide-react";
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
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { ClaimRail } from "@medialane/ui";
import { toast } from "sonner";
import { Contract, hash } from "starknet";
import { normalizeAddress, IPTicketCollectionFactoryABI, STARKNET_IP_TICKETS_FACTORY_CONTRACT } from "@medialane/sdk";
import { starknetProvider } from "@/lib/starknet";
import { EXPLORER_URL } from "@/lib/constants";
import { useMyTicketCollections } from "@/hooks/use-tickets";

const COLLECTION_DEPLOYED_SELECTOR = hash.getSelectorFromName("CollectionDeployed");
const FACTORY = STARKNET_IP_TICKETS_FACTORY_CONTRACT as string;

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
      if (ev.keys?.[0] === COLLECTION_DEPLOYED_SELECTOR) {
        return ev.keys?.[1] ? normalizeAddress("STARKNET", ev.keys[1]) : null;
      }
    }
  } catch {}
  return null;
}

export default function CreateTicketCollectionPage() {
  const { address, isConnected } = useWallet();
  const { executeAuto } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();
  const { mutate } = useMyTicketCollections(address ?? null);
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "deploying" | "done">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

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
    if (!FACTORY) { toast.error("IP Tickets not yet available on this chain"); return; }
    if (imagePreview && !imageUri && !imageUploading) {
      toast.error("Image upload failed", { description: "Please re-upload your collection image." });
      return;
    }
    setStatus("deploying");
    try {
      // Pin collection metadata if image was provided
      let baseUri = "";
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
            }),
          }));
          const d = await r.json();
          if (d.uri) baseUri = d.uri;
        } catch { /* non-fatal */ }
      }

      const factory = new Contract({ abi: IPTicketCollectionFactoryABI as any, address: FACTORY, providerOrAccount: starknetProvider });
      const call = factory.populate("deploy_collection", [values.name, values.symbol, baseUri]);

      const txH = await executeAuto([call]);
      if (!txH) throw new Error("Transaction failed");
      setTxHash(txH);
      rewardToast("launch_launchpad");

      const deployedAddress = await readDeployedAddress(txH);
      void mutate();
      setStatus("done");

      if (deployedAddress) {
        setTimeout(() => router.push(`/launchpad/tickets/${deployedAddress}`), 1500);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Failed to create collection");
      setStatus("idle");
    }
  }

  if (!isConnected) {
    return <ConnectGate><div /></ConnectGate>;
  }

  return (
    <ClaimRouteShell
      icon={<Ticket className="h-4 w-4 text-white" />}
      title="Create Ticket Collection"
      subtitle="One collection, as many events as you need."
      gated={false}
      aside={
        <ClaimRail
          included={[
            { icon: Ticket, title: "One collection per creator", desc: "Add as many events as you need without creating a new collection." },
            { icon: ChevronRight, title: "You keep full control", desc: "Only you can create events and mint tickets." },
          ]}
          steps={[
            "Create your ticket collection — set name, symbol, and cover image",
            "Add events — each gets its own supply and optional time window",
            "Mint tickets to attendees directly from your collection page",
          ]}
          trustIcon={Ticket}
          trustLead="Your tickets, your rules."
          trust="Only you can create events and mint. Holders keep their tickets forever."
        />
      }
    >
      {status === "done" ? (
        <div className="p-8 text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-teal-500/10 flex items-center justify-center mx-auto">
            <Ticket className="h-7 w-7 text-teal-500" />
          </div>
          <p className="font-semibold">Collection created!</p>
          {txHash && (
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:underline"
            >
              View transaction
            </a>
          )}
          <p className="text-xs text-muted-foreground">Redirecting to your collection…</p>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

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
                    {imageUploading ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</> : "Upload image"}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG, GIF, SVG or WebP · max 10 MB</p>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="My Events" {...field} />
                  </FormControl>
                  <FormDescription>Your brand name — shown in wallets and explorers.</FormDescription>
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
                      placeholder="EVNT"
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
                      placeholder="Describe your events and what kind of tickets you sell…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={status === "deploying" || imageUploading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              {status === "deploying" ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
              ) : (
                <><Ticket className="h-4 w-4 mr-2" />Create Ticket Collection</>
              )}
            </Button>
          </form>
        </Form>
      )}
    </ClaimRouteShell>
  );
}
