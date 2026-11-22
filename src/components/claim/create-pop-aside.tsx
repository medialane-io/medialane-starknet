"use client";

import { Award, Ticket, LayoutGrid, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreatePopAside() {
  return (
    <ClaimRail
      included={[
        { icon: Award, title: "An immutable certificate", desc: "A digital asset certificate for authenticity." },
        { icon: Ticket, title: "Theirs to keep", desc: "It stays in their wallet — a real record they were there." },
        { icon: LayoutGrid, title: "A branded event page", desc: "A page for the event, with a shareable claim link." },
      ]}
      steps={[
        "Add the event details and image",
        "Publish it — zero platform fees",
        "Share the link",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="The creator owns the collection, fully and directly — zero platform fees to publish."
    />
  );
}
