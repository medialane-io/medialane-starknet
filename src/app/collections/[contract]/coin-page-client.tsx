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
import { ArrowDownUp, Loader2, ShieldCheck, ExternalLink, Check, Zap, Settings } from "lucide-react";
import { getService } from "@medialane/sdk";
import type { ApiCoin, CreatorCoinPrice } from "@medialane/sdk";
import { useCoinPrice } from "@/hooks/use-coin-price";
import { useCoinBalance } from "@/hooks/use-coin-balance";
import { useCoinSupply } from "@/hooks/use-coin-supply";
import { useSwap, SWAP_TOKENS, type SwapToken } from "@/hooks/use-swap";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Skeleton } from "@/components/ui/skeleton";
import { AddressDisplay } from "@/components/shared/address-display";
import { ShareButton } from "@/components/shared/share-button";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { CreatorChip } from "@/components/shared/creator-chip";
import { ipfsToHttp, cn } from "@/lib/utils";
import { EXPLORER_URL } from "@/lib/constants";

/** A coin amount string formatted for an input (no grouping; capped precision). */
function formatAmountInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 6 });
}

/**
 * Honest, locally-computed price impact: compare the pool's live spot price to
 * what the route actually returns. Only meaningful when the user's quote token
 * is the coin's own pool pair (otherwise the trade routes cross-token and AVNU's
 * USD impact is unreliable — we hide it and lean on the guaranteed minimum).
 */
function computeImpact(
  isBuy: boolean,
  price: CreatorCoinPrice | null,
  quoteSymbol: string,
  sellAmount: string,
  buyAmount: string
): number | null {
  if (!price || price.quoteSymbol !== quoteSymbol) return null;
  const sell = parseFloat(sellAmount);
  const buy = parseFloat(buyAmount);
  if (!(sell > 0) || !(buy > 0) || !(price.quotePerCoin > 0)) return null;
  // Buy: pay `sell` quote, expect sell / price coins. Sell: give `sell` coins,
  // expect sell × price quote.
  const expected = isBuy ? sell / price.quotePerCoin : sell * price.quotePerCoin;
  if (!(expected > 0)) return null;
  const impact = ((expected - buy) / expected) * 100;
  return Math.max(0, impact); // clamp tiny-negative (stale-spot) noise to 0
}

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

