"use client";

import { Users, ChevronRight } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreateClubAside() {
  return (
    <ClaimRail
      included={[
        { icon: Users, title: "Unlimited tiers", desc: "Create as many membership tiers as you need without deploying again." },
        { icon: ChevronRight, title: "You keep full control", desc: "Only you can create tiers and mint membership cards." },
      ]}
      steps={[
        "Create the club",
        "Add membership tiers",
        "Mint membership cards and sell them on the marketplace like any asset",
      ]}
      trustIcon={Users}
      trustLead="Creator-owned."
      trust="Members trade their cards freely."
    />
  );
}
