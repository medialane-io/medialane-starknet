"use client";

import { ProfileLivePreview, type ProfileForm } from "@/components/settings/profile-live-preview";
import { PortfolioSnapshot, RewardsSnapshot } from "@/components/settings/snapshots";
import { useState } from "react";
import { useWallet } from "@/hooks/use-wallet";
import { useCreatorProfile, useUserOrders, useCollectionsByOwner, AssetPicker, ServiceFormShell, type OwnedAsset } from "@medialane/ui";
import { useMyUsernameClaim } from "@/hooks/use-username-claims";
import { useUsernameClaimForm } from "@/hooks/use-username-claim-form";
import { InlineNote } from "@/components/shared/inline-note";
import { useDraft } from "@/hooks/use-draft";
import { useSave } from "@/hooks/use-save";
import { UsernameInput } from "@/components/shared/username-input";
import { VerifyWithWalletButton } from "@/components/shared/verify-with-wallet-button";
import { useTokensByOwner } from "@/hooks/use-tokens";
import { FastMint } from "@/components/launchpad/fast-mint";
import { useAccountSession } from "@/components/wallet-session-sync";
import { getMedialaneClient } from "@/lib/medialane-client";
import { Button } from "@medialane/ui/button";
import { Input } from "@medialane/ui/input";
import { Label } from "@medialane/ui/label";
import { Textarea } from "@medialane/ui/textarea";
import { Badge } from "@medialane/ui/badge";
import { Skeleton } from "@medialane/ui/skeleton";
import { AtSign, CheckCircle2, Clock, XCircle, Loader2, Settings as SettingsIcon } from "lucide-react";
import { cn, resolveImage } from "@/lib/utils";
import { profileHref } from "@/lib/routes";

const URL_FIELDS = ["websiteUrl", "twitterUrl", "discordUrl", "telegramUrl"] as const;

const isValidUrl = (v: string) =>
  !v || v.startsWith("http://") || v.startsWith("https://") || v.startsWith("ipfs://");

