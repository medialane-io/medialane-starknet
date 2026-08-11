"use client";

import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import { useCreatorProfile } from "@/hooks/use-profiles";
import { AddressDisplay } from "@/components/shared/address-display";
import { CreatorScoreInline } from "@/components/rewards/creator-score-inline";
import { ipfsToHttp } from "@/lib/utils";

export function CreatorChip({ address }: { address: string }) {
  const { profile } = useCreatorProfile(address);
  const avatar = profile?.avatarImage ? ipfsToHttp(profile.avatarImage) : null;
  const label = profile?.displayName || profile?.username || null;

  return (
    <Link
      href={`/account/${address}`}
      className="inline-flex items-center gap-2.5 rounded-full pr-3 py-1 pl-1 hover:bg-muted/60 active:scale-[0.98] transition"
    >
      <span className="relative h-7 w-7 shrink-0 rounded-full">
        <span className="ml-collection-ring" aria-hidden />
        <span className="absolute inset-[1.5px] rounded-full overflow-hidden bg-muted flex items-center justify-center">
          {avatar ? (
            <Image src={avatar} alt="" fill sizes="28px" className="object-cover" unoptimized />
          ) : (
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </span>
      </span>
      <span className="flex items-center gap-1.5 text-sm min-w-0">
        <span className="text-muted-foreground shrink-0">by</span>
        {label ? (
          <span className="font-semibold text-foreground truncate">{label}</span>
        ) : (
          <AddressDisplay address={address} chars={6} showCopy={false} className="font-semibold text-foreground" />
        )}
      </span>
      <CreatorScoreInline address={address} size="sm" />
    </Link>
  );
}
