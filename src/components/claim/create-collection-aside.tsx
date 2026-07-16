import { Layers, LayoutGrid, Plus, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

/** Right-rail content for /launchpad/single-editions/collection. */
export function CreateCollectionAside() {
  return (
    <ClaimRail
      included={[
        { icon: Layers, title: "Your own collection", desc: "A collection that's yours to keep — you own it." },
        { icon: LayoutGrid, title: "A branded page", desc: "Custom cover, banner, name and a shareable URL." },
        { icon: Plus, title: "Mint your work into it", desc: "Add as many pieces as you like, whenever you like." },
      ]}
      steps={[
        "Add a name, symbol and image",
        "Publish it — zero platform fees",
        "Start minting your work",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="You own the collection, fully and directly — zero platform fees to publish."
    />
  );
}
