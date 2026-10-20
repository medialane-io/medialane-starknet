"use client";

import { RemixesTab as RemixesTabBase } from "@medialane/ui";

export function RemixesTab({ contractAddress, tokenId }: { contractAddress: string; tokenId: string }) {
  return <RemixesTabBase contractAddress={contractAddress} tokenId={tokenId} />;
}

