import type { Metadata } from "next";
import { JourneyContent } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Your Journey";
const description = "How levels and badges work on Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/journey"),
  ...buildSocialMetadata({ title, description }),
};

export default function JourneyPage() {
  return <JourneyContent startHint="Connect a wallet to start." />;
}
