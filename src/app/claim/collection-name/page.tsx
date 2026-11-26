import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { canonical } from "@/lib/seo";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { CollectionNameClaim } from "@medialane/ui";
import { PageAside } from "@medialane/ui/page-aside";

export const metadata: Metadata = {
  title: "Collection Address — Medialane",
  description:
    "A short web address for the collection.",
  alternates: canonical("/claim/collection-name"),
  openGraph: {
    title: "Collection Address — Medialane",
    description: "Give your collection a short, memorable link that's easy to share.",
    type: "website",
    url: "/claim/collection-name",
  },
};

export default function ClaimCollectionNamePage() {
  return (
    <ClaimRouteShell
      icon={<Link2 className="h-4 w-4 text-white" />}
      title="Collection Address"
      subtitle="Give your collection a short, memorable link that's easy to share."
      aside={<PageAside kind="claimCollectionName" />}
    >
      <CollectionNameClaim />
    </ClaimRouteShell>
  );
}
