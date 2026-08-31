"use client";

import Link from "next/link";
import Image from "next/image";
import { useCreatorProfile } from "@/hooks/use-profiles";
import { ipfsToHttp, cn } from "@/lib/utils";
import { profileIdentity } from "@medialane/ui";

interface CreatorChipProps {
  address?: string | null;

  label?: string | null;
  className?: string;
}

export function CreatorChip({ address, label = "by", className }: CreatorChipProps) {
  const { profile } = useCreatorProfile(address ?? undefined);

  if (!address) return null;

  const href = `/creator/${profile?.username || address}`;
  const avatarUrl = profile?.avatarImage ? ipfsToHttp(profile.avatarImage) : null;
  const { identity: name } = profileIdentity({
    username: profile?.username,
    name: profile?.name,
    walletAddress: address,
  });
  const initial = (profile?.username || address.slice(2)).charAt(0).toUpperCase();

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
