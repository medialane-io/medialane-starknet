"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { CoinsExplorer as UICoinsExplorer, GradientButton, Button, coinServiceIds, type CoinFilter, type CoinSort } from "@medialane/ui";
import { useCoins as useCoinsData } from "@/hooks/use-coins";
import { useCoinPriceAdapter } from "./use-coin-price-adapter";
import { usePriceMap } from "@/hooks/use-coin-price";
import { coinHref as buildCoinHref } from "@/lib/routes";

function useCoins({ filter, sort }: { filter: CoinFilter; sort: CoinSort }) {
  const service = filter === "all" ? undefined : coinServiceIds(filter)[0];
  const { coins, isLoading, meta } = useCoinsData({ service, sort });

  return { collections: coins, isLoading, counts: meta?.counts };
}

export function CoinsExplorer({ heading = true }: { heading?: boolean }) {
  const router = useRouter();

  return (
    <UICoinsExplorer
      useCoins={useCoins}
      usePrice={useCoinPriceAdapter}
      usePriceMap={usePriceMap}
      coinHref={(c) => buildCoinHref("STARKNET", c.contractAddress)}
      heading={heading}
      action={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/launchpad/memecoin">Claim a coin</Link>
          </Button>
          <GradientButton
            wrapperClassName="w-auto shrink-0"
            onClick={() => router.push("/launchpad/coin/create")}
          >
            Launch a coin
          </GradientButton>
        </div>
      }
    />
  );
}
