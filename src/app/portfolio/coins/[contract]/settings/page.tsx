"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useWallet } from "@/hooks/use-wallet";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { useCoin, updateCoinProfile } from "@/hooks/use-coins";
import { uploadFileToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ipfsToHttp } from "@/lib/utils";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props { params: Promise<{ contract: string }> }

export default function CoinSettingsPage({ params }: Props) {
  const { contract } = use(params);
  const { address: walletAddress } = useWallet();
  const { getValidToken } = useSiwsToken();
  const { coin, isLoading, mutate } = useCoin(contract);

  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (coin) {
      setImage(coin.image ?? null);
      setDescription(coin.description ?? "");
    }
  }, [coin]);

  const isCreator =
    walletAddress && coin?.creator &&
    walletAddress.toLowerCase() === coin.creator.toLowerCase();

  if (!isLoading && coin && !isCreator) {
    return (
      <div className="py-8">
        <p className="text-muted-foreground">You don&apos;t have permission to edit this coin.</p>
      </div>
    );
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error("Wallet sign-in required");
      const { uri } = await uploadFileToIpfs(file, token, "image");
      setImage(uri);
    } catch (err) {
      const t = uploadFailureToast(err);
      toast.error(t.title, { description: t.description });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const token = await getValidToken();
      if (!token) throw new Error("Wallet sign-in required");
      await updateCoinProfile(contract, { image, description: description || null }, token);
      await mutate();
      toast.success("Coin profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = image ? ipfsToHttp(image) : null;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Coin Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update your coin&apos;s logo and description. {coin?.symbol ? `(${coin.symbol})` : ""}
        </p>
      </div>

      {/* Media */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Logo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Shown on the coin page and in discovery.</p>
        </div>
        <div className="border-t border-border pt-4 flex items-center gap-4">
          {previewUrl ? (
            <Image src={previewUrl} alt="coin logo" width={64} height={64} unoptimized
              className="h-16 w-16 rounded-full object-cover border border-border/60" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center">
              <span className="text-xl font-bold text-white">{(coin?.symbol ?? "?").slice(0, 2).toUpperCase()}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? "Uploading…" : "Upload image"}
            </Button>
            {image && (
              <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setImage(null)}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Description</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Tell people about your coin.</p>
        </div>
        <div className="border-t border-border pt-4 space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={4} maxLength={500} value={description}
            onChange={(e) => setDescription(e.target.value)} placeholder="What is this coin about?" />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || uploading || isLoading}>
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}
