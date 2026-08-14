"use client";

import { useCallback, useState } from "react";
import type { ApiOrder } from "@medialane/sdk";
import { PurchaseDialog } from "@/components/marketplace/purchase-dialog";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { OfferDialog } from "@/components/marketplace/offer-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { CancelOrderDialog } from "@/components/marketplace/cancel-order-dialog";

type TokenStandard = "ERC721" | "ERC1155" | "UNKNOWN";

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

  tokenImage?: string | null;
  tokenStandard?: TokenStandard;
  hasActiveListing: boolean;
  mutateListings: () => void;
  dialogs: AssetMarketplaceDialogState;
}

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

  const handleSuccess = useCallback(() => {
    mutateListings();
    setTimeout(mutateListings, 8000);
  }, [mutateListings]);

  return (
    <>
      {purchaseOrder && (
        <PurchaseDialog
          order={purchaseOrder}
          open
          onOpenChange={(v) => { if (!v) setPurchaseOrder(null); }}
          onSuccess={handleSuccess}
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
        onSuccess={handleSuccess}
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
        onSuccess={handleSuccess}
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
        onSuccess={handleSuccess}
      />
    </>
  );
}
