import { Ticket, ShieldCheck, LayoutGrid, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

/** Right-rail content for /launchpad/tickets/create. */
export function CreateTicketAside() {
  return (
    <ClaimRail
      included={[
        { icon: Ticket, title: "A verifiable ticket", desc: "Each ticket is a real NFT your buyers can hold and show." },
        { icon: ShieldCheck, title: "Redeemable at the door", desc: "One tap marks a ticket used — it stays theirs, just no longer valid for entry." },
        { icon: LayoutGrid, title: "A branded event page", desc: "Your event, with a shareable ticket link." },
      ]}
      steps={[
        "Create your ticket collection — set name, symbol, and cover image",
        "Add an event — set price, supply, and expiration",
        "Share the link — buyers mint directly",
      ]}
      trustIcon={Gift}
      trustLead="You keep the proceeds."
      trust="Payment flows directly to your own wallet, instantly."
    />
  );
}
