"use client";

import { getService } from "@medialane/sdk";
import { PopClaimButton } from "@/components/claim/pop-claim-button";
import { TicketOwnerActions } from "@/components/tickets/ticket-owner-actions";

interface CollectionServiceActionProps {
  service: string | null | undefined;
  contractAddress: string;
  /** Collection owner — required by owner-gated service actions (ip-tickets). */
  owner?: string | null;
}

export function CollectionServiceAction({ service, contractAddress, owner }: CollectionServiceActionProps) {
  const id = getService(service)?.id;
  if (id === "pop-protocol") {
    return <PopClaimButton collectionAddress={contractAddress} />;
  }
  if (id === "ip-tickets") {
    return <TicketOwnerActions contractAddress={contractAddress} owner={owner} />;
  }
  return null;
}
