"use client";

import { use, useState, useEffect } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useCollection } from "@/hooks/use-collections";
import { useCollectionProfile } from "@/hooks/use-profiles";
import { getMedialaneClient } from "@/lib/medialane-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Lock, Gem, CheckCircle2,
  Video, Music, Radio, FileText, Link2,
} from "lucide-react";
import type { ApiCollectionProfile } from "@medialane/sdk";

const CONTENT_TYPES = [
  { value: "VIDEO",    label: "Video",       icon: Video,    hint: "YouTube, Vimeo, or any video URL" },
  { value: "AUDIO",    label: "Audio",       icon: Music,    hint: "Spotify, SoundCloud, MP3 link…" },
  { value: "STREAM",   label: "Live stream", icon: Radio,    hint: "Twitch, YouTube Live, etc." },
  { value: "DOCUMENT", label: "Document",    icon: FileText, hint: "PDF, Notion, Google Doc…" },
  { value: "LINK",     label: "Link",        icon: Link2,    hint: "Any URL" },
];

function CollectionSlugClaimSection({
  contract,
  profile,
}: {
  contract: string;
  profile: ApiCollectionProfile | null;
}) {
  const [slugInput, setSlugInput] = useState("");
  const [checkState, setCheckState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [checkReason, setCheckReason] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleCheck = async () => {
    const slug = slugInput.toLowerCase().trim();
    if (!slug) return;
    setCheckState("checking");
    setCheckReason(null);
    try {
      const result = await getMedialaneClient().api.checkCollectionSlugAvailability(slug);
      setCheckState(result.available ? "available" : "taken");
      if (!result.available) setCheckReason(result.reason ?? "That slug is not available.");
    } catch {
      setCheckState("invalid");
      setCheckReason("Unable to check availability. Try again.");
    }
  };

  const handleSubmit = async () => {
    const slug = slugInput.toLowerCase().trim();
    if (!slug || checkState !== "available") return;
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      await getMedialaneClient().api.submitCollectionSlugClaim(contract, slug, "");
      setSubmitState("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit claim.";
      setSubmitError(msg);
      setSubmitState("error");
    }
  };

  if (profile?.slug) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">Active URL</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-600 border-emerald-500/30">
            Active
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          medialane.io/collection/{profile.slug}
        </p>
      </div>
    );
  }

  if (submitState === "done") {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Claim submitted</span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-500/30">
            Pending review
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Your claim for{" "}
          <span className="tabular-nums text-foreground">medialane.io/collection/{slugInput}</span>{" "}
          is under review.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            medialane.io/collection/
          </span>
          <input
            type="text"
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50 min-w-0"
            placeholder="your-name"
            value={slugInput}
            onChange={(e) => {
              setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
              setCheckState("idle");
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCheck(); }}
            maxLength={20}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={!slugInput.trim() || checkState === "checking"}
          className="shrink-0"
        >
          {checkState === "checking" ? "Checking…" : "Check"}
        </Button>
      </div>

      {checkState === "available" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-600 font-medium truncate">
            ✓ Available — <span className="tabular-nums">medialane.io/collection/{slugInput}</span>
          </p>
          <Button size="sm" onClick={handleSubmit} disabled={submitState === "submitting"} className="shrink-0">
            {submitState === "submitting" ? "Claiming…" : "Claim this URL"}
          </Button>
        </div>
      )}

      {(checkState === "taken" || checkState === "invalid") && (
        <p className="text-xs text-destructive">{checkReason ?? "That slug is not available."}</p>
      )}

      {submitState === "error" && (
        <p className="text-xs text-destructive">{submitError}</p>
      )}

      <p className="text-xs text-muted-foreground">
        3–20 characters, lowercase letters, numbers, underscores or hyphens. Claims are reviewed before going live.
      </p>
    </div>
  );
}

interface Props { params: Promise<{ contract: string }> }

export default function CollectionSettingsPage({ params }: Props) {
  const { contract } = use(params);
  const { address: walletAddress } = useWallet();
  const { collection, isLoading: collectionLoading } = useCollection(contract);
  const { profile, isLoading: profileLoading, mutate } = useCollectionProfile(contract);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    displayName: "", description: "", image: "", bannerImage: "",
    websiteUrl: "", twitterUrl: "", discordUrl: "", telegramUrl: "",
    gatedEnabled: false,
    gatedContentTitle: "",
    gatedContentUrl: "",
    gatedContentType: "",
  });

  useEffect(() => {
    if (profile) {
      setForm(f => ({
        ...f,
        displayName: profile.displayName ?? "",
        description: profile.description ?? "",
        image: profile.image ?? "",
        bannerImage: profile.bannerImage ?? "",
        websiteUrl: profile.websiteUrl ?? "",
        twitterUrl: profile.twitterUrl ?? "",
        discordUrl: profile.discordUrl ?? "",
        telegramUrl: profile.telegramUrl ?? "",
        gatedEnabled: !!profile.hasGatedContent,
        gatedContentTitle: profile.gatedContentTitle ?? "",
      }));
    }
  }, [profile]);

  const isOwner = walletAddress && collection?.owner &&
    walletAddress.toLowerCase() === collection.owner.toLowerCase();

  if (!collectionLoading && collection && !isOwner) {
    return (
      <div className="py-8">
        <p className="text-muted-foreground">You don&apos;t have permission to edit this collection.</p>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
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
        // gatedContentUrl and gatedContentType are accepted by the backend but not
        // yet reflected in ApiCollectionProfile — cast until the SDK type catches up
        gatedContentUrl: form.gatedEnabled ? (form.gatedContentUrl || null) : null,
        gatedContentType: form.gatedEnabled ? (form.gatedContentType || null) : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;
      await getMedialaneClient().api.updateCollectionProfile(contract, payload, "");
      await mutate();
      toast.success("Collection profile updated");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
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
        onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
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

      {/* Identity */}
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
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              rows={4}
              placeholder="Tell people about your collection…"
            />
          </div>
        </div>
      </div>

      {/* Media */}
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

      {/* Links */}
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

      {/* Exclusive content */}
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
              onCheckedChange={(checked) => setForm(f => ({ ...f, gatedEnabled: checked }))}
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
                  onChange={(e) => setForm(f => ({ ...f, gatedContentTitle: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gatedContentUrl">Content URL</Label>
                <Input
                  id="gatedContentUrl"
                  placeholder="https://…"
                  value={form.gatedContentUrl}
                  onChange={(e) => setForm(f => ({ ...f, gatedContentUrl: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Only holders will see this URL. Use a private or unlisted link.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Content type</Label>
                <Select
                  value={form.gatedContentType}
                  onValueChange={(v) => setForm(f => ({ ...f, gatedContentType: v }))}
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

      {/* Collection URL slug */}
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

      <Button onClick={handleSave} disabled={saving || collectionLoading || profileLoading}>
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}
