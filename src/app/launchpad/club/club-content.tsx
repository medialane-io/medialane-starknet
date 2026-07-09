"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Users, IdCard, Plus, Layers, KeyRound } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/ui/motion-primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ServiceHeader } from "@medialane/ui";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { useClubCollections } from "@/hooks/use-club";
import { ipfsToHttp } from "@/lib/utils";
import { hasCapability, type ApiCollection } from "@medialane/sdk";

const CLUB_TRANSFERABLE = hasCapability("ip-club", "transfer");

function ClubCard({ collection }: { collection: ApiCollection }) {
  const [imgError, setImgError] = useState(false);
  const imageUrl = collection.image ? ipfsToHttp(collection.image) : null;
  const showImage = imageUrl && !imgError;
  const initial = (collection.name ?? "C").charAt(0).toUpperCase();

  return (
    <Link href={`/launchpad/club/${collection.contractAddress}`} className="block group">
      <div className="bento-cell overflow-hidden flex flex-col active:border-indigo-500/40 transition-colors">
        <div className="relative aspect-video w-full overflow-hidden bg-muted shrink-0">
          {showImage ? (
            <Image
              src={imageUrl}
              alt={collection.name ?? "Club"}
              fill
              className="object-cover"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 via-violet-500/20 to-indigo-900/60 flex items-center justify-center">
              <IdCard className="h-12 w-12 text-indigo-300/20" />
              <span className="absolute text-6xl font-black text-white/5 select-none">{initial}</span>
            </div>
          )}
          <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-widest text-white bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5">
            CLUB
          </span>
        </div>
        <div className="p-4 flex flex-col gap-3 flex-1">
          <div className="flex-1 space-y-1">
            <p className="font-bold text-sm leading-tight">{collection.name ?? "Unnamed Club"}</p>
            {collection.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {collection.description}
              </p>
            )}
          </div>
          {collection.symbol && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="h-3 w-3" />
              {collection.symbol}
            </span>
          )}
          <div className="text-xs text-indigo-400 font-medium">View club →</div>
        </div>
      </div>
    </Link>
  );
}

function ClubCardSkeleton() {
  return (
    <div className="bento-cell overflow-hidden">
      <Skeleton className="aspect-video w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-8 w-full mt-2" />
      </div>
    </div>
  );
}

const CLUB_FEATURES = [
  { icon: IdCard, title: "Membership card", desc: "Each member holds a real NFT proving they belong — permanently on-chain." },
  { icon: KeyRound, title: "Open or close joining", desc: "Reversible at any time — never affects existing members." },
  { icon: Users, title: "Optional entry fee", desc: "Set a price to join, or keep it free. You keep what members pay." },
  CLUB_TRANSFERABLE
    ? { icon: Layers, title: "Transferable", desc: "Standard NFTs — members can trade their card in any marketplace." }
    : { icon: Layers, title: "Non-transferable card", desc: "Soulbound to the member's wallet — belonging can't be bought or sold." },
];

export function ClubContent() {
  const { collections, isLoading } = useClubCollections();

  return (
    <div className="pb-16 space-y-10">
      <section className="px-4 pt-10 max-w-5xl mx-auto">
        <ClaimBackButton />
        <FadeIn>
          <div className="mt-6">
            <ServiceHeader
              icon={<Users className="h-4 w-4 text-white" />}
              title="IP Club"
              subtitle="Membership clubs backed by an on-chain card — give your closest fans a way in, with or without an entry fee."
              headerAccessory={
                <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                  <Link href="/launchpad/club/create">
                    <Plus className="h-3.5 w-3.5" />
                    Create Club
                  </Link>
                </Button>
              }
            />
          </div>
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto">
        <FadeIn>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CLUB_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bento-cell p-4 space-y-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-indigo-400" />
                </div>
                <p className="text-sm font-semibold leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      <section className="px-4 space-y-4 max-w-5xl mx-auto">
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Live</p>
              <h2 className="text-xl font-bold mt-0.5">Clubs</h2>
            </div>
          </div>
        </FadeIn>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <ClubCardSkeleton key={i} />)}
          </div>
        ) : collections.length === 0 ? (
          <FadeIn>
            <div className="bento-cell border-dashed p-12 text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-2xl bg-indigo-500/8 flex items-center justify-center">
                  <Users className="h-8 w-8 text-indigo-400/30" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-sm">No clubs yet</p>
                <p className="text-xs text-muted-foreground">Be the first to launch one on Medialane.</p>
              </div>
              <Button asChild size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                <Link href="/launchpad/club/create">
                  <Plus className="h-3.5 w-3.5" />
                  Create Club
                </Link>
              </Button>
            </div>
          </FadeIn>
        ) : (
          <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {collections.map((col) => (
              <StaggerItem key={col.contractAddress}>
                <ClubCard collection={col} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}
