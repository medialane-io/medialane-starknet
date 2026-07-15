"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useWallet } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { useCollectionsByOwner } from "@/hooks/use-collections";
import { FadeIn } from "@/components/ui/motion-primitives";
import { getService } from "@medialane/sdk";
import { LaunchpadGroupedSections, LaunchpadFilterBar, useLaunchpadFilter, type ServiceOverrides } from "@medialane/ui";
import { ArrowRight, ExternalLink } from "lucide-react";

// ── dapp-specific service overrides (hrefs + rollout flips) ─────────────────
const DAPP_OVERRIDES: ServiceOverrides = {
  "nfts": { href: "/launchpad/single-editions" },
  "limited-editions": { href: "/launchpad/nfteditions" },
  "remix-asset": { href: "/launchpad/remix" },
  "pop-protocol": { href: "/launchpad/pop" },
  "collection-drop": { href: "/launchpad/drop" },
  "ip-tickets": { href: "/launchpad/tickets" },
  "ip-club": { href: "/launchpad/club" },
  "ip-sponsorship": { href: "/launchpad/sponsorship" },
  "creator-coins": { href: "/launchpad/coin/create" },
  "claim-memecoin": { href: "/launchpad/memecoin" },
  "claim-username": { href: "/claim/username" },
  "claim-collection": { href: "/claim/collection" },
  "claim-collection-name": { href: "/claim/collection-name" },
};

export function LaunchpadContent() {
  const { isConnected, address: walletAddress } = useWallet();
  const filter = useLaunchpadFilter();
  const { collections } = useCollectionsByOwner(walletAddress ?? null);

  // Live per-user facts on the cards — real counts, shown only when nonzero.
  const overrides = useMemo<ServiceOverrides>(() => {
    const nftCount = collections.filter((c) => getService(c.service)?.id === "mip-erc721").length;
    const editionsCount = collections.filter((c) => c.standard === "ERC1155").length;
    const withMeta = (key: string, count: number): ServiceOverrides =>
      count > 0 ? { [key]: { ...DAPP_OVERRIDES[key], meta: `${count} collection${count === 1 ? "" : "s"}` } } : {};
    return { ...DAPP_OVERRIDES, ...withMeta("nfts", nftCount), ...withMeta("limited-editions", editionsCount) };
  }, [collections]);

  return (
    <div className="relative pb-20 space-y-8 sm:space-y-10">

      {/* ── medialane.io widget — top right, scrolls with the page ── */}
      <a
        href="https://medialane.io/launchpad"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 right-4 sm:right-6 lg:right-8 z-20 flex items-center gap-2 h-11 px-4 rounded-full bg-background/10 backdrop-blur-xl text-sm font-semibold hover:bg-background/20 active:scale-[0.98] transition-all"
      >
        Sign in with email
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </a>

      <section className="px-4 pt-16 sm:pt-20 space-y-5">
        <FadeIn>
          <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">Launchpad</h1>
        </FadeIn>
        <FadeIn delay={0.08}>
          <LaunchpadFilterBar
            query={filter.query}
            onQueryChange={filter.setQuery}
            groups={filter.filterableGroups}
            activeGroups={filter.activeGroups}
            onToggleGroup={filter.toggleGroup}
          />
        </FadeIn>
      </section>

      {/* Grouped services (shared @medialane/ui component) */}
      <section className="px-4">
        <LaunchpadGroupedSections
          overrides={overrides}
          query={filter.query}
          activeGroups={filter.activeGroups}
          onClearFilters={filter.clear}
        />
      </section>

      {isConnected ? (
        <section className="px-4">
          <FadeIn>
            <div className="rounded-2xl border border-border/40 p-5 bg-gradient-to-r from-brand-navy/10 to-brand-purple/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="section-label">Manage</p>
                <p className="font-bold text-base mt-0.5">Your portfolio</p>
                <p className="text-sm text-muted-foreground mt-1">Assets, listings, offers, and activity.</p>
              </div>
              <Button variant="outline" asChild className="shrink-0">
                <Link href="/portfolio">
                  View portfolio <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </div>
          </FadeIn>
        </section>
      ) : null}
    </div>
  );
}
