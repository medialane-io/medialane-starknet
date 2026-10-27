"use client";

import Link from "next/link";
import Image from "next/image";
import { useRewards, LevelBadge } from "@medialane/ui";
import { Settings as Globe, Twitter, ArrowUpRight } from "lucide-react";
import { resolveImage } from "@/lib/utils";
import { addressPalette } from "@/lib/creator-utils";
import { profileHref } from "@/lib/routes";

export type ProfileForm = {
  name: string;
  bio: string;
  avatarImage: string;
  websiteUrl: string;
  twitterUrl: string;
  discordUrl: string;
  telegramUrl: string;
};

export function ProfileLivePreview({
  form, approvedUsername, walletAddress,
}: {
  form: ProfileForm;
  approvedUsername?: string | null;
  walletAddress?: string | null;
}) {
  const avatarUrl = resolveImage(form.avatarImage);
  const { h1 } = addressPalette(walletAddress ?? "0x0");
  const profileName = form.name || "Your name";
  const { data: rewards } = useRewards(walletAddress);

  return (
    <div className="rounded-[24px] border border-border/60 bg-card overflow-hidden">

      <div className="px-2.5 pt-2.5">
        <div className="relative aspect-square w-full overflow-hidden rounded-[16px] bg-muted ring-1 ring-black/10 dark:ring-white/10">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill unoptimized className="object-cover" />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ backgroundColor: `hsl(${h1}, 55%, 42%)` }}
            >
              {profileName.slice(0, 1).toUpperCase()}
            </div>
          )}
          {rewards && rewards.totalXp > 0 && (
            <div className="absolute bottom-2 right-2">
              <LevelBadge level={rewards.currentLevel} name={rewards.currentLevelName} badgeColor={rewards.badgeColor} size="sm" />
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-5 pt-3 space-y-3">
        <div className="min-w-0">
          <p className="truncate text-[18px] font-bold leading-snug text-foreground">{profileName}</p>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="pill-badge text-2xs">Creator</span>
            {approvedUsername && (
              <span className="text-2xs tabular-nums text-muted-foreground">@{approvedUsername}</span>
            )}
          </div>
        </div>

        {form.bio && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{form.bio}</p>
        )}

        {(form.websiteUrl || form.twitterUrl) && (
          <div className="flex items-center gap-2">
            {form.websiteUrl && (
              <span className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
              </span>
            )}
            {form.twitterUrl && (
              <span className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Twitter className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        )}

        {approvedUsername && (
          <Link
            href={profileHref({ username: approvedUsername })}
            className="inline-flex items-center gap-1 text-2xs font-medium text-primary hover:underline"
          >
            View profile
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
