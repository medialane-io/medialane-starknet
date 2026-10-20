"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CollectionPage, useCollection, type CollectionMarketActions, type CollectionPageSlots } from "@medialane/ui";
import type { ApiOrder, ApiToken } from "@medialane/sdk";
import { useCoin } from "@/hooks/use-coins";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { CollectionServiceAction } from "@/components/services/collection-service-action";
import { TransferCollectionOwnershipDialog } from "@/components/collection/transfer-ownership-dialog";
import { useGatedContent } from "@/hooks/use-gated-content";
import { CoinPageClient, CoinPageSkeleton } from "./coin-page-client";

function useCollectionMarketActions(): CollectionMarketActions {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [token, setToken] = useState<ApiToken | null>(null);
  return {
    buy: setOrder,
    offer: setToken,
    dialogs: (
      <>
        {order ? <PurchaseDialog order={order} open onOpenChange={(open) => { if (!open) setOrder(null); }} /> : null}
        {token ? (
          <OfferDialog
            open
            onOpenChange={(open) => { if (!open) setToken(null); }}
            assetContract={token.contractAddress}
            tokenId={token.tokenId}
            tokenName={token.metadata?.name ?? undefined}
            tokenImage={token.metadata?.image ?? undefined}
            tokenStandard={token.standard ?? undefined}
          />
        ) : null}
      </>
    ),
  };
}

const SLOTS: CollectionPageSlots = {
  useMarketActions: useCollectionMarketActions,
  useGatedContent,
  ServiceAction: CollectionServiceAction,
  TransferOwnership: TransferCollectionOwnershipDialog,
};

export default function CollectionPageClient() {
  const params = useParams<{ contract?: string; address?: string }>();
  const contract = params.contract ?? params.address ?? "";
  const isCoinRoute = params.address != null;
  const { collection, isLoading } = useCollection(isCoinRoute ? null : contract);
  const tryCoin = isCoinRoute || (!isLoading && !collection);
  const { coin, isLoading: coinLoading } = useCoin(tryCoin ? contract : null);

  if (coin) return <CoinPageClient coin={coin} />;
  if (tryCoin && coinLoading) return <CoinPageSkeleton />;
  return <CollectionPage contract={contract} slots={SLOTS} />;
}
