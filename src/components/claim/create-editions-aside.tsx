import { Layers, LayoutGrid, Plus, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

/** Right-rail content for /launchpad/nfteditions/create. */
export function CreateEditionsAside() {
  return (
    <ClaimRail
      included={[
        { icon: Layers, title: "Multi-edition collection", desc: "Each piece can have many editions to sell or share." },
        { icon: LayoutGrid, title: "A branded page", desc: "Custom cover, name and a shareable URL." },
        { icon: Plus, title: "Mint editions anytime", desc: "Add new editions whenever you like." },
      ]}
      steps={[
        "Add a name, symbol and image",
        "Publish it — zero platform fees",
        "Mint editions into it",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="You own the collection, fully and directly — zero platform fees to publish."
    />
  );
}
