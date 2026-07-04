import type { Metadata } from "next";
import { ActivitiesFeed } from "./activities-feed";
import { Activity } from "lucide-react";
import { PageContainer } from "@medialane/ui";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Activities";
const description = "Global marketplace activity on Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/activities"),
  ...buildSocialMetadata({ title, description }),
};

export default function ActivitiesPage() {
  return (
    <PageContainer className="box-border max-w-full pt-20 pb-8 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Activity className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Medialane</span>
        </div>
        <h1 className="text-3xl font-bold">Onchain Activity</h1>
        <p className="text-muted-foreground">Mint, markets, events, and more.</p>
      </div>
      <ActivitiesFeed />
    </PageContainer>
  );
}
