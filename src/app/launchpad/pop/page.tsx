import type { Metadata } from "next";
import { PopPage } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "POP Protocol";
const description = "Issue soulbound certificates as lasting proof of participation and achievement.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/pop"),
  ...buildSocialMetadata({ title, description }),
};

export default function PopRoute() {
  return <PopPage />;
}
