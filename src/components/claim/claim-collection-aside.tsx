"use client";

import { LayoutGrid, UserCircle, Link2 } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function ClaimCollectionAside() {
  return (
    <ClaimRail
      included={[
        { icon: LayoutGrid, title: "Branded collection page", desc: "Editable name and cover." },
        { icon: UserCircle, title: "Linked to your profile", desc: "It shows up on your public profile." },
        { icon: Link2, title: "One shareable URL", desc: "Share your collection." },
      ]}
      steps={[
        "Paste your collection's contract address",
        "We verify you own it on-chain",
        "It goes live on your profile",
      ]}
      trustLead="Non-custodial."
      trust="Assets stay in the collection contract."
    />
  );
}
