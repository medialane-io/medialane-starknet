"use client";

import { RemixesTab as RemixesTabBase } from "@medialane/ui";
import { getMedialaneClient } from "@/lib/medialane-client";

export function RemixesTab({ contractAddress, tokenId }: { contractAddress: string; tokenId: string }) {
  return <RemixesTabBase getClient={getMedialaneClient} contractAddress={contractAddress} tokenId={tokenId} />;
}

export { ParentAttributionBanner } from "@medialane/ui/parent-attribution-banner";
