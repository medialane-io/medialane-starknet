"use client";

import { Layers, LayoutGrid, Plus, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreateEditionsAside() {
  return (
    <ClaimRail
      included={[
        { icon: Layers, title: "Multi-edition collection", desc: "Each piece can have many editions to sell or share." },
        { icon: LayoutGrid, title: "A branded page", desc: "Custom page and URL." },
        { icon: Plus, title: "Mint editions anytime", desc: "Add new editions whenever you like." },
      ]}
      steps={[
        "Add a name and image",
        "Publish for free",
        "Mint editions into it",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="Publishing is free."
    />
  );
}
