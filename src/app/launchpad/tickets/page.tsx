import type { Metadata } from "next";
import { TicketsContent } from "./tickets-content";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "IP Tickets";
const description = "Create verifiable on-chain tickets — mint to attendees, trade like any collection.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/tickets"),
  ...buildSocialMetadata({ title, description }),
};

export default function TicketsPage() {
  return <TicketsContent />;
}
