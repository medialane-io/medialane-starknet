"use client";

/**
 * CoinCard / CoinRow — dapp bindings of the shared @medialane/ui coin tiles.
 * The ui components are chain-agnostic; the dapp injects its Ekubo price read
 * and the internal /coins href (this app IS the Starknet trading surface).
 */

import type { ApiCollection } from "@medialane/sdk";
import { CoinCard as UICoinCard, CoinRow as UICoinRow, CoinCardSkeleton, type CoinCollectionLike } from "@medialane/ui";
import { useCoinPrice } from "@/hooks/use-coin-price";

/** dapp price adapter: live Ekubo spot price for a Starknet coin. */
function useDappCoinPrice(collection: CoinCollectionLike) {
  const { price, isLoading } = useCoinPrice(collection.contractAddress);
  return { price, isLoading };
}

const coinHref = (c: CoinCollectionLike) => `/coins/${c.contractAddress}`;

export function CoinCard({ collection }: { collection: ApiCollection }) {
  return <UICoinCard collection={collection} usePrice={useDappCoinPrice} href={coinHref(collection)} />;
}

export function CoinRow({ collection }: { collection: ApiCollection }) {
  return <UICoinRow collection={collection} usePrice={useDappCoinPrice} href={coinHref(collection)} />;
}

export { CoinCardSkeleton };
