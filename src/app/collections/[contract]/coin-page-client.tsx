"use client";

/**
 * CoinPageClient — Creator Coin detail view (uiVariant === "coin").
 *
 * Rendered by the collection dispatcher for ERC-20 Creator Coins (and external
 * ERC-20s). A coin has no per-token grid/listings — it has a live spot price
 * (read straight from its Ekubo pool via the SDK) and an embedded swap that
 * settles on Ekubo through AVNU's router. Read-side first: the price renders the
 * moment the page loads, independent of whether AVNU has indexed the pool yet.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, Loader2, Lock, ShieldCheck, ExternalLink } from "lucide-react";
import { getService } from "@medialane/sdk";
import type { ApiCollection } from "@medialane/sdk";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { useSwap, SWAP_TOKENS, type SwapToken } from "@/hooks/use-swap";
import { useDominantColor } from "@/hooks/use-dominant-color";
import { useWallet } from "@/hooks/use-wallet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddressDisplay } from "@/components/shared/address-display";
import { ShareButton } from "@/components/shared/share-button";
import { ipfsToHttp, cn } from "@/lib/utils";
import { EXPLORER_URL } from "@/lib/constants";

const QUOTE_TOKENS = SWAP_TOKENS.filter((t) => t.symbol !== "WBTC");

function formatPrice(n: number): string {
  if (n === 0) return "0";
  if (n < 0.000001) return n.toExponential(2);
  if (n < 1) return n.toPrecision(3);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function CoinPageClient({ collection }: { collection: ApiCollection }) {
  const contract = collection.contractAddress;
  const { price, isLoading: priceLoading } = useCoinPrice(contract);

  const bannerUrl = collection.image ? ipfsToHttp(collection.image) : null;
  const { imgRef, dynamicTheme } = useDominantColor(bannerUrl);

  const serviceLabel = getService(collection.service)?.displayName ?? "Creator Coin";
  const isExternal = collection.service === "external-erc20";

  return (
    <div
      style={dynamicTheme ? (dynamicTheme as React.CSSProperties) : {}}
      className="relative z-0 min-h-screen"
    >
      {/* Atmospheric blur background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {bannerUrl && (
          <Image
            src={bannerUrl}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110"
            style={{ filter: "blur(60px) saturate(1.5)" }}
            unoptimized
          />
        )}
        <div
          className="absolute inset-0"
          style={{ background: dynamicTheme ? `hsl(var(--dynamic-primary) / 0.08)` : "transparent" }}
        />
      </div>

      {bannerUrl && (
        <Image
          ref={imgRef}
          src={bannerUrl}
          crossOrigin="anonymous"
          aria-hidden
          alt=""
          width={1}
          height={1}
          unoptimized
          style={{ display: "none" }}
        />
      )}

      <div className="container mx-auto px-4 pt-20 pb-12 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,380px)] gap-8">
          {/* ── Left: identity + price + trust ── */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <CoinAvatar url={bannerUrl} symbol={collection.symbol} />
              <div className="min-w-0">
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight truncate">
                  {collection.name ?? "Creator Coin"}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {collection.symbol && (
                    <span className="font-mono text-xs bg-muted/60 border border-border/60 rounded-full px-2.5 py-0.5">
                      {collection.symbol}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{serviceLabel}</span>
                </div>
              </div>
            </div>

            {/* Live price */}
            <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
                Price
              </p>
              {priceLoading ? (
                <Skeleton className="h-9 w-40" />
              ) : price ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">
                    {formatPrice(price.quotePerCoin)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {price.quoteSymbol ?? "quote"} / {collection.symbol ?? "coin"}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not yet launched on Ekubo — no price available.
                </p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Live spot price from the Ekubo pool. Refreshes every 30s.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCell label="Holders" value={collection.holderCount != null ? String(collection.holderCount) : "—"} />
              <StatCell
                label="Supply"
                value={collection.totalSupply != null ? Number(collection.totalSupply).toLocaleString() : "—"}
              />
              <StatCell label="Pair" value={price?.quoteSymbol ?? "—"} />
            </div>

            {/* Description */}
            {collection.description && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {collection.description}
              </p>
            )}

            {/* Trust strip — the fork's guarantees */}
            {!isExternal && (
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
                <TrustRow icon={Lock} text="Liquidity permanently locked in Ekubo" />
                <TrustRow icon={ShieldCheck} text="Ownership renounced at launch — fixed supply, no mint" />
              </div>
            )}

            {/* Meta */}
            <div className="flex items-center gap-3 pt-1">
              {collection.owner && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>by</span>
                  <Link href={`/creator/${collection.owner}`} className="hover:underline underline-offset-2">
                    <AddressDisplay address={collection.owner} chars={6} showCopy={false} className="font-medium text-foreground" />
                  </Link>
                </div>
              )}
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
              <ShareButton title={collection.name ?? "Creator Coin"} variant="ghost" size="icon" />
            </div>
          </div>

          {/* ── Right: embedded swap ── */}
          <div className="lg:sticky lg:top-20 h-fit">
            <CoinSwapCard
              coinAddress={contract}
              coinSymbol={collection.symbol ?? "COIN"}
              coinName={collection.name ?? "Creator Coin"}
              coinColor={dynamicTheme ? "var(--dynamic-primary)" : "#8b5cf6"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Embedded swap
// ---------------------------------------------------------------------------

function CoinSwapCard({
  coinAddress,
  coinSymbol,
  coinName,
  coinColor,
}: {
  coinAddress: string;
  coinSymbol: string;
  coinName: string;
  coinColor: string;
}) {
  const { isConnected } = useWallet();
  const swap = useSwap();
  const [initialized, setInitialized] = useState(false);

  const coinToken: SwapToken = useMemo(
    () => ({ symbol: coinSymbol, name: coinName, address: coinAddress, decimals: 18, color: coinColor }),
    [coinSymbol, coinName, coinAddress, coinColor]
  );

  // Preset: pay STRK → receive the coin. Runs once.
  useEffect(() => {
    if (initialized) return;
    swap.setSellToken(SWAP_TOKENS.find((t) => t.symbol === "STRK") ?? SWAP_TOKENS[0]);
    swap.setBuyToken(coinToken);
    setInitialized(true);
  }, [initialized, coinToken, swap]);

  const noRoute = swap.quoteError != null && swap.sellAmount !== "";

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Buy {coinSymbol}</h2>
        <span className="text-[11px] text-muted-foreground">via Ekubo</span>
      </div>

      {/* Pay */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">You pay</span>
          {swap.sellBalance != null && (
            <span className="text-[11px] text-muted-foreground">Balance: {swap.sellBalance}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            placeholder="0.0"
            value={swap.sellAmount}
            onChange={(e) => swap.setSellAmount(e.target.value)}
            className="flex-1 bg-transparent text-2xl font-semibold outline-none tabular-nums min-w-0"
          />
          <select
            value={swap.sellToken.symbol}
            onChange={(e) => {
              const t = QUOTE_TOKENS.find((x) => x.symbol === e.target.value);
              if (t) swap.setSellToken(t);
            }}
            className="shrink-0 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm font-semibold outline-none"
          >
            {QUOTE_TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-center -my-1">
        <div className="rounded-full border border-border/60 bg-card p-1.5">
          <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>

      {/* Receive */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
        <span className="text-[11px] text-muted-foreground">You receive (estimated)</span>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-2xl font-semibold tabular-nums truncate">
            {swap.isFetchingQuote ? "…" : swap.buyAmount || "0.0"}
          </span>
          <span className="shrink-0 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm font-semibold">
            {coinSymbol}
          </span>
        </div>
      </div>

      {swap.exchangeRate && (
        <p className="text-[11px] text-muted-foreground text-center">{swap.exchangeRate}</p>
      )}

      {noRoute && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500 text-center">
          No router quote yet — liquidity is live on Ekubo but not yet indexed by AVNU.
          You can trade directly on Ekubo in the meantime.
        </p>
      )}

      {swap.insufficientBalance && (
        <p className="text-[11px] text-destructive text-center">Insufficient {swap.sellToken.symbol} balance</p>
      )}

      <Button
        className="w-full"
        disabled={!isConnected || !swap.canSwap}
        onClick={() => swap.executeSwap()}
      >
        {swap.isExecuting ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Swapping…</>
        ) : !isConnected ? (
          "Connect wallet to buy"
        ) : noRoute ? (
          "No route available"
        ) : (
          `Buy ${coinSymbol}`
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

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
    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shrink-0">
      <span className="text-xl font-bold text-white">{(symbol ?? "?").slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-bold tabular-nums truncate">{value}</p>
    </div>
  );
}

function TrustRow({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className={cn("h-3.5 w-3.5 shrink-0 text-emerald-500")} />
      <span>{text}</span>
    </div>
  );
}
