"use client";

import { Ticket, ChevronRight } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreateTicketAside() {
  return (
    <ClaimRail
      included={[
        { icon: Ticket, title: "Unlimited tickets", desc: "Create as many tickets as you need without deploying again." },
        { icon: ChevronRight, title: "You keep full control", desc: "Only you can create and mint tickets." },
      ]}
      steps={[
        "Create the tickets collection",
        "Add tickets",
        "Mint tickets to attendees directly from your collection page",
      ]}
      trustIcon={Ticket}
      trustLead="Permanent."
      trust="Holders keep their tickets."
    />
  );
}
