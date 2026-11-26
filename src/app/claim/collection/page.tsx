import type { Metadata } from "next";
import { FolderInput, Globe } from "lucide-react";
import { canonical } from "@/lib/seo";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { ClaimCollectionPanel } from "@/components/claim/claim-collection-panel";
import { PageAside } from "@medialane/ui/page-aside";

export const metadata: Metadata = {
  title: "Existing Collection — Medialane",
  description:
    "Link a Starknet collection to your profile.",
  alternates: canonical("/claim/collection"),
  openGraph: {
    title: "Existing Collection — Medialane",
    description:
      "Link a Starknet collection to your profile.",
    type: "website",
    url: "/claim/collection",
  },
};

const urlPill = (
  <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 max-w-full">
    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
    <span className="tabular-nums text-sm text-foreground/90 truncate">medialane.io/collections/your-collection</span>
  </div>
);

export default function ClaimCollectionPage() {
  return (
    <ClaimRouteShell
      icon={<FolderInput className="h-4 w-4 text-white" />}
      title="Existing Collection"
      subtitle="Bring a collection you already own to your profile and manage its page."
      headerAccessory={urlPill}
      aside={<PageAside kind="claimCollection" />}
    >
      <ClaimCollectionPanel helperText="Paste the collection contract address." />
    </ClaimRouteShell>
  );
}
