"use client";

import { Package, Users, Timer, Layers } from "lucide-react";
import { DropListing, ServiceHeader } from "@medialane/ui";
import { FadeIn } from "@/components/ui/motion-primitives";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { getMedialaneClient } from "@/lib/medialane-client";
import { BRAND } from "@/lib/brand";

const DROP_FEATURES = [
  {
    icon: Layers,
    title: "Edition or collection",
    desc: "One artwork in numbered copies, or many unique items.",
  },
  {
    icon: Timer,
    title: "Your sale window",
    desc: "Open now or on a date, close whenever you choose — or never.",
  },
  {
    icon: Users,
    title: "Everyone or a list",
    desc: "Open to all, or only the wallets you invite with claim links.",
  },
  {
    icon: Package,
    title: "Collectors own them",
    desc: "Standard ERC-721 tokens — free to keep, sell or trade anywhere.",
  },
];

export function DropContent() {
  return (
    <div className="pb-16 space-y-10">

      <section className="px-4 pt-10 max-w-5xl mx-auto">
        <ClaimBackButton />
        <FadeIn>
          <div className="mt-6">
            <ServiceHeader
              plain
              icon={<Package className="h-4 w-4 text-white" />}
              title="Collection Drops"
              subtitle="Timed drops with a fixed supply — set your mint window and how many, and the community collects before they're gone."
            />
          </div>
        </FadeIn>
        <FadeIn delay={0.16}>
          <div className="flex flex-wrap gap-2 mt-5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 text-sm">
              <Package className={`h-3.5 w-3.5 ${BRAND.orange.text}`} />
              <span className="text-muted-foreground">Fixed supply cap</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/40 text-sm">
              <Users className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-muted-foreground">Transferable ERC-721</span>
            </div>
          </div>
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto">
        <FadeIn>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DROP_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bento-cell p-4 space-y-2">
                <Icon className="h-5 w-5 text-brand-orange" />
                <p className="text-sm font-semibold leading-tight">{title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto">
        <DropListing getClient={getMedialaneClient} />
      </section>

    </div>
  );
}