export function CoinPageClient({ coin }: { coin: ApiCoin }) {
  const contract = coin.contractAddress;
  const { price, isLoading: priceLoading } = useCoinPrice(contract);

  const bannerSource = coin.image;
  const bannerUrl = bannerSource ? ipfsToHttp(bannerSource) : null;

  const serviceLabel = getService(coin.service)?.displayName ?? "Creator Coin";

  // Supply read on-chain (works for every coin, incl. external ERC-20s the
  // backend doesn't index). Market cap = live spot price × that supply.
  const { supply } = useCoinSupply(contract, coin.decimals ?? 18);
  const marketCap = price && supply != null && supply > 0 ? price.quotePerCoin * supply : null;

  // Only render stats that actually resolve — no empty placeholder boxes.
  const stats: { label: string; value: string }[] = [];
  if (supply != null && supply > 0) stats.push({ label: "Supply", value: formatCompact(supply) });
  if (marketCap != null) stats.push({ label: "Market Cap", value: `${formatCompact(marketCap)} ${price?.quoteSymbol ?? ""}`.trim() });
  if (price?.quoteSymbol) stats.push({ label: "Priced in", value: price.quoteSymbol });

  const { address } = useWallet();
  const isCreator =
    !!address && !!coin.creator && address.toLowerCase() === coin.creator.toLowerCase();

  return (
    <div className="relative z-0 min-h-screen">
      {/* Atmospheric blur background — identical settings to the standard asset
          pages' AssetAtmosphere (opacity-30, no color wash). */}
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

      <div className="mx-auto px-4 pt-20 pb-12 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,380px)] gap-8">
          {/* ── Left: identity + price + trust ── */}
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

            {/* Live price */}
            <Panel className="p-5">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">
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

            {/* Stats — only those that resolve (no empty boxes) */}
            {stats.length > 0 && (
              <div className={cn("grid gap-3", stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                {stats.map((s) => <StatCell key={s.label} label={s.label} value={s.value} />)}
              </div>
            )}

            {/* Description */}
            {coin.description && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {coin.description}
              </p>
            )}

            {/* Meta */}
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

          {/* ── Right: embedded swap ── */}
          <div className="lg:sticky lg:top-20 h-fit">
            <CoinSwapCard
              coinAddress={contract}
              coinSymbol={coin.symbol ?? "COIN"}
              coinName={coin.name ?? "Creator Coin"}
              coinColor="hsl(var(--brand-purple))"
              price={price}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Coin-shaped loading skeleton — mirrors the CoinPageClient layout so the
 * /coins/[address] route doesn't flash the NFT-collection layout while the
 * collection record loads (the dispatch can't know it's a coin until then).
 */
export function CoinPageSkeleton() {
  return (
    <div className="mx-auto px-4 pt-20 pb-12 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,380px)] gap-8">
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
        <Skeleton className="h-[28rem] w-full rounded-2xl lg:sticky lg:top-20" />
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
  price,
}: {
  coinAddress: string;
  coinSymbol: string;
  coinName: string;
  coinColor: string;
  price: CreatorCoinPrice | null;
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
  const fromBalanceNum = fromBalance != null ? parseFloat(fromBalance) : 0;

  const coinInsufficient =
    !isBuy &&
    fromBalance != null &&
    swap.sellAmount !== "" &&
    parseFloat(swap.sellAmount || "0") > fromBalanceNum;

  const noRoute = swap.quoteError != null && swap.sellAmount !== "";
  const hasQuote = !!swap.buyAmount && !noRoute;
  const insufficient = swap.insufficientBalance || coinInsufficient;

  // Honest, locally-computed price impact (see computeImpact). High impact gets a
  // friendly low-liquidity nudge instead of an alarming number.
  const impact = computeImpact(isBuy, price, quoteToken.symbol, swap.sellAmount, swap.buyAmount);
  const impactHigh = impact != null && impact > 15;

  const handleSwap = async () => {
    const h = await swap.executeSwap();
    if (h) {
      setLastHash(h);
      coinBal.mutate();
    }
  };

  const quoteBadge = (
    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm font-semibold">
      <CurrencyIcon symbol={quoteToken.symbol} size={16} /> {quoteToken.symbol}
    </span>
  );
  const coinChip = (
    <span className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-sm font-semibold">
      <span className="h-4 w-4 rounded-full" style={{ background: coinColor }} aria-hidden /> {coinSymbol}
    </span>
  );
  const quotePicker = (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
        {isBuy ? "Pay with" : "Receive in"}
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {QUOTE_TOKENS.map((t) => (
          <button
            key={t.symbol}
            onClick={() => changeQuoteToken(t.symbol)}
            className={cn(
              "inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors",
              quoteToken.symbol === t.symbol
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border/50 text-muted-foreground hover:text-foreground"
            )}
          >
            <CurrencyIcon symbol={t.symbol} size={13} /> {t.symbol}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Panel className="p-4">
      <div className="space-y-3">
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
            <span className="text-[11px] text-muted-foreground">Balance: {fromBalance}</span>
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
          {isBuy ? quoteBadge : coinChip}
        </div>
        {fromBalanceNum > 0 && (
          <div className="flex gap-1.5">
            {[
              { label: "25%", frac: 0.25 },
              { label: "50%", frac: 0.5 },
              { label: "Max", frac: 1 },
            ].map((q) => (
              <button
                key={q.label}
                onClick={() => swap.setSellAmount(formatAmountInput(fromBalanceNum * q.frac))}
                className="rounded-md border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {q.label}
              </button>
            ))}
          </div>
        )}
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
        <span className="text-[11px] text-muted-foreground">You&apos;ll get (estimated)</span>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-2xl font-semibold tabular-nums truncate">
            {swap.isFetchingQuote ? "…" : swap.buyAmount || "0.0"}
          </span>
          {isBuy ? coinChip : quoteBadge}
        </div>
      </div>

      {/* Currency picker (the quote side) */}
      {quotePicker}

      {/* Trade details */}
      {hasQuote && (
        <div className="space-y-1.5 rounded-xl border border-border/40 bg-muted/10 p-3 text-[11px]">
          {swap.exchangeRate && <DetailRow label="Rate" value={swap.exchangeRate} />}
          {impact != null && !impactHigh && (
            <DetailRow
              label="Price impact"
              value={`~${impact < 1 ? impact.toFixed(2) : impact.toFixed(1)}%`}
              valueClassName={impact > 5 ? "text-amber-600 dark:text-amber-500" : undefined}
            />
          )}
          {swap.minBuyAmount && <DetailRow label="You'll get at least" value={`${swap.minBuyAmount} ${toSymbol}`} />}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              Price protection
              <span
                title="If the price moves more than this while your trade is processing, the trade is cancelled so you're not overcharged."
                className="cursor-help text-muted-foreground/50"
              >
                (?)
              </span>
            </span>
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
        </div>
      )}

      {impactHigh && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500 text-center">
          Low liquidity — this trade moves the price by a lot. Try a smaller amount.
        </p>
      )}

      {noRoute && (
        <p className="text-[11px] text-amber-600 dark:text-amber-500 text-center">
          Not tradable here yet — this coin is live but our price routing hasn&apos;t picked it up.
          You can trade it directly on Ekubo for now.
        </p>
      )}

      {insufficient && (
        <p className="text-[11px] text-destructive text-center">You don&apos;t have enough {fromSymbol}</p>
      )}

      {lastHash ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> All done — your trade is on its way
          </p>
          <div className="flex items-center justify-center gap-3 text-[11px]">
            <a
              href={`${EXPLORER_URL}/tx/${lastHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              Receipt <ExternalLink className="h-3 w-3" />
            </a>
            <Link href="/portfolio" className="text-muted-foreground transition-colors hover:text-foreground">
              My wallet
            </Link>
            <button onClick={() => setLastHash(null)} className="text-muted-foreground transition-colors hover:text-foreground">
              Trade again
            </button>
          </div>
        </div>
      ) : !isConnected ? (
        // Same animated brand-gradient CTA as portfolio / the asset page's
        // "Connect wallet to trade" — opens the shared wallet picker.
        <div className="btn-border-animated p-[1px] rounded-2xl">
          <ConnectWallet
            label="Connect wallet to trade"
            className="w-full h-12 text-base bg-transparent text-white rounded-[15px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98]"
          />
        </div>
      ) : (
        <div className={cn("btn-border-animated p-[1px] rounded-2xl", (!swap.canSwap || coinInsufficient) && "opacity-40 pointer-events-none")}>
          <button
            className="w-full h-12 rounded-[15px] bg-brand-blue text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            disabled={!swap.canSwap || coinInsufficient}
            onClick={handleSwap}
          >
            {swap.isExecuting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {isBuy ? "Buying" : "Selling"}…</>
            ) : noRoute ? (
              "Not tradable here yet"
            ) : (
              <><Zap className="h-4 w-4 mr-2" /> {isBuy ? "Buy" : "Sell"} {coinSymbol}</>
            )}
          </button>
        </div>
      )}

      {/* Friendly trust footer (matches the offer-dialog microcopy pattern) */}
      <p className="flex items-start justify-center gap-1.5 pt-0.5 text-center text-[10px] leading-relaxed text-muted-foreground/70">
        <ShieldCheck className="h-3 w-3 shrink-0 mt-0.5" />
        Held in your own wallet · settles on a public pool via Ekubo
      </p>
      </div>
    </Panel>
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
    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center shrink-0">
      <span className="text-xl font-bold text-white">{(symbol ?? "?").slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

/**
 * Auxiliary panel — a card surface with a subtle brand gradient fill (Primary
 * gradient, blue→purple) layered over the base, per the design system. The
 * gradient is an overlay so inner content keeps full contrast against the
 * frosted backdrop. `rounded-2xl` is the default; pass `rounded-xl` to override.
 */
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
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
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
