"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { hash, type Call } from "starknet";
import { normalizeAddress, getListableTokens } from "@medialane/sdk";
import { starknetProvider } from "@/lib/starknet";
import { Package, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { toast } from "sonner";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { DropCreateForm, DropPreviewCard, dropCreateSchema, type PaymentTokenOption, type DropCreateFormValues, type DraftItem } from "@medialane/ui";
import { CreateDropAside } from "@/components/claim/create-drop-aside";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { useMedialaneClient } from "@/hooks/use-medialane-client";
import { useLaunchpadImageUpload } from "@/hooks/use-launchpad-image-upload";
import { getDefaultDropSchedule, suggestLaunchpadSymbol } from "@/lib/launchpad-defaults";
import { makeUploadDocument } from "@/lib/upload-document";
import { buildDropSet } from "@/lib/drop-build-set";
import { parseAddresses, batchAllowlistCalldata } from "../drop-allowlist";
import type { MetadataField } from "@/components/create/ip-type-fields";

const PAYMENT_TOKENS = getListableTokens().map((t) => ({ symbol: t.symbol, address: t.address }));

export default function CreateDropPage() {
  const { isConnected, address: walletAddress, execute } = useWallet();
  const { getValidToken } = useSiwsToken();
  const client = useMedialaneClient();

  const [items, setItems] = useState<DraftItem[]>([]);

  const metadataFieldsRef = useRef<MetadataField[]>([]);
  const handleMetadataFields = useCallback((fields: MetadataField[]) => {
    metadataFieldsRef.current = fields;
  }, []);
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
      gatedEnabled: false, gatedContentTitle: "", gatedContentUrl: "", gatedContentType: "",
    },
  });
  const collectionName = form.watch("name");

  useEffect(() => {
    const d = getDefaultDropSchedule();
    if (!form.getValues("startDate")) { form.setValue("startDate", d.startDate); form.setValue("startTime", d.startTime); }
    if (!form.getValues("endDate")) { form.setValue("endDate", d.endDate); form.setValue("endTime", d.endTime); }
  }, [form]);

  useEffect(() => {
    const s = suggestLaunchpadSymbol(collectionName);
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
    const d = getDefaultDropSchedule();
    setDone(false);
    setItems((prev) => { prev.forEach((it) => URL.revokeObjectURL(it.previewUrl)); return []; });
    form.reset({
      name: "", symbol: "", ipType: "NFT", licenseType: "CC BY-SA",
      commercialUse: "Yes", derivatives: "Share-Alike", attribution: "Required",
      geographicScope: "Worldwide", aiPolicy: "Not Allowed", royalty: 0, descriptionTemplate: "",
      priceAmount: "", paymentToken: PAYMENT_TOKENS[0].address,
      startDate: d.startDate, startTime: d.startTime, endDate: d.endDate, endTime: d.endTime,
      maxPerWallet: "1", whitelistEnabled: false, allowlistAddresses: "",
      gatedEnabled: false, gatedContentTitle: "", gatedContentUrl: "", gatedContentType: "",
    });
    clearImage(); metadataFieldsRef.current = [];
    setPriceFree(true); setIsPublic(true); setSelectedToken(PAYMENT_TOKENS[0]); setTokenDropdownOpen(false); setAutoSymbol("");
  };

  const addressFromReceipt = async (txHash: string): Promise<string | null> => {
    try {
      const selector = hash.getSelectorFromName("DropCreated");
      let receipt: any = null;
      for (let attempt = 0; attempt < 4 && !receipt; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        try { receipt = await starknetProvider.getTransactionReceipt(txHash); } catch {  }
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
          templateTraits: metadataFieldsRef.current,
        },
        { name: values.name, description: values.descriptionTemplate, image: imageUri },
        token
      );
      const maxSupply = BigInt(count);

      const toTs = (d: string, t: string) => Math.floor(new Date(`${d}T${t}:00`).getTime() / 1000);
      const toWei = (a: string) => BigInt(Math.round(parseFloat(a || "0") * 1e18));
      const maxPerWallet = BigInt(parseInt(values.maxPerWallet ?? "1", 10));
      const conditions = {
        startTime: toTs(values.startDate, values.startTime),
        endTime: toTs(values.endDate, values.endTime),
        price: (priceFree ? 0n : toWei(values.priceAmount ?? "0")).toString(),
        paymentToken: priceFree ? "0x0" : selectedToken.address,
        maxQuantityPerWallet: maxPerWallet.toString(),
      };

      if (!walletAddress) throw new Error("Wallet not ready. Please reconnect and try again.");

      const intentRes = await client.api.createCollectionIntent({
        owner: walletAddress,
        name: values.name,
        symbol: values.symbol,
        baseUri,
        service: "drop-collection",
        maxSupply: maxSupply.toString(),
        conditions,
      });
      if (intentRes.data.requiresSignature) throw new Error("Expected a prebuilt create-collection intent");
      const txHash = await execute(intentRes.data.calls as Call[]);

      const whitelist = values.whitelistEnabled ? parseAddresses(values.allowlistAddresses) : [];
      if (whitelist.length > 0) {
        const dropAddress = await addressFromReceipt(txHash);
        if (dropAddress) {
          try {
            await execute([
              { contractAddress: dropAddress, entrypoint: "set_allowlist_enabled", calldata: ["1"] },
              { contractAddress: dropAddress, entrypoint: "batch_add_to_allowlist", calldata: batchAllowlistCalldata(whitelist) },
            ]);
          } catch {  }
        }
      }

      if (values.gatedEnabled) {
        const dropAddress = await addressFromReceipt(txHash);
        if (dropAddress) {
          try {
            await client.api.updateCollectionProfile(dropAddress, {
              gatedContentTitle: values.gatedContentTitle || null,
              gatedContentUrl: values.gatedContentUrl || null,
              gatedContentType: (values.gatedContentType || null) as "VIDEO" | "STREAM" | "AUDIO" | "DOCUMENT" | "LINK" | null,
            }, token);
          } catch {
            toast.error("Drop launched, but exclusive content couldn't be saved — set it up from Manage.");
          }
        }
      }
      setDone(true);
      rewardToast("launch_launchpad");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create drop");
    } finally {
      setBuilding(false);
    }
  };

  const isSubmitting = building;

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-brand-orange/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-brand-orange" />
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
          <Button onClick={resetAll} className="bg-brand-orange hover:brightness-110 text-white">Launch another</Button>
        </div>
      </div>
    );
  }

  return (
    <ConnectGate
      title="Connect wallet to launch a drop"
      subtitle="Connect your Starknet wallet to create and manage a collection drop."
    >
    <ClaimRouteShell
      gated={false}
      icon={<Package className="h-4 w-4 text-white" />}
      title="Launch a Drop"
      subtitle="Release a limited set of unique pieces with a timed mint window — free to launch, and it's yours."
      aside={
        <>
          <DropPreviewCard
            coverImage={imagePreview}
            name={form.watch("name")}
            symbol={form.watch("symbol")}
            creatorAddress={walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : undefined}
            creatorHref={walletAddress ? `/account/${walletAddress}` : undefined}
            itemCount={items.length}
            conditions={{
              maxSupply: String(items.length),
              price: priceFree ? "0" : String(Math.round(parseFloat(form.watch("priceAmount") || "0") * 1e18)),
              paymentToken: priceFree ? "0x0" : selectedToken.address,
              startTime: form.watch("startDate") && form.watch("startTime")
                ? Math.floor(new Date(`${form.watch("startDate")}T${form.watch("startTime")}:00`).getTime() / 1000)
                : 0,
              endTime: form.watch("endDate") && form.watch("endTime")
                ? Math.floor(new Date(`${form.watch("endDate")}T${form.watch("endTime")}:00`).getTime() / 1000)
                : 0,
              maxPerWallet: form.watch("maxPerWallet") || "1",
            }}
            whitelistEnabled={form.watch("whitelistEnabled")}
            gatedContentEnabled={form.watch("gatedEnabled")}
          />
          <CreateDropAside />
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <DropCreateForm
            form={form}
            imagePreview={imagePreview}
            imageUploading={imageUploading}
            isSubmitting={isSubmitting}
            priceFree={priceFree}
            isPublic={isPublic}
            paymentTokens={PAYMENT_TOKENS}
            selectedToken={selectedToken}
            tokenDropdownOpen={tokenDropdownOpen}
            fileInputRef={fileInputRef}
            items={items}
            onImageSelect={handleImageSelect}
            onSetPriceFree={setPriceFree}
            onSetTokenDropdownOpen={setTokenDropdownOpen}
            onSelectToken={(token) => { setSelectedToken(token); form.setValue("paymentToken", token.address); setTokenDropdownOpen(false); }}
            onSetPublic={setIsPublic}
            onAddItemFiles={addItemFiles}
            onRemoveItem={removeItem}
            onEditItem={editItem}
            onMetadataFieldsChange={handleMetadataFields}
            uploadDocument={uploadDocument}
          />
          {uploadError && <p className="text-xs text-destructive mt-1">{uploadError}</p>}
          {uploadSuccess && <p className="text-xs text-emerald-500 mt-1">✓ {uploadSuccess}</p>}
        </form>
      </Form>
    </ClaimRouteShell>
    </ConnectGate>
  );
}
