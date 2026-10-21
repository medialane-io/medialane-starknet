"use client";

import { useParams } from "next/navigation";
import { CollectionPage, useCollection, type CollectionPageSlots } from "@medialane/ui";
import { useCoin } from "@/hooks/use-coins";
import { CollectionServiceAction } from "@/components/services/collection-service-action";
import { TransferCollectionOwnershipDialog } from "@/components/collection/transfer-ownership-dialog";
import { useGatedContent } from "@/hooks/use-gated-content";
import { CoinPageClient, CoinPageSkeleton } from "./coin-page-client";
import { useMarketActions } from "@/lib/use-market-actions";


const SLOTS: CollectionPageSlots = {
  useMarketActions,
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
