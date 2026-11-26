import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { ClaimCollectionPanel } from "@/components/claim/claim-collection-panel";
import { PageAside } from "@medialane/ui/page-aside";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Existing Memecoin";
const description = "Connect a memecoin you've already launched to your creator profile.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/launchpad/memecoin"),
  ...buildSocialMetadata({ title, description, imageAlt: "Existing Memecoin on Medialane" }),
};

export default function MemecoinClaimPage() {
  return (
    <ClaimRouteShell
      gated={false}
      icon={<Coins className="h-4 w-4 text-white" />}
      title="Existing Memecoin"
      subtitle="Connect a memecoin you've already launched to your creator profile."
      aside={<PageAside kind="claimMemecoin" />}
    >
      <ClaimCollectionPanel kind="coin" helperText="Paste the coin contract address." />
    </ClaimRouteShell>
  );
}
