"use client";

/**
 * CoinsExplorer — dapp binding of the shared @medialane/ui explorer.
 * Injects the dapp's coins data source (useCoins → /v1/coins) and the Ekubo
 * price read; links to the internal /coins page (Starknet trading).
 */

import { CoinsExplorer as UICoinsExplorer, type CoinFilter, type CoinSort, type CoinCollectionLike } from "@medialane/ui";
import { useCoins as useCoinsData } from "@/hooks/use-coins";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { coinHref as buildCoinHref } from "@/lib/routes";

function usePrice(coin: CoinCollectionLike) {
  const { price, isLoading } = useCoinPrice(coin.contractAddress);
  return { price, isLoading };
}

function useCoins({ filter }: { filter: CoinFilter; sort: CoinSort }) {
  // Coins live in the Coin model now (/v1/coins). "all" → no service filter;
  // per-kind → the coin service. Sorting is handled by the explorer UI.
  const service = filter === "creator" ? "creator-coin" : filter === "memecoin" ? "external-erc20" : undefined;
  const { coins, isLoading } = useCoinsData({ service });
  // ApiCoin.totalSupply is a fungible decimal string; the UI's CoinCollectionLike
  // (and FDV math) expects a number — coerce so coins satisfy it structurally.
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
      usePrice={usePrice}
      coinHref={(c) => buildCoinHref("STARKNET", c.contractAddress)}
      heading={heading}
    />
  );
}
