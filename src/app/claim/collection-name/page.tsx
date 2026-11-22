import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { canonical } from "@/lib/seo";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { CollectionNameClaim } from "@medialane/ui";
import { ClaimCollectionNameAside } from "@/components/claim/claim-collection-name-aside";

export const metadata: Metadata = {
  title: "Claim a Collection Name — Medialane",
  description:
    "A short web address for the collection.",
  alternates: canonical("/claim/collection-name"),
  openGraph: {
    title: "Claim a Collection Name — Medialane",
    description: "A short URL for the collection page.",
    type: "website",
    url: "/claim/collection-name",
  },
};

export default function ClaimCollectionNamePage() {
  return (
    <ClaimRouteShell
      icon={<Link2 className="h-4 w-4 text-white" />}
      title="Claim a Collection Name"
      subtitle="Pick a collection to name its URL."
      aside={<ClaimCollectionNameAside />}
    >
      <CollectionNameClaim />
    </ClaimRouteShell>
  );
}
