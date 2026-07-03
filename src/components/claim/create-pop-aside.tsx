import { Award, Ticket, LayoutGrid, Gift } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

/** Right-rail content for /launchpad/pop/create. */
export function CreatePopAside() {
  return (
    <ClaimRail
      included={[
        { icon: Award, title: "A badge people can claim", desc: "Give everyone who showed up a collectible proof." },
        { icon: Ticket, title: "Theirs to keep", desc: "It stays in their wallet — a real record they were there." },
        { icon: LayoutGrid, title: "A branded event page", desc: "Your event, with a shareable claim link." },
      ]}
      steps={[
        "Add your event details and image",
        "Publish it — zero platform fees",
        "Share the claim link with attendees",
      ]}
      trustIcon={Gift}
      trustLead="Zero platform fees."
      trust="You own the collection, fully and directly — zero platform fees to publish."
    />
  );
}
