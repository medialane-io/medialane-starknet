import type { Metadata } from "next";
import { ServiceCollectionsPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "IP Club";
const description = "Create memberships that give your community access to the benefits you offer.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/club"),
  ...buildSocialMetadata({ title, description }),
};

export default function ClubPage() {
  return <ServiceCollectionsPage kind="club" />;
}
