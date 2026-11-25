"use client";

import { InlineNote } from "@/components/shared/inline-note";
import { use } from "react";
import { normalizeAddress } from "@medialane/sdk";
import { ImageUploadField, SectionHeading, useImageUpload } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useDraft } from "@/hooks/use-draft";
import { useSave } from "@/hooks/use-save";
import { useCoin, updateCoinProfile } from "@/hooks/use-coins";
import { Button } from "@medialane/ui/button";
import { Label } from "@medialane/ui/label";
import { Textarea } from "@medialane/ui/textarea";
import { resolveImage } from "@/lib/utils";

interface Props { params: Promise<{ contract: string }> }

export default function CoinSettingsPage({ params }: Props) {
  const { contract } = use(params);
  const { address: walletAddress } = useWallet();
  const { coin, isLoading, mutate } = useCoin(contract);

  const { saving, message: saveMessage, save } = useSave();
  const { draft: { image, description }, edit } = useDraft<{ image: string | null; description: string }>({
    image: coin?.image ?? null,
    description: coin?.description ?? "",
  });
  const upload = useImageUpload({ onChange: (uri) => edit({ image: uri }) });

  const isCreator =
    walletAddress && coin?.creator &&
    normalizeAddress("STARKNET", walletAddress) === normalizeAddress("STARKNET", coin.creator);

  if (!isLoading && coin && !isCreator) {
    return (
      <div className="py-8">
        <p className="text-muted-foreground">You don&apos;t have permission to edit this coin.</p>
      </div>
    );
  }

  async function handleSave() {
    if (!upload.confirm()) return;
    await save("Coin profile updated.", async () => {
      await updateCoinProfile(contract, { image, description: description || null });
      await mutate();
    });
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <SectionHeading
        title="Coin Settings"
        subtitle={`Update your coin's logo and description. ${coin?.symbol ? `(${coin.symbol})` : ""}`}
      />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Logo</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Shown on the coin page and in discovery.</p>
        </div>
        <div className="border-t border-border pt-4">
          <ImageUploadField upload={upload} ariaLabel="Logo" alt="coin logo" currentImage={resolveImage(image)} round />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Description</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Tell people about your coin.</p>
        </div>
        <div className="border-t border-border pt-4 space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={4} maxLength={500} value={description}
            onChange={(e) => edit({ description: e.target.value })} placeholder="What is this coin about?" />
        </div>
      </div>

      <InlineNote message={saveMessage} />
      <Button onClick={handleSave} disabled={saving || upload.uploading || isLoading}>
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}
