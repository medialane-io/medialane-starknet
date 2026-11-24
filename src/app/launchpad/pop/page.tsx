import type { Metadata } from "next";
import { PopPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Proof of Participation";
const description = "Proof of attendance for events.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/pop"),
  ...buildSocialMetadata({ title, description }),
};

export default function PopRoute() {
  return <PopPage />;
}
