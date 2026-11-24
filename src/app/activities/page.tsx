import type { Metadata } from "next";
import { ActivitiesPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Activities";
const description = "Global marketplace activity on Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/activities"),
  ...buildSocialMetadata({ title, description }),
};

export default function ActivitiesRoute() {
  return <ActivitiesPage />;
}
