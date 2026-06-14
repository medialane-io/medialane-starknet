"use client";

/**
 * CoinsExplorer — dapp binding of the shared @medialane/ui explorer.
 * Injects the dapp's collections data source (useCollections + standard filter)
 * and Ekubo price read; links to the internal /coins page (Starknet trading).
 */

import { CoinsExplorer as UICoinsExplorer, type CoinFilter, type CoinSort, type CoinCollectionLike } from "@medialane/ui";
import { useCollections } from "@/hooks/use-collections";
import { useCoinPrice } from "@/hooks/use-coin-price";

function usePrice(collection: CoinCollectionLike) {
  const { price, isLoading } = useCoinPrice(collection.contractAddress);
  return { price, isLoading };
}

function useCoins({ filter, sort }: { filter: CoinFilter; sort: CoinSort }) {
  // "all" → both coin services via standard=ERC20; per-kind → service filter.
  const service = filter === "creator" ? "creator-coin" : filter === "memecoin" ? "external-erc20" : undefined;
  const standard = filter === "all" ? "ERC20" : undefined;
  const { collections, isLoading } = useCollections(1, 24, undefined, sort, false, service, standard);
  return { collections: collections ?? [], isLoading };
}

export function CoinsExplorer({ heading = true }: { heading?: boolean }) {
  return (
    <UICoinsExplorer
      useCoins={useCoins}
      usePrice={usePrice}
      coinHref={(c) => `/coins/${c.contractAddress}`}
      heading={heading}
    />
  );
}
