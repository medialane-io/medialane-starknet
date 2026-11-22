"use client";

import { Layers, LayoutGrid, Plus, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreateCollectionAside() {
  return (
    <ClaimRail
      included={[
        { icon: Layers, title: "Your own collection", desc: "Owned by its creator." },
        { icon: LayoutGrid, title: "A branded page", desc: "Custom page and URL." },
        { icon: Plus, title: "Mint your work into it", desc: "Add pieces anytime." },
      ]}
      steps={[
        "Add a name and image",
        "Publish for free",
        "Start minting your work",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="Publishing is free."
    />
  );
}
