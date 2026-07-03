import { Gem, Scale, LayoutGrid, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

/** Right-rail content for /create/asset. */
export function CreateAssetAside() {
  return (
    <ClaimRail
      included={[
        { icon: Gem, title: "A unique piece", desc: "Mint your work as a one-of-a-kind asset." },
        { icon: Scale, title: "Licensing you control", desc: "Set exactly how others can use it." },
        { icon: LayoutGrid, title: "On your profile", desc: "It shows up on your creator profile and collection." },
      ]}
      steps={[
        "Upload your work and add details",
        "Choose your licensing terms",
        "Mint it — zero platform fees",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="You own it, fully and directly, and authorship is recorded permanently."
    />
  );
}