export default function SettingsContent() {
  const { address: walletAddress } = useWallet();
  const { session: accountSession } = useAccountSession();
  const { profile, isLoading: profileLoading, mutate } = useCreatorProfile(walletAddress ?? undefined);
  const { username: approvedUsername, claim } = useMyUsernameClaim();
  const usernameForm = useUsernameClaimForm();

  const usernameVerified = !!accountSession;
  const { tokens: ownedTokens, isLoading: assetsLoading } = useTokensByOwner(walletAddress ?? null, 1, 100);
  const { orders } = useUserOrders(walletAddress ?? null);
  const { collections } = useCollectionsByOwner(walletAddress ?? null);
  const ownedAssets: OwnedAsset[] = ownedTokens.map((t) => ({
    contractAddress: t.contractAddress,
    tokenId: t.tokenId,
    name: t.metadata?.name ?? `Token #${t.tokenId}`,
    image: resolveImage(t.metadata?.image),
  }));
  const activeListings = orders.filter((o) => o.status === "ACTIVE" && o.offer.itemType !== "ERC20");
  const [fastMintOpen, setFastMintOpen] = useState(false);
  const { saving, message: saveMessage, setMessage: setSaveMessage, save } = useSave();
  const { draft: form, edit } = useDraft<ProfileForm>({
    name: profile?.name ?? "",
    bio: profile?.bio ?? "",
    avatarImage: profile?.avatarImage ?? "",
    websiteUrl: profile?.websiteUrl ?? "",
    twitterUrl: profile?.twitterUrl ?? "",
    discordUrl: profile?.discordUrl ?? "",
    telegramUrl: profile?.telegramUrl ?? "",
  });

  async function handleSave() {
    if (!walletAddress) return;
    if (URL_FIELDS.some((k) => !isValidUrl(form[k]))) {
      setSaveMessage({ tone: "error", text: "Every link must start with http://, https:// or ipfs://" });
      return;
    }
    await save("Profile updated.", async () => {
      await getMedialaneClient().api.creators.updateProfile(walletAddress, form);
      await mutate(undefined, { revalidate: true });
    });
  }

  const field = (
    key: keyof ProfileForm,
    label: string,
    placeholder = "",
    helper?: string
  ) => {
    const isUrl = (URL_FIELDS as readonly string[]).includes(key);
    const invalid = isUrl && !isValidUrl(form[key]);
    return (
      <div className="space-y-1.5">
        <Label htmlFor={key}>{label}</Label>
        <Input
          id={key}
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => edit({ [key]: e.target.value })}
          className={invalid ? "border-destructive focus-visible:ring-destructive" : ""}
        />
        {invalid && <p className="text-xs text-destructive">Must start with http://, https://, or ipfs://</p>}
        {!invalid && helper && <p className="text-xs text-muted-foreground">{helper}</p>}
      </div>
    );
  };

  const headerProps = {
    icon: <SettingsIcon className="h-4 w-4 text-white" />,
    title: "Profile Settings",
    subtitle: "Manage your public creator identity.",
  };

  if (profileLoading || (walletAddress && !profile && profileLoading !== false)) {
    return (
      <ServiceFormShell {...headerProps}>
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </ServiceFormShell>
    );
  }

  return (
    <ServiceFormShell
      {...headerProps}
      aside={
        <div className="space-y-4">
          <ProfileLivePreview
            form={form}
            approvedUsername={approvedUsername}
            walletAddress={walletAddress}
          />
          <PortfolioSnapshot
            assets={ownedAssets.length}
            listings={activeListings.length}
            collections={collections.length}
          />
          <RewardsSnapshot address={walletAddress} />
        </div>
      }
    >
      <div className="space-y-8">

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <AtSign className="h-4 w-4" />
              Username
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Claim a unique handle for your shareable profile URL.
            </p>
          </div>

          <div className="border-t border-border pt-4 space-y-3">

            {!usernameVerified && !approvedUsername && (
              <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3">
                <AtSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Verify your username status</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Sign a message with your wallet to check whether you already have a username.
                  </p>
                  <VerifyWithWalletButton className="mt-3" />
                </div>
              </div>
            )}

            {approvedUsername && (
              <div className={cn(
                "rounded-xl border border-green-500/40 bg-green-500/5 p-4 flex items-start gap-3"
              )}>
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Username active</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Your profile is live at{" "}
                    <a
                      href={profileHref({ username: approvedUsername })}
                      className="tabular-nums font-medium text-primary hover:underline"
                    >
                      medialane.io/creator/{approvedUsername}
                    </a>
                  </p>
                </div>
              </div>
            )}

            {!approvedUsername && claim?.status === "PENDING" && (
              <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">Claim under review</p>
                    <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 text-2xs">
                      Pending
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    <span className="tabular-nums font-medium text-foreground">@{claim.username}</span> is awaiting DAO review. You&apos;ll be notified by email once processed.
                  </p>
                </div>
              </div>
            )}

            {!approvedUsername && claim?.status === "REJECTED" && (
              <div className="space-y-4">
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                  <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">Claim rejected</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      <span className="tabular-nums text-foreground">@{claim.username}</span> was not approved.
                      {claim.adminNotes && <span className="ml-1 italic">&ldquo;{claim.adminNotes}&rdquo;</span>}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">You can submit a new claim below.</p>
                  </div>
                </div>
                <UsernameInput form={usernameForm} disabled={!walletAddress} />
                <InlineNote message={usernameForm.message} />
              </div>
            )}

            {usernameVerified && !approvedUsername && !claim && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Get a shareable URL like{" "}
                  <span className="tabular-nums text-foreground">medialane.io/creator/yourname</span>.
                  Claims are reviewed by the Medialane DAO team to prevent impersonation.
                </p>
                <UsernameInput form={usernameForm} disabled={!walletAddress} />
                <InlineNote message={usernameForm.message} />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Identity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Your public profile</p>
          </div>
          <div className="border-t border-border pt-4 space-y-4">
            {field("name", "Name", "Your name")}
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => edit({ bio: e.target.value })}
                rows={3}
                placeholder="Tell the world about yourself and your work…"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Media</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Images for your profile</p>
          </div>
          <div className="border-t border-border pt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Avatar &amp; app theme</Label>
              <p className="text-xs text-muted-foreground">
                Pick one of your NFTs. It becomes your avatar and a subtle background theme across Medialane.
              </p>
              <AssetPicker
                assets={ownedAssets}
                isLoading={assetsLoading}
                selected={ownedAssets.find((a) => a.image === form.avatarImage) ?? null}
                onSelect={(asset) => edit({ avatarImage: asset.image ?? "" })}
                onMintClick={() => setFastMintOpen(true)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Links</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Your web presence</p>
          </div>
          <div className="border-t border-border pt-4 space-y-4">
            {field("websiteUrl", "Website", "https://…")}
            {field("twitterUrl", "Twitter / X", "https://twitter.com/…")}
            {field("discordUrl", "Discord", "https://discord.gg/…")}
            {field("telegramUrl", "Telegram", "https://t.me/…")}
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <Button onClick={handleSave} disabled={saving || !walletAddress || profileLoading} className="w-full sm:w-auto">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
          </Button>
          <div className="mt-2"><InlineNote message={saveMessage} /></div>
        </div>
      </div>

      <FastMint
        presentation="dialog"
        open={fastMintOpen}
        onClose={() => setFastMintOpen(false)}
        mediaKindLock="image"
        onMinted={(asset) => {
          edit({ avatarImage: asset.image ?? "" });
          setFastMintOpen(false);
        }}
      />
    </ServiceFormShell>
  );
}
