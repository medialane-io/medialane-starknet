"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Contract, hash, type Abi } from "starknet";
import { normalizeAddress } from "@medialane/sdk";
import { starknetProvider } from "@/lib/starknet";
import { Package, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FadeIn } from "@/components/ui/motion-primitives";
import { toast } from "sonner";
import { getListableTokens } from "@medialane/sdk";
import { DropFactoryABI, DROP_FACTORY_CONTRACT } from "@/lib/launchpad-contracts";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { useLaunchpadImageUpload } from "@/hooks/use-launchpad-image-upload";
import { makeUploadDocument } from "@/lib/upload-document";
import { buildDropSet } from "@/lib/drop-build-set";
import { parseAddresses, batchAllowlistCalldata } from "../drop-allowlist";
import { DropCreateForm, type PaymentTokenOption } from "../drop-create-form";
import { dropCreateSchema, type DropCreateFormValues } from "../drop-create-schema";
import type { DraftItem } from "../drop-item-list";
import type { MetadataField } from "@/components/create/ip-type-fields";

const PAYMENT_TOKENS = getListableTokens().map((t) => ({ symbol: t.symbol, address: t.address }));

// Default mint window: opens today, closes in 7 days.
function defaultSchedule() {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const end = new Date(now.getTime() + 7 * 86400_000);
  return { startDate: fmt(now), startTime: "00:00", endDate: fmt(end), endTime: "23:59" };
}
function suggestSymbol(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
}

