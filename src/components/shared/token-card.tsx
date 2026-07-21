"use client";

import { useState } from "react";
import { TokenCard as UiTokenCard, TokenCardSkeleton, type TokenCardProps } from "@medialane/ui";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { ReportDialog } from "@/components/report-dialog";

// Thin wrapper over the shared @medialane/ui TokenCard. The full presentation
// (dropdown menu, price chip, indexing badge, chain-aware hrefs via token.chain)
// lives in the package; this wrapper owns only the wallet/auth-coupled dialogs
// (Offer, Report), passed in as the onOffer/onReport callbacks. Mirrors
// medialane-io's wrapper.
export function TokenCard(props: Omit<TokenCardProps, "onOffer" | "onReport"> & {
  onOffer?: TokenCardProps["onOffer"];
}) {
  const [offerOpen, setOfferOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const { token, onOffer } = props;

  return (
    <>
      <UiTokenCard
        {...props}
        onOffer={onOffer ?? (() => setOfferOpen(true))}
        onReport={() => setReportOpen(true)}
      />
      {offerOpen && (
        <OfferDialog
          open={offerOpen}
          onOpenChange={setOfferOpen}
          assetContract={token.contractAddress}
          tokenId={token.tokenId}
          tokenName={token.metadata?.name ?? undefined}
          tokenImage={token.metadata?.image ?? undefined}
          tokenStandard={token.standard ?? undefined}
        />
      )}
      {reportOpen && (
        <ReportDialog
          target={{
            type: "TOKEN",
            contract: token.contractAddress,
            tokenId: token.tokenId,
            name: token.metadata?.name ?? undefined,
          }}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      )}
    </>
  );
}

export { TokenCardSkeleton };
