"use client";

import { CoinsExplorer as UICoinsExplorer, type CoinFilter, type CoinSort } from "@medialane/ui";
import { useCoins as useCoinsData } from "@/hooks/use-coins";
import { useCoinPriceAdapter } from "./use-coin-price-adapter";
import { coinHref as buildCoinHref } from "@/lib/routes";

function useCoins({ filter }: { filter: CoinFilter; sort: CoinSort }) {

  const service = filter === "creator" ? "creator-coin" : filter === "memecoin" ? "external-erc20" : undefined;
  const { coins, isLoading } = useCoinsData({ service });

  const collections = coins.map((c) => ({
    ...c,
    totalSupply: c.totalSupply != null ? Number(c.totalSupply) : null,
  }));
  return { collections, isLoading };
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
