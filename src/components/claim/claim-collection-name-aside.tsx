"use client";

import { Link2, Share2, LayoutGrid, Sparkles } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function ClaimCollectionNameAside() {
  return (
    <ClaimRail
      included={[
        { icon: Link2, title: "A clean collection URL", desc: "medialane.io/collection/your-name instead of a long address." },
        { icon: Share2, title: "Easy to share", desc: "Made for sharing." },
        { icon: LayoutGrid, title: "Points to your page", desc: "Sends people straight to your branded collection." },
      ]}
      steps={[
        "Pick one of your collections",
        "Choose a custom name",
        "Live after review",
      ]}
      trustIcon={Sparkles}
      trustLead="Free to claim."
      trust="Each URL goes live after review."
    />
  );
}
