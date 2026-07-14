"use client";

import { getService } from "@medialane/sdk";
import { PopClaimButton } from "@/components/claim/pop-claim-button";

interface CollectionServiceActionProps {
  service: string | null | undefined;
  contractAddress: string;
}

// Visitor-facing service actions (left column). Owner-gated actions
// (ip-tickets create/mint) live in the page's right owner cluster instead —
// see TicketOwnerActions.
export function CollectionServiceAction({ service, contractAddress }: CollectionServiceActionProps) {
  if (getService(service)?.id === "pop-protocol") {
    return <PopClaimButton collectionAddress={contractAddress} />;
  }
  return null;
}
