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
import { ArrowDownUp, Loader2, Lock, ShieldCheck, ExternalLink, Check, Info, Zap, ChevronDown } from "lucide-react";
import { getService } from "@medialane/sdk";
import type { ApiCollection } from "@medialane/sdk";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { useCoinBalance } from "@/hooks/use-coin-balance";
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

const SLIPPAGE_PRESETS = [
  { value: 0.005, label: "0.5%" },
  { value: 0.01, label: "1%" },
] as const;

function formatPrice(n: number): string {
  if (n === 0) return "0";
  if (n < 0.000001) return n.toExponential(2);
  if (n < 1) return n.toPrecision(3);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatCompact(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function CoinPageClient({ collection }: { collection: ApiCollection }) {
  const contract = collection.contractAddress;
  const { price, isLoading: priceLoading } = useCoinPrice(contract);

  // Studio-uploaded feature image lives on the profile (platform layer);
  // fall back to the indexed collection image.
  const bannerSource = collection.profile?.image ?? collection.image;
  const bannerUrl = bannerSource ? ipfsToHttp(bannerSource) : null;
  const { imgRef, dynamicTheme } = useDominantColor(bannerUrl);

  const serviceLabel = getService(collection.service)?.displayName ?? "Creator Coin";
  const isExternal = collection.service === "external-erc20";
  const [showWhat, setShowWhat] = useState(false);

  // Market cap = live spot price × circulating supply, in the quote token.
  const marketCap =
    price && collection.totalSupply != null && Number(collection.totalSupply) > 0
      ? price.quotePerCoin * Number(collection.totalSupply)
      : null;
  const isFresh = collection.holderCount === 0;
  const explorerUrl = `${EXPLORER_URL}/contract/${contract}`;

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCell label="Holders" value={collection.holderCount != null ? String(collection.holderCount) : "—"} />
              <StatCell
                label="Supply"
                value={collection.totalSupply != null ? Number(collection.totalSupply).toLocaleString() : "—"}
              />
              <StatCell
                label="Market Cap"
                value={marketCap != null ? `${formatCompact(marketCap)} ${price?.quoteSymbol ?? ""}`.trim() : "—"}
              />
              <StatCell label="Pair" value={price?.quoteSymbol ?? "—"} />
            </div>

            {isFresh && (
              <p className="text-xs text-muted-foreground">
                Just launched — be the first to buy {collection.symbol ?? "this coin"}.
              </p>
            )}

            {/* Description */}
            {collection.description && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {collection.description}
              </p>
            )}

            {/* What is a Creator Coin? + plain-language, verifiable guarantees */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
              <button
                onClick={() => setShowWhat((v) => !v)}
                className="flex w-full items-center gap-1.5 text-sm font-medium"
              >
                <Info className="h-4 w-4 text-muted-foreground shrink-0" />
                What is a Creator Coin?
                <ChevronDown className={cn("h-4 w-4 ml-auto text-muted-foreground transition-transform", showWhat && "rotate-180")} />
              </button>
              {showWhat && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A Creator Coin is a token launched by a creator and traded on a public
                  Ekubo pool. You buy and hold it in your own wallet — Medialane never holds
                  it for you, and the price moves with the open market, not with us.
                </p>
              )}

              {!isExternal && (
                <div className="space-y-2 border-t border-border/40 pt-3">
                  <TrustRow icon={Lock} text="The trading funds sit in a public pool the creator can't withdraw." />
                  <TrustRow icon={ShieldCheck} text="Fixed supply — no one can create more of this coin after launch." />
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Verify on explorer <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

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
  const { address, isConnected } = useWallet();
  const swap = useSwap();
  const coinBal = useCoinBalance(coinAddress, address);
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const coinToken: SwapToken = useMemo(
    () => ({ symbol: coinSymbol, name: coinName, address: coinAddress, decimals: 18, color: coinColor }),
    [coinSymbol, coinName, coinAddress, coinColor]
  );
  const [quoteToken, setQuoteToken] = useState<SwapToken>(
    () => QUOTE_TOKENS.find((t) => t.symbol === "STRK") ?? QUOTE_TOKENS[0]
  );

  // Preset: pay STRK → receive the coin. Runs once.
  useEffect(() => {
    if (initialized) return;
    swap.setSellToken(quoteToken);
    swap.setBuyToken(coinToken);
    setInitialized(true);
  }, [initialized, coinToken, quoteToken, swap]);

  // Buy = pay quote → receive coin; Sell = pay coin → receive quote. A flip is
  // exactly the buy↔sell switch, so reuse the hook's flipTokens.
  const toggleMode = () => {
    setMode((m) => (m === "buy" ? "sell" : "buy"));
    swap.flipTokens();
    setLastHash(null);
  };

  const changeQuoteToken = (symbol: string) => {
    const t = QUOTE_TOKENS.find((x) => x.symbol === symbol);
    if (!t) return;
    setQuoteToken(t);
    if (mode === "buy") swap.setSellToken(t);
    else swap.setBuyToken(t);
  };

  const isBuy = mode === "buy";
  const fromSymbol = isBuy ? quoteToken.symbol : coinSymbol;
  const toSymbol = isBuy ? coinSymbol : quoteToken.symbol;
  const fromBalance = isBuy ? swap.sellBalance : coinBal.formatted;

  const coinInsufficient =
    !isBuy &&
    fromBalance != null &&
    swap.sellAmount !== "" &&
    parseFloat(swap.sellAmount || "0") > parseFloat(fromBalance || "0");

  const noRoute = swap.quoteError != null && swap.sellAmount !== "";
  const hasQuote = !!swap.buyAmount && !noRoute;
  const insufficient = swap.insufficientBalance || coinInsufficient;

  const handleSwap = async () => {
    const h = await swap.executeSwap();
    if (h) {
      setLastHash(h);
      coinBal.mutate();
    }
  };

  const quoteSelect = (
    <select
      value={quoteToken.symbol}
      onChange={(e) => changeQuoteToken(e.target.value)}
      className="shrink-0 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm font-semibold outline-none"
    >
      {QUOTE_TOKENS.map((t) => (
        <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
      ))}
    </select>
  );
  const coinChip = (
    <span className="shrink-0 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm font-semibold">
      {coinSymbol}
    </span>
  );

  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 space-y-3">
      {/* Buy / Sell toggle */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
          {(["buy", "sell"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { if (m !== mode) toggleMode(); }}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              {m === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground">via Ekubo</span>
      </div>

      {/* Pay (from) */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">You pay</span>
          {fromBalance != null && (
            <button
              onClick={() => swap.setSellAmount(fromBalance)}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Balance: {fromBalance} · <span className="font-medium">Max</span>
            </button>
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
          {isBuy ? quoteSelect : coinChip}
        </div>
      </div>

      {/* Flip buy / sell */}
      <div className="flex justify-center -my-1">
        <button
          onClick={toggleMode}
          title="Switch buy / sell"
          className="rounded-full border border-border/60 bg-card p-1.5 transition-colors hover:bg-muted"
        >
          <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Receive (to) */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
        <span className="text-[11px] text-muted-foreground">You receive (estimated)</span>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-2xl font-semibold tabular-nums truncate">
            {swap.isFetchingQuote ? "…" : swap.buyAmount || "0.0"}
          </span>
          {isBuy ? coinChip : quoteSelect}
        </div>
      </div>

      {/* Trade details */}
      {hasQuote && (
        <div className="space-y-1.5 rounded-xl border border-border/40 bg-muted/10 p-3 text-[11px]">
          {swap.exchangeRate && <DetailRow label="Rate" value={swap.exchangeRate} />}
          {swap.priceImpact && <DetailRow label="Price impact" value={swap.priceImpact} />}
          {swap.minBuyAmount && <DetailRow label="Min received" value={`${swap.minBuyAmount} ${toSymbol}`} />}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Max slippage</span>
            <div className="inline-flex gap-1">
              {SLIPPAGE_PRESETS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => swap.setSlippage(s.value)}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[10px] transition-colors",
                    Math.abs(swap.slippage - s.value) < 1e-9
                      ? "border-primary text-foreground"
                      : "border-border/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 pt-0.5 text-emerald-500">
            <Zap className="h-3 w-3" /> <span>Gas sponsored by Medialane</span>
          </div>
        </div>
      )}

      {noRoute && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500 text-center">
          No router quote yet — liquidity is live on Ekubo but not yet indexed by AVNU.
          You can trade directly on Ekubo in the meantime.
        </p>
      )}

      {insufficient && (
        <p className="text-[11px] text-destructive text-center">Insufficient {fromSymbol} balance</p>
      )}

      {lastHash ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Trade submitted
          </p>
          <div className="flex items-center justify-center gap-3 text-[11px]">
            <a
              href={`${EXPLORER_URL}/tx/${lastHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              View on explorer <ExternalLink className="h-3 w-3" />
            </a>
            <Link href="/portfolio" className="text-muted-foreground transition-colors hover:text-foreground">
              Portfolio
            </Link>
            <button onClick={() => setLastHash(null)} className="text-muted-foreground transition-colors hover:text-foreground">
              Trade again
            </button>
          </div>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={!isConnected || !swap.canSwap || coinInsufficient}
          onClick={handleSwap}
        >
          {swap.isExecuting ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {isBuy ? "Buying" : "Selling"}…</>
          ) : !isConnected ? (
            "Connect wallet to trade"
          ) : noRoute ? (
            "No route available"
          ) : (
            `${isBuy ? "Buy" : "Sell"} ${coinSymbol}`
          )}
        </Button>
      )}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-right">{value}</span>
    </div>
  );
}
