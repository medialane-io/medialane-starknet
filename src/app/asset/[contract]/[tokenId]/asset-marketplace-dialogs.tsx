"use client";

import { useCallback, useState } from "react";
import type { ApiOrder } from "@medialane/sdk";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";

type TokenStandard = "ERC721" | "ERC1155" | "UNKNOWN";

/** All marketplace-dialog open/target state for an asset page, in one hook. */
export function useAssetMarketplaceDialogState() {
  const [purchaseOrder, setPurchaseOrder] = useState<ApiOrder | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<ApiOrder | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const handleCancelClick = useCallback((order: ApiOrder) => {
    setOrderToCancel(order);
    setCancelOpen(true);
  }, []);

  return {
    purchaseOrder,
    setPurchaseOrder,
    listOpen,
    setListOpen,
    offerOpen,
    setOfferOpen,
    transferOpen,
    setTransferOpen,
    orderToCancel,
    setOrderToCancel,
    cancelOpen,
    setCancelOpen,
    handleCancelClick,
  };
}

export type AssetMarketplaceDialogState = ReturnType<typeof useAssetMarketplaceDialogState>;

interface AssetMarketplaceDialogsProps {
  contract: string;
  tokenId: string;
  tokenName: string;
  /** Resolved (http) asset image — shown on the success/processing states so the
   *  creator artwork is always front-and-centre. Buy/cancel derive theirs from
   *  the order, so they don't need it passed. */
  tokenImage?: string | null;
  tokenStandard?: TokenStandard;
  hasActiveListing: boolean;
  mutateListings: () => void;
  dialogs: AssetMarketplaceDialogState;
}

/** Renders the five marketplace dialogs (buy, list, offer, transfer, cancel) for an asset page. */
export function AssetMarketplaceDialogs({
  contract,
  tokenId,
  tokenName,
  tokenImage,
  tokenStandard,
  hasActiveListing,
  mutateListings,
  dialogs,
}: AssetMarketplaceDialogsProps) {
  const {
    purchaseOrder,
    setPurchaseOrder,
    listOpen,
    setListOpen,
    offerOpen,
    setOfferOpen,
    transferOpen,
    setTransferOpen,
    orderToCancel,
    setOrderToCancel,
    cancelOpen,
    setCancelOpen,
  } = dialogs;

  return (
    <>
      {purchaseOrder && (
        <PurchaseDialog
          order={purchaseOrder}
          open
          onOpenChange={(v) => { if (!v) setPurchaseOrder(null); }}
          onSuccess={mutateListings}
        />
      )}
      <ListingDialog
        open={listOpen}
        onOpenChange={setListOpen}
        assetContract={contract}
        tokenId={tokenId}
        tokenName={tokenName}
        tokenImage={tokenImage}
        tokenStandard={tokenStandard}
        onSuccess={mutateListings}
      />
      <OfferDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        assetContract={contract}
        tokenId={tokenId}
        tokenName={tokenName}
        tokenImage={tokenImage}
        tokenStandard={tokenStandard}
      />
      <CancelOrderDialog
        order={orderToCancel}
        open={cancelOpen}
        onOpenChange={(v) => { setCancelOpen(v); if (!v) setOrderToCancel(null); }}
        onSuccess={mutateListings}
      />
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        contractAddress={contract}
        tokenId={tokenId}
        tokenName={tokenName}
        tokenImage={tokenImage}
        tokenStandard={tokenStandard === "ERC1155" ? "ERC1155" : "ERC721"}
        hasActiveListing={hasActiveListing}
        onSuccess={mutateListings}
      />
    </>
  );
}
