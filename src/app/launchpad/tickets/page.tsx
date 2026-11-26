import type { Metadata } from "next";
import { ServiceCollectionsPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "IP Tickets";
const description = "Create event tickets with verifiable ownership and validity, which holders can resell.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/tickets"),
  ...buildSocialMetadata({ title, description }),
};

export default function TicketsPage() {
  return <ServiceCollectionsPage kind="tickets" />;
}
