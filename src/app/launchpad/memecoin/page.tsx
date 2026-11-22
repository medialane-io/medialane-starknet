import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { ClaimCollectionPanel } from "@/components/claim/claim-collection-panel";
import { ClaimMemecoinAside } from "@/components/claim/claim-memecoin-aside";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Claim Memecoin";
const description = "Bring a Starknet coin to Medialane.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/memecoin"),
  ...buildSocialMetadata({ title, description, imageAlt: "Claim a Memecoin on Medialane" }),
};

export default function MemecoinClaimPage() {
  return (
    <ClaimRouteShell
      gated={false}
      icon={<Coins className="h-4 w-4 text-white" />}
      title="Claim a Memecoin"
      subtitle="Add a Starknet coin for trading."
      aside={<ClaimMemecoinAside />}
    >
      <ClaimCollectionPanel kind="coin" helperText="Paste the coin contract address." />
    </ClaimRouteShell>
  );
}