export default function CreateDropPage() {
  const { isConnected, address: walletAddress } = useUnifiedWallet();
  const { executeAuto, isLoading: isProcessing } = usePaymasterTransaction();
  const { getValidToken } = useSiwsToken();

  const [items, setItems] = useState<DraftItem[]>([]);
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([]);
  const [ipTypeOpen, setIpTypeOpen] = useState(false);
  const [priceFree, setPriceFree] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<PaymentTokenOption>(PAYMENT_TOKENS[0]);
  const [building, setBuilding] = useState(false);
  const [done, setDone] = useState(false);
  const [autoSymbol, setAutoSymbol] = useState("");

  const {
    imagePreview, imageUri, imageUploading, uploadError, uploadSuccess,
    fileInputRef, handleImageSelect, clearImage,
  } = useLaunchpadImageUpload({ successMessage: "Cover image uploaded", failureMessage: "Image upload failed" });

  const uploadDocument = useMemo(() => makeUploadDocument(getValidToken), [getValidToken]);

  const form = useForm<DropCreateFormValues>({
    resolver: zodResolver(dropCreateSchema),
    defaultValues: {
      name: "", symbol: "",
      ipType: "NFT", licenseType: "CC BY-SA",
      commercialUse: "Yes", derivatives: "Share-Alike", attribution: "Required",
      geographicScope: "Worldwide", aiPolicy: "Not Allowed", royalty: 0,
      descriptionTemplate: "",
      priceAmount: "", paymentToken: PAYMENT_TOKENS[0].address,
      startDate: "", startTime: "00:00", endDate: "", endTime: "23:59",
      maxPerWallet: "1",
      whitelistEnabled: false, allowlistAddresses: "",
    },
  });
  const collectionName = form.watch("name");

  useEffect(() => {
    const d = defaultSchedule();
    if (!form.getValues("startDate")) { form.setValue("startDate", d.startDate); form.setValue("startTime", d.startTime); }
    if (!form.getValues("endDate")) { form.setValue("endDate", d.endDate); form.setValue("endTime", d.endTime); }
  }, [form]);

  useEffect(() => {
    const s = suggestSymbol(collectionName);
    if (!s) return;
    const current = form.getValues("symbol");
    if (!current || current === autoSymbol) { form.setValue("symbol", s); setAutoSymbol(s); }
  }, [autoSymbol, collectionName, form]);

  useEffect(() => { if (priceFree) form.setValue("priceAmount", ""); }, [form, priceFree]);

  const addItemFiles = (files: File[]) => {
    setItems((prev) => [...prev, ...files.map((file) => ({
      id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), name: "", description: "",
    }))]);
  };
  const removeItem = (id: string) => setItems((prev) => {
    const t = prev.find((it) => it.id === id);
    if (t) URL.revokeObjectURL(t.previewUrl);
    return prev.filter((it) => it.id !== id);
  });
  const editItem = (id: string, patch: Partial<Pick<DraftItem, "name" | "description">>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const resetAll = () => {
    const d = defaultSchedule();
    setDone(false);
    setItems((prev) => { prev.forEach((it) => URL.revokeObjectURL(it.previewUrl)); return []; });
    form.reset({
      name: "", symbol: "", ipType: "NFT", licenseType: "CC BY-SA",
      commercialUse: "Yes", derivatives: "Share-Alike", attribution: "Required",
      geographicScope: "Worldwide", aiPolicy: "Not Allowed", royalty: 0, descriptionTemplate: "",
      priceAmount: "", paymentToken: PAYMENT_TOKENS[0].address,
      startDate: d.startDate, startTime: d.startTime, endDate: d.endDate, endTime: d.endTime,
      maxPerWallet: "1", whitelistEnabled: false, allowlistAddresses: "",
    });
    clearImage(); setMetadataFields([]); setIpTypeOpen(false);
    setPriceFree(true); setIsPublic(true); setSelectedToken(PAYMENT_TOKENS[0]); setTokenDropdownOpen(false); setAutoSymbol("");
  };

  // Parse the deployed collection address from the create_drop receipt's DropCreated event.
  const addressFromReceipt = async (txHash: string): Promise<string | null> => {
    try {
      const selector = hash.getSelectorFromName("DropCreated");
      let receipt: any = null;
      for (let attempt = 0; attempt < 4 && !receipt; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        try { receipt = await starknetProvider.getTransactionReceipt(txHash); } catch { /* retry */ }
      }
      const ev = (receipt?.events ?? []).find((e: any) => e.keys?.[0] && BigInt(e.keys[0]) === BigInt(selector));
      return ev?.data?.[0] ? normalizeAddress("STARKNET", ev.data[0]) : null;
    } catch { return null; }
  };

  const onSubmit = async (values: DropCreateFormValues) => {
    if (!isConnected || !walletAddress) { toast.error("Connect your wallet first"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }

    setBuilding(true);
    try {
      const token = await getValidToken();
      if (!token) { toast.error("Wallet signature required to upload"); setBuilding(false); return; }

      const { baseUri, count } = await buildDropSet(
        items.map((it, i) => ({
          imageFile: it.file,
          name: it.name || `${values.name} #${i + 1}`,
          description: it.description || values.descriptionTemplate || "",
        })),
        {
          ipType: values.ipType, licenseType: values.licenseType,
          commercialUse: values.commercialUse, derivatives: values.derivatives, attribution: values.attribution,
          geographicScope: values.geographicScope, aiPolicy: values.aiPolicy, royalty: values.royalty,
          templateTraits: metadataFields,
        },
        { name: values.name, description: values.descriptionTemplate, image: imageUri },
        token
      );
      const maxSupply = BigInt(count);

      const toTs = (d: string, t: string) => Math.floor(new Date(`${d}T${t}:00`).getTime() / 1000);
      const toWei = (a: string) => BigInt(Math.round(parseFloat(a || "0") * 1e18));
      const maxPerWallet = BigInt(parseInt(values.maxPerWallet ?? "1", 10));
      const conditions = {
        start_time: toTs(values.startDate, values.startTime),
        end_time: toTs(values.endDate, values.endTime),
        price: priceFree ? 0n : toWei(values.priceAmount ?? "0"),
        payment_token: priceFree ? "0x0" : selectedToken.address,
        max_quantity_per_wallet: maxPerWallet,
      };

      const factory = new Contract({ abi: DropFactoryABI as unknown as Abi, address: DROP_FACTORY_CONTRACT, providerOrAccount: starknetProvider });
      const call = factory.populate("create_drop", [values.name, values.symbol, baseUri, maxSupply, conditions]);

      const txHash = await executeAuto([{ contractAddress: DROP_FACTORY_CONTRACT, entrypoint: "create_drop", calldata: call.calldata as string[] }]);
      if (!txHash) throw new Error("Transaction failed — no hash returned");

      // Optional whitelist: set on the new drop address (from the receipt), same wallet session.
      const whitelist = values.whitelistEnabled ? parseAddresses(values.allowlistAddresses) : [];
      if (whitelist.length > 0) {
        const dropAddress = await addressFromReceipt(txHash);
        if (dropAddress) {
          try {
            await executeAuto([
              { contractAddress: dropAddress, entrypoint: "set_allowlist_enabled", calldata: ["1"] },
              { contractAddress: dropAddress, entrypoint: "batch_add_to_allowlist", calldata: batchAllowlistCalldata(whitelist) },
            ]);
          } catch { /* creator can finish whitelist setup in Manage */ }
        }
      }
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create drop");
    } finally {
      setBuilding(false);
    }
  };

  const isSubmitting = building || isProcessing;

  // ── Success ───────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="container max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-orange-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-orange-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Drop launched</h1>
          <p className="text-muted-foreground">
            Your Collection Drop is live on Starknet. Each item is a unique, licensed asset. It will appear in the launchpad within a minute once indexed.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline"><Link href="/launchpad/drop">Back to Drops</Link></Button>
          <Button onClick={resetAll} className="bg-orange-600 hover:bg-orange-700 text-white">Launch another</Button>
        </div>
      </div>
    );
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="container max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        <Package className="h-10 w-10 text-orange-500 mx-auto" />
        <h1 className="text-2xl font-bold">Connect wallet to launch a drop</h1>
        <p className="text-muted-foreground">Connect your Starknet wallet to deploy a limited set of unique, licensed assets.</p>
        <ConnectWallet label="Connect wallet" />
      </div>
    );
  }

  // ── Launch form ─────────────────────────────────────────────────────────────
  return (
    <div className="container max-w-xl mx-auto px-4 pt-10 pb-16 space-y-8">
      <FadeIn>
        <div className="space-y-1">
          <span className="pill-badge inline-flex gap-1.5"><Package className="h-3 w-3" />Collection Drop</span>
          <h1 className="text-3xl font-bold mt-3">Launch Drop</h1>
          <p className="text-muted-foreground text-sm">
            Deploy a limited set of unique, individually-licensed ERC-721 assets with a timed mint window.
          </p>
        </div>
      </FadeIn>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <DropCreateForm
            form={form}
            imagePreview={imagePreview}
            imageUri={imageUri}
            imageUploading={imageUploading}
            isSubmitting={isSubmitting}
            priceFree={priceFree}
            isPublic={isPublic}
            paymentTokens={PAYMENT_TOKENS}
            selectedToken={selectedToken}
            tokenDropdownOpen={tokenDropdownOpen}
            fileInputRef={fileInputRef}
            items={items}
            ipTypeOpen={ipTypeOpen}
            onImageSelect={handleImageSelect}
            onClearImage={clearImage}
            onSetPriceFree={setPriceFree}
            onSetTokenDropdownOpen={setTokenDropdownOpen}
            onSelectToken={(token) => { setSelectedToken(token); form.setValue("paymentToken", token.address); setTokenDropdownOpen(false); }}
            onSetPublic={setIsPublic}
            onAddItemFiles={addItemFiles}
            onRemoveItem={removeItem}
            onEditItem={editItem}
            onMetadataFieldsChange={setMetadataFields}
            onSetIpTypeOpen={setIpTypeOpen}
            uploadDocument={uploadDocument}
          />
          {uploadError && <p className="text-xs text-destructive mt-1">{uploadError}</p>}
          {uploadSuccess && <p className="text-xs text-emerald-500 mt-1">✓ {uploadSuccess}</p>}
        </form>
      </Form>
    </div>
  );
}
