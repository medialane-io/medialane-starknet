"use client";

import { CoinsExplorer as UICoinsExplorer, coinServiceIds, type CoinFilter, type CoinSort } from "@medialane/ui";
import { useCoins as useCoinsData } from "@/hooks/use-coins";
import { useCoinPriceAdapter } from "./use-coin-price-adapter";
import { coinHref as buildCoinHref } from "@/lib/routes";

function useCoins({ filter }: { filter: CoinFilter; sort: CoinSort }) {

  const service = filter === "all" ? undefined : coinServiceIds(filter)[0];
  const { coins, isLoading, meta } = useCoinsData({ service });

  return { collections: coins, isLoading, counts: meta?.counts };
}

export function CoinsExplorer({ heading = true }: { heading?: boolean }) {
  return (
    <UICoinsExplorer
      useCoins={useCoins}
      usePrice={useCoinPriceAdapter}
      coinHref={(c) => buildCoinHref("STARKNET", c.contractAddress)}
      heading={heading}
    />
  );
}
