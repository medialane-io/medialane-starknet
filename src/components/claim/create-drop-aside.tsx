import { Package, Clock, LayoutGrid, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

/** Right-rail content for /launchpad/drop/create. */
export function CreateDropAside() {
  return (
    <ClaimRail
      included={[
        { icon: Package, title: "A limited drop", desc: "Release a fixed set of unique pieces." },
        { icon: Clock, title: "A timed mint window", desc: "Collectors mint within the window you set." },
        { icon: LayoutGrid, title: "A branded drop page", desc: "Your drop, with a shareable link." },
      ]}
      steps={[
        "Add your items and details",
        "Set the price and mint window",
        "Launch it — zero platform fees",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="You own the drop, fully and directly — zero platform fees to launch."
    />
  );
}
