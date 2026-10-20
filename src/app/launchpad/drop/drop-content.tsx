"use client";

import { Package, Users } from "lucide-react";
import { DropFeatures, DropListing, ServiceHeader } from "@medialane/ui";
import { FadeIn } from "@medialane/ui/motion-primitives";
import { ClaimBackButton } from "@/components/claim/claim-back-button";
import { BRAND } from "@medialane/ui/data/brand";

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
          <DropFeatures />
        </FadeIn>
      </section>

      <section className="px-4 max-w-5xl mx-auto">
        <DropListing />
      </section>

    </div>
  );
}
