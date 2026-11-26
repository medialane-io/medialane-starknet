"use client";

import Link from "next/link";
import { Package, Globe, Share2, ShieldCheck, Palette, ArrowRight } from "lucide-react";
import { Button } from "@medialane/ui/button";
import { WalletGate } from "@/components/claim/wallet-gate";
import { ClaimCollectionPanel } from "@/components/claim/claim-collection-panel";
import { UsernameClaimPanel } from "@/components/shared/username-claim-panel";
import { BackButton, IconTile, PageContainer, PageHeader, SectionHeading } from "@medialane/ui";

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function ClaimPageClient() {
  return (
    <PageContainer variant="narrow" className="space-y-16">
      <PageHeader
        back={<BackButton />}
        icon={<Package />}
        title="Claims & Drops"
        subtitle="Drops, collections and creator pages."
      />

      <section className="space-y-8">
        <SectionDivider label="Genesis drop" />
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-4">
          <div className="flex items-start gap-4">
            <IconTile className="mt-0.5">
              <Package />
            </IconTile>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold">Genesis NFT</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The Medialane Genesis NFT is the first collection minted on our launchpad.
                Holders get early access, governance rights, and exclusive creator perks.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
            <Button asChild className="bg-brand-purple hover:brightness-110 text-white">
              <Link href="/launchpad/drop">
                View Genesis Drop <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <SectionDivider label="Claim your collection" />
        <div className="space-y-6">
          <SectionHeading
            title="Existing Collection"
            subtitle="Link a Starknet collection to your profile."
          />
          <WalletGate>
            <ClaimCollectionPanel />
          </WalletGate>
        </div>
      </section>

      <section className="space-y-8">
        <SectionDivider label="Claim your creator page" />
        <div className="space-y-6">
          <SectionHeading
            title="Username"
            subtitle={
              <>
                Reserve your creator URL at{" "}
                <span className="tabular-nums text-foreground">medialane.io/creator/yourname</span>.
              </>
            }
          />
          <WalletGate>
            <UsernameClaimPanel />
          </WalletGate>
        </div>
      </section>

      <section className="space-y-8">
        <SectionDivider label="Your collection page" />
        <div className="space-y-6">
          <SectionHeading
            title="Branded Drop Page"
            subtitle="Every collection you deploy on Medialane gets a fully branded, shareable page — no setup required."
          />
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-5">

            <div className="flex items-center gap-2 bg-muted/50 border border-border/60 rounded-lg px-3 py-2 tabular-nums text-sm max-w-md">
              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground text-xs">medialane.io/collections/</span>
              <span className="text-foreground text-xs font-semibold truncate">0x04f5…1a3b</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <IconTile size="sm" className="mt-0.5">
                  <Palette />
                </IconTile>
                <div>
                  <p className="text-sm font-semibold">Fully branded</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Editable name and cover.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Share2 className="h-4 w-4 text-brand-blue" />
                </div>
                <div>
                  <p className="text-sm font-semibold">One shareable link</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Share your collection.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <IconTile size="sm" className="mt-0.5">
                  <ShieldCheck />
                </IconTile>
                <div>
                  <p className="text-sm font-semibold">Always accessible</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Permanent on Starknet.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
              <Button size="sm" asChild>
                <Link href="/launchpad/single-editions/collection">
                  Create a collection <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
              <Button variant="soft" size="sm" asChild>
                <Link href="/collections">Browse collections</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
