"use client";

/**
 * CreatorChip — links an account/creator address to its Medialane profile.
 *
 * Resolves the creator profile by wallet address (SWR-cached, 404 → null) and
 * renders avatar + name when a profile exists, gracefully falling back to a
 * generated avatar + shortened address when it doesn't. Always renders a link
 * (to `/creator/{username|address}`) as long as an address is provided, so a
 * creator is always reachable even before they've set up a profile.
 *
 * Reusable anywhere an owner/creator address should be shown as a person rather
 * than a raw hex string (coin page, asset pages, collection headers, …).
 */

import Link from "next/link";
import Image from "next/image";
import { useCreatorProfile } from "@/hooks/use-profiles";
import { ipfsToHttp, cn } from "@/lib/utils";

interface CreatorChipProps {
  address?: string | null;
  /** Leading label, e.g. "by" / "Created by". Pass null to hide. */
  label?: string | null;
  className?: string;
}

export function CreatorChip({ address, label = "by", className }: CreatorChipProps) {
  const { profile } = useCreatorProfile(address ?? undefined);

  if (!address) return null;

  const href = `/creator/${profile?.username || address}`;
  const avatarUrl = profile?.avatarImage ? ipfsToHttp(profile.avatarImage) : null;
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  const name = profile?.displayName || (profile?.username ? `@${profile.username}` : short);
  const initial = (profile?.username || profile?.displayName || address.slice(2)).charAt(0).toUpperCase();

  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2 min-w-0", className)}>
      {label && <span className="text-xs text-muted-foreground shrink-0">{label}</span>}
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={20}
          height={20}
          unoptimized
          className="h-5 w-5 rounded-full object-cover border border-border/60 shrink-0"
        />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-purple text-[9px] font-bold text-white shrink-0">
          {initial}
        </span>
      )}
      <span className="text-xs font-medium text-foreground truncate group-hover:underline underline-offset-2">
        {name}
      </span>
    </Link>
  );
}
