"use client";

import { CoinRow as UICoinRow, CoinRowSkeleton, type CoinCollectionLike } from "@medialane/ui";
import { useCoinPriceAdapter } from "@/components/coins/use-coin-price-adapter";
import { coinHref as buildCoinHref } from "@/lib/routes";

const coinHref = (c: CoinCollectionLike) => buildCoinHref("STARKNET", c.contractAddress);

export function CoinRow({ collection, href }: { collection: CoinCollectionLike; href?: string }) {
  return <UICoinRow collection={collection} usePrice={useCoinPriceAdapter} href={href ?? coinHref(collection)} />;
}

export { CoinRowSkeleton };
