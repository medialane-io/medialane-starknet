"use client";

import { CollectionSlugClaimSection } from "@/components/portfolio/collection-slug-claim";
import { InlineNote } from "@/components/shared/inline-note";
import { useDraft } from "@/hooks/use-draft";
import { useSave } from "@/hooks/use-save";
import { use } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useCollection, useCollectionProfile } from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";
import { Button } from "@medialane/ui/button";
import { Input } from "@medialane/ui/input";
import { Label } from "@medialane/ui/label";
import { Textarea } from "@medialane/ui/textarea";
import { Switch } from "@medialane/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@medialane/ui/select";
import { Lock, Gem, Video, Music, Radio, FileText, Link2 } from "lucide-react";
import { isCollectionOwner } from "@/lib/utils";

const CONTENT_TYPES = [
  { value: "VIDEO",    label: "Video",       icon: Video,    hint: "YouTube, Vimeo, or any video URL" },
  { value: "AUDIO",    label: "Audio",       icon: Music,    hint: "Spotify, SoundCloud, MP3 link…" },
  { value: "STREAM",   label: "Live stream", icon: Radio,    hint: "Twitch, YouTube Live, etc." },
  { value: "DOCUMENT", label: "Document",    icon: FileText, hint: "PDF, Notion, Google Doc…" },
  { value: "LINK",     label: "Link",        icon: Link2,    hint: "Any URL" },
];

interface Props { params: Promise<{ contract: string }> }

export default function CollectionSettingsPage({ params }: Props) {
  const { contract } = use(params);
  const { address: walletAddress } = useWallet();
  const { collection, isLoading: collectionLoading } = useCollection(contract);
  const { profile, isLoading: profileLoading, mutate } = useCollectionProfile(contract);
  const { saving, message: saveMessage, save } = useSave();
  const { draft: form, edit } = useDraft({
    displayName: profile?.displayName ?? "",
    description: profile?.description ?? "",
    image: profile?.image ?? "",
    bannerImage: profile?.bannerImage ?? "",
    websiteUrl: profile?.websiteUrl ?? "",
    twitterUrl: profile?.twitterUrl ?? "",
    discordUrl: profile?.discordUrl ?? "",
    telegramUrl: profile?.telegramUrl ?? "",
    gatedEnabled: !!profile?.hasGatedContent,
    gatedContentTitle: profile?.gatedContentTitle ?? "",
    gatedContentUrl: "",
    gatedContentType: "",
  });

  const isOwner = isCollectionOwner(collection, walletAddress);

  if (!collectionLoading && collection && !isOwner) {
    return (
      <div className="py-8">
        <p className="text-muted-foreground">You don&apos;t have permission to edit this collection.</p>
      </div>
    );
  }

  async function handleSave() {
    await save("Collection profile updated.", async () => {
      const payload = {
        displayName: form.displayName || null,
        description: form.description || null,
        image: form.image || null,
        bannerImage: form.bannerImage || null,
        websiteUrl: form.websiteUrl || null,
        twitterUrl: form.twitterUrl || null,
        discordUrl: form.discordUrl || null,
        telegramUrl: form.telegramUrl || null,
        gatedContentTitle: form.gatedEnabled ? (form.gatedContentTitle || null) : null,
        gatedContentUrl: form.gatedEnabled ? (form.gatedContentUrl || null) : null,
        gatedContentType: form.gatedEnabled
          ? ((form.gatedContentType || null) as "VIDEO" | "STREAM" | "AUDIO" | "DOCUMENT" | "LINK" | null)
          : null,
      };
      await getMedialaneClient().api.collections.updateProfile(contract, payload);
      await mutate();
    });
  }

  const field = (
    key: keyof typeof form,
    label: string,
    placeholder = "",
    helper?: string
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        placeholder={placeholder}
        value={form[key] as string}
        onChange={(e) => edit({ [key]: e.target.value })}
      />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold">Collection Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Update your collection profile and links.</p>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Identity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Basic information about your collection</p>
        </div>
        <div className="border-t border-border pt-4 space-y-4">
          {field("displayName", "Display name", collection?.name ?? "Collection name")}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => edit({ description: e.target.value })}
              rows={4}
              placeholder="Tell people about your collection…"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Media</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Images for your collection</p>
        </div>
        <div className="border-t border-border pt-4 space-y-4">
          {field("image", "Cover image", "ipfs://Qm…", "IPFS or HTTPS URL, e.g. ipfs://Qm…")}
          {field("bannerImage", "Banner image", "ipfs://Qm…", "IPFS or HTTPS URL, displayed at the top of your collection page")}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Links</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Your collection&apos;s web presence</p>
        </div>
        <div className="border-t border-border pt-4 space-y-4">
          {field("websiteUrl", "Website", "https://…")}
          {field("twitterUrl", "Twitter / X", "https://twitter.com/…")}
          {field("discordUrl", "Discord", "https://discord.gg/…")}
          {field("telegramUrl", "Telegram", "https://t.me/…")}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            Exclusive content
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reward your holders with exclusive access — video, audio, documents, or any link.
            Only verified token holders can access this content.
          </p>
        </div>
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Enable exclusive content</p>
              <p className="text-xs text-muted-foreground">Adds a locked tab visible only to token holders</p>
            </div>
            <Switch
              checked={form.gatedEnabled}
              onCheckedChange={(checked) => edit({ gatedEnabled: checked })}
            />
          </div>

          {form.gatedEnabled && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="gatedContentTitle">Content title</Label>
                <Input
                  id="gatedContentTitle"
                  placeholder="e.g. Behind-the-scenes footage"
                  value={form.gatedContentTitle}
                  onChange={(e) => edit({ gatedContentTitle: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gatedContentUrl">Content URL</Label>
                <Input
                  id="gatedContentUrl"
                  placeholder="https://…"
                  value={form.gatedContentUrl}
                  onChange={(e) => edit({ gatedContentUrl: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Only holders will see this URL. Use a private or unlisted link.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Content type</Label>
                <Select
                  value={form.gatedContentType}
                  onValueChange={(v) => edit({ gatedContentType: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Gem className="h-4 w-4 text-muted-foreground" />
            Collection URL
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Claim a vanity URL — medialane.io/collection/your-name
          </p>
        </div>
        <CollectionSlugClaimSection contract={contract} profile={profile ?? null} />
      </div>

      <InlineNote message={saveMessage} />
      <Button onClick={handleSave} disabled={saving || collectionLoading || profileLoading}>
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}
