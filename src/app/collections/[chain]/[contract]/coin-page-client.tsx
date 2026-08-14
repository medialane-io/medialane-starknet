"use client";

import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Settings } from "lucide-react";
import { getService, normalizeAddress } from "@medialane/sdk";
import type { ApiCoin } from "@medialane/sdk";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { useCoinSupply } from "@/hooks/use-coin-supply";
import { useWallet } from "@/hooks/use-wallet";
import { Skeleton } from "@/components/ui/skeleton";
import { AddressDisplay } from "@/components/shared/address-display";
import { ShareButton } from "@/components/shared/share-button";
import { CreatorChip } from "@/components/shared/creator-chip";
import { ipfsToHttp, cn } from "@/lib/utils";
import { EXPLORER_URL } from "@/lib/constants";

function formatPrice(n: number): string {
  if (n === 0) return "0";
  if (n < 0.000001) return n.toExponential(2);
  if (n < 1) return n.toPrecision(3);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function CoinPageClient({ coin }: { coin: ApiCoin }) {
  const contract = coin.contractAddress;
  const { price, isLoading: priceLoading } = useCoinPrice(contract);

  const bannerSource = coin.image;
  const bannerUrl = bannerSource ? ipfsToHttp(bannerSource) : null;

  const serviceLabel = getService(coin.service)?.displayName ?? "Creator Coin";

  const { supply } = useCoinSupply(contract, coin.decimals ?? 18);
  const marketCap = price && supply != null && supply > 0 ? price.quotePerCoin * supply : null;

  const stats: { label: string; value: string }[] = [];
  if (supply != null && supply > 0) stats.push({ label: "Supply", value: formatCompact(supply) });
  if (marketCap != null) stats.push({ label: "Market Cap", value: `${formatCompact(marketCap)} ${price?.quoteSymbol ?? ""}`.trim() });
  if (price?.quoteSymbol) stats.push({ label: "Priced in", value: price.quoteSymbol });

  const { address } = useWallet();
  const isCreator =
    !!address && !!coin.creator && normalizeAddress("STARKNET", address) === normalizeAddress("STARKNET", coin.creator);

  return (
    <div className="relative z-0 min-h-screen">

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {bannerUrl && (
          <Image
            src={bannerUrl}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="absolute inset-0 w-full h-full object-cover opacity-30 scale-110"
            style={{ filter: "blur(60px) saturate(1.5)" }}
            unoptimized
          />
        )}
      </div>

      <div className="mx-auto px-4 pt-20 pb-12 max-w-3xl">
        <div className="grid grid-cols-1">

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <CoinAvatar url={bannerUrl} symbol={coin.symbol} />
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight truncate">
                  {coin.name ?? "Creator Coin"}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {coin.symbol && (
                    <span className="text-xs bg-muted/60 border border-border/60 rounded-full px-2.5 py-0.5">
                      {coin.symbol}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{serviceLabel}</span>
                </div>
                {coin.creator && <CreatorChip address={coin.creator} className="mt-2" />}
                {isCreator && (
                  <Link
                    href={`/portfolio/coins/${contract}/settings`}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Settings className="h-3.5 w-3.5" /> Manage coin
                  </Link>
                )}
              </div>
            </div>

            <Panel className="p-5">
              <p className="text-[11px] text-muted-foreground mb-1.5">
                Price
              </p>
              {priceLoading ? (
                <Skeleton className="h-9 w-40" />
              ) : price ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-brand-orange">
                    {formatPrice(price.quotePerCoin)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {price.quoteSymbol ?? "quote"} / {coin.symbol ?? "coin"}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not trading yet — no market price available.
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Live market price · updates every 30s
              </p>
            </Panel>

            {stats.length > 0 && (
              <div className={cn("grid gap-3", stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                {stats.map((s) => <StatCell key={s.label} label={s.label} value={s.value} />)}
              </div>
            )}

            {coin.description && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {coin.description}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <AddressDisplay address={contract ?? ""} chars={6} className="text-xs text-muted-foreground/70" />
              <a
                href={`${EXPLORER_URL}/contract/${contract}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground/60 hover:text-foreground transition-colors"
                title="View on explorer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <ShareButton title={coin.name ?? "Creator Coin"} variant="ghost" size="icon" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CoinPageSkeleton() {
  return (
    <div className="mx-auto px-4 pt-20 pb-12 max-w-3xl">
      <div className="grid grid-cols-1">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoinAvatar({ url, symbol }: { url: string | null; symbol?: string | null }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={symbol ?? "coin"}
        width={64}
        height={64}
        unoptimized
        className="h-16 w-16 rounded-full object-cover border border-border/60 shrink-0"
      />
    );
  }
  return (
    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center shrink-0">
      <span className="text-xl font-bold text-white">{(symbol ?? "?").slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm", className)}>
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-blue/12 via-brand-purple/8 to-transparent" />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-bold tabular-nums truncate">{value}</p>
    </Panel>
  );
}

function DetailRow({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums text-right", valueClassName)}>{value}</span>
    </div>
  );
}
