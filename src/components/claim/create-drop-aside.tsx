"use client";

import { Coins, Scale, Share2 } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreateDropAside() {
  return (
    <ClaimRail
      included={[
        { icon: Share2, title: "A drop page to share", desc: "Collectors mint straight from your page." },
        { icon: Coins, title: "Your price, your supply", desc: "Free or paid, as many copies as you choose." },
        { icon: Scale, title: "Licensing you control", desc: "Set how collectors can use the work." },
      ]}
      steps={["Add your artwork and details", "Set the price, copies and timing", "Launch, then share your drop page"]}
    />
  );
}
