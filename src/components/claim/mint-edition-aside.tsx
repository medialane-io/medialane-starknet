import { Sparkles, Layers, FileCheck, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

/** Right-rail content for /launchpad/nfteditions/[contract]/mint. */
export function MintEditionAside() {
  return (
    <ClaimRail
      included={[
        { icon: Sparkles, title: "A new piece", desc: "Mint a new artwork into your collection." },
        { icon: Layers, title: "As many copies as you want", desc: "Choose how many editions to mint." },
        { icon: FileCheck, title: "Recorded as yours", desc: "Authorship is saved permanently with the piece." },
      ]}
      steps={[
        "Add the piece's details and image",
        "Choose how many editions",
        "Mint it — zero platform fees",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="You keep full ownership, fully and directly — zero platform fees to mint."
    />
  );
}
