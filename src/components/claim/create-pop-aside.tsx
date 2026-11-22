"use client";

import { Award, Ticket, LayoutGrid, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreatePopAside() {
  return (
    <ClaimRail
      included={[
        { icon: Award, title: "An immutable certificate", desc: "A digital asset certificate for authenticity." },
        { icon: Ticket, title: "Theirs to keep", desc: "A lasting record of being there." },
        { icon: LayoutGrid, title: "A branded event page", desc: "A page with a claim link." },
      ]}
      steps={[
        "Add the event details and image",
        "Publish for free",
        "Share the link",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="Publishing is free."
    />
  );
}
