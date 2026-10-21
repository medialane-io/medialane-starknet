"use client";

import { useState } from "react";
import type { PortfolioAssetActions, PortfolioOrderActions } from "@medialane/ui";
import type { ApiOrder, ApiToken } from "@medialane/sdk";
import { useMarketplace } from "@/hooks/use-marketplace";
import { AcceptOfferDialog } from "@/components/marketplace/accept-offer-dialog";
import { CounterOfferDialog } from "@/components/marketplace/counter-offer-dialog";
import { ListingDialog } from "@/components/marketplace/listing-dialog";
import { TransferDialog } from "@/components/marketplace/transfer-dialog";
import { SUPPORTED_TOKENS } from "@/lib/constants";
import { orderTotal } from "@/lib/checkout";
import { resolveImage, formatDisplayPrice } from "@/lib/utils";

type Context = { refresh: () => void };

export function useListingActions({ refresh }: Context): PortfolioOrderActions {
  const { cancelOrder, isProcessing } = useMarketplace();
  return {
    isProcessing,
    cancel: async (order) => {
      await cancelOrder(order.orderHash, order.offer.itemType, "listing");
      refresh();
    },
  };
}

export function useOfferActions({ refresh }: Context): PortfolioOrderActions {
  const { cancelOrder, isProcessing } = useMarketplace();
  return {
    isProcessing,
    cancel: async (order) => {
      await cancelOrder(order.orderHash, order.consideration.itemType, "offer");
      refresh();
    },
  };
}

export function useReceivedOfferActions({ refresh }: Context): PortfolioOrderActions {
  const { isProcessing } = useMarketplace();
  const [counterOrder, setCounterOrder] = useState<ApiOrder | null>(null);
  const [acceptOrder, setAcceptOrder] = useState<ApiOrder | null>(null);
  const token = counterOrder ? SUPPORTED_TOKENS.find((t) => t.symbol === counterOrder.price.currency) : undefined;
  return {
    isProcessing,
    accept: setAcceptOrder,
    counter: setCounterOrder,
    dialogs: (
      <>
        <AcceptOfferDialog
          order={acceptOrder}
          open={!!acceptOrder}
          onOpenChange={(v) => { if (!v) setAcceptOrder(null); }}
          onSuccess={refresh}
        />
        {counterOrder && (
          <CounterOfferDialog
            open={!!counterOrder}
            onOpenChange={(v) => { if (!v) setCounterOrder(null); }}
            nftContract={counterOrder.nftContract ?? ""}
            tokenId={counterOrder.nftTokenId ?? ""}
            originalOrderHash={counterOrder.orderHash}
            tokenName={counterOrder.token?.name ?? undefined}
            tokenImage={resolveImage(counterOrder.token?.image)}
            currentBid={`${formatDisplayPrice(counterOrder.price.formatted)} ${counterOrder.price.currency}`}
            currencySymbol={counterOrder.price.currency ?? ""}
            currencyDecimals={token?.decimals ?? 18}
          />
        )}
      </>
    ),
  };
}

export function useCounterOfferActions({ refresh }: Context): PortfolioOrderActions {
  const { checkoutCart, isProcessing } = useMarketplace();
  return {
    isProcessing,
    accept: async (counter) => {
      await checkoutCart([{
        orderHash: counter.orderHash,
        considerationToken: counter.consideration?.token ?? "",
        considerationAmount: orderTotal(counter, 1).toString(),
        isERC1155: counter.offer?.itemType === "ERC1155",
        offerIdentifier: counter.token?.name ?? `#${counter.nftTokenId}`,
      }]);
      refresh();
    },
  };
}

export function useAssetActions({ refresh }: Context): PortfolioAssetActions {
  const { cancelOrder } = useMarketplace();
  const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [transferToken, setTransferToken] = useState<ApiToken | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const handleSuccess = refresh;

  return {
    list: (token) => { setSelectedToken(token); setListOpen(true); },
    transfer: (token) => { setTransferToken(token); setTransferOpen(true); },
    cancel: async (token) => {
      const activeOrder = token.activeOrders?.[0];
      if (!activeOrder) return;
      await cancelOrder(
        activeOrder.orderHash,
        activeOrder.offer.itemType,
        activeOrder.offer.itemType === "ERC20" ? "offer" : "listing"
      );
      handleSuccess();
    },
    dialogs: (
      <>
        {selectedToken && (
          <ListingDialog
            open={listOpen}
            onOpenChange={(v) => {
              setListOpen(v);
              if (!v) setSelectedToken(null);
            }}
            assetContract={selectedToken.contractAddress}
            tokenId={selectedToken.tokenId}
            tokenName={selectedToken.metadata?.name ?? undefined}
            tokenImage={selectedToken.metadata?.image ?? null}
            tokenStandard={selectedToken.standard}
            onSuccess={handleSuccess}
          />
        )}
        {transferToken && (
          <TransferDialog
            open={transferOpen}
            onOpenChange={(v) => {
              setTransferOpen(v);
              if (!v) setTransferToken(null);
            }}
            contractAddress={transferToken.contractAddress}
            tokenId={transferToken.tokenId}
            tokenName={transferToken.metadata?.name ?? undefined}
            tokenImage={transferToken.metadata?.image ?? null}
            tokenStandard={transferToken.standard === "ERC1155" ? "ERC1155" : "ERC721"}
            hasActiveListing={!!transferToken.activeOrders?.[0]}
            onSuccess={handleSuccess}
          />
        )}
      </>
    ),
  };
}
