"use client";

import { Coins, Scale, Share2 } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreateDropAside() {
  return (
    <ClaimRail
      included={[
        { icon: Share2, title: "A drop page to share", desc: "Collectors mint straight from your page." },
        { icon: Coins, title: "Price and supply", desc: "Set by the creator." },
        { icon: Scale, title: "Licensing you control", desc: "Set how collectors can use the work." },
      ]}
      steps={["Add your artwork and details", "Set price and timing", "Launch and share"]}
    />
  );
}
