"use client";

import { useCallback, useState } from "react";
import type { ApiOrder } from "@medialane/sdk";
import type { AssetMarketActions, AssetMarketContext } from "@medialane/ui";
import { useMarketplace } from "@/hooks/use-marketplace";
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

export function useAssetMarketActions(context: AssetMarketContext): AssetMarketActions {
  const dialogs = useAssetMarketplaceDialogState();
  const { acceptOffer, isProcessing } = useMarketplace();
  const { contract, tokenId, mutateListings } = context;

  return {
    isProcessing,
    buy: dialogs.setPurchaseOrder,
    list: () => dialogs.setListOpen(true),
    offer: () => dialogs.setOfferOpen(true),
    transfer: () => dialogs.setTransferOpen(true),
    cancel: dialogs.handleCancelClick,
    acceptBid: async (order: ApiOrder) => {
      await acceptOffer(order.orderHash, contract, tokenId, order.consideration.itemType);
      mutateListings();
    },
    dialogs: (
      <AssetMarketplaceDialogs
        contract={contract}
        tokenId={tokenId}
        tokenName={context.tokenName}
        tokenImage={context.tokenImage}
        tokenStandard={context.tokenStandard}
        hasActiveListing={context.activeListings.length > 0}
        mutateListings={mutateListings}
        dialogs={dialogs}
      />
    ),
  };
}
