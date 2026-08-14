"use client";

import { CoinCard as UICoinCard, CoinRow as UICoinRow, CoinCardSkeleton, type CoinCollectionLike } from "@medialane/ui";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { coinHref as buildCoinHref } from "@/lib/routes";

function useDappCoinPrice(collection: CoinCollectionLike) {
  const { price, isLoading } = useCoinPrice(collection.contractAddress);
  return { price, isLoading };
}

const coinHref = (c: CoinCollectionLike) => buildCoinHref("STARKNET", c.contractAddress);

export function CoinCard({ collection, href }: { collection: CoinCollectionLike; href?: string }) {
  return <UICoinCard collection={collection} usePrice={useDappCoinPrice} href={href ?? coinHref(collection)} />;
}

export function CoinRow({ collection, href }: { collection: CoinCollectionLike; href?: string }) {
  return <UICoinRow collection={collection} usePrice={useDappCoinPrice} href={href ?? coinHref(collection)} />;
}

export { CoinCardSkeleton };
