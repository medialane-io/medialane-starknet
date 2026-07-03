"use client";

import { useState } from "react";
import { ArrowDownUp, ChevronDown, Loader2, Info, ExternalLink, ArrowRightLeft, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/use-wallet";
import { useSwap, SWAP_TOKENS, type SwapToken } from "@/hooks/use-swap";
import { EXPLORER_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Token badge
// ---------------------------------------------------------------------------

function TokenBadge({
  token,
  size = "md",
}: {
  token: SwapToken;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-5 w-5 text-[10px]",
    md: "h-7 w-7 text-xs",
    lg: "h-9 w-9 text-sm",
  };
  return (
    <span
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shrink-0",
        sizeClasses[size]
      )}
      style={{ background: token.color }}
    >
      {token.symbol.slice(0, 2)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Token selector dropdown
// ---------------------------------------------------------------------------

function TokenSelector({
  selected,
  onSelect,
  exclude,
}: {
  selected: SwapToken;
  onSelect: (t: SwapToken) => void;
  exclude?: SwapToken;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="h-10 gap-2 px-3 font-semibold text-sm rounded-xl"
        >
          <TokenBadge token={selected} size="sm" />
          {selected.symbol}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {SWAP_TOKENS.filter((t) => t.symbol !== exclude?.symbol).map((token) => (
          <DropdownMenuItem
            key={token.symbol}
            className={cn(
              "gap-2.5 cursor-pointer",
              token.symbol === selected.symbol && "bg-accent"
            )}
            onSelect={() => onSelect(token)}
          >
            <TokenBadge token={token} size="sm" />
            <div className="flex flex-col leading-none">
              <span className="font-medium text-sm">{token.symbol}</span>
              <span className="text-[11px] text-muted-foreground">{token.name}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Token amount field
// ---------------------------------------------------------------------------

function TokenField({
  label,
  token,
  onTokenSelect,
  excludeToken,
  amount,
  onAmountChange,
  balance,
  isBalanceLoading,
  isReadOnly,
  isLoading,
  onMaxClick,
}: {
  label: string;
  token: SwapToken;
  onTokenSelect: (t: SwapToken) => void;
  excludeToken?: SwapToken;
  amount: string;
  onAmountChange?: (v: string) => void;
  balance: string | null;
  isBalanceLoading: boolean;
  isReadOnly?: boolean;
  isLoading?: boolean;
  onMaxClick?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-muted/50 border border-border/60 p-4 space-y-3 hover:border-border transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isBalanceLoading ? (
            <Skeleton className="h-3.5 w-16" />
          ) : balance !== null ? (
            <>
              <span>Balance: <span className="font-medium text-foreground">{balance}</span></span>
              {onMaxClick && balance !== "0" && (
                <button
                  onClick={onMaxClick}
                  className="text-primary hover:underline font-semibold text-[11px]"
                >
                  MAX
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <TokenSelector
          selected={token}
          onSelect={onTokenSelect}
          exclude={excludeToken}
        />
        <div className="flex-1 relative">
          {isLoading ? (
            <Skeleton className="h-9 w-full rounded-lg" />
          ) : (
            <Input
              value={amount}
              onChange={(e) => onAmountChange?.(e.target.value)}
              readOnly={isReadOnly}
              placeholder="0.00"
              className={cn(
                "text-right text-xl font-semibold h-10 border-0 bg-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40",
                isReadOnly && "cursor-default"
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Route info row
// ---------------------------------------------------------------------------

function RouteInfo({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", className)}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SwapContent() {
  const { isConnected } = useWallet();
  const [showRouteDetails, setShowRouteDetails] = useState(false);

  const swap = useSwap();

  const handleMax = () => {
    if (swap.sellBalance) {
      swap.setSellAmount(swap.sellBalance);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ArrowRightLeft className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center space-y-2 max-w-xs">
          <h1 className="text-2xl font-bold">Swap tokens</h1>
          <p className="text-muted-foreground text-sm">
            Connect your wallet to swap ETH, STRK, USDC, USDT and more.
          </p>
        </div>
        <ConnectWallet />
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Zap className="h-3 w-3 text-primary" />
          Powered by Ekubo via AVNU
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-16">
      <div className="w-full max-w-md space-y-4">

        {/* Header */}
        <div className="space-y-1 mb-2">
          <div className="flex items-center gap-2 text-primary">
            <ArrowRightLeft className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Swap</span>
          </div>
          <h1 className="text-2xl font-bold">Exchange tokens</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
            Swaps route through Ekubo via AVNU
          </p>
        </div>

        {/* Swap card */}
        <Card className="shadow-md border-border/60">
          <CardContent className="p-4 space-y-2">

            {/* Sell field */}
            <TokenField
              label="You pay"
              token={swap.sellToken}
              onTokenSelect={swap.setSellToken}
              excludeToken={swap.buyToken}
              amount={swap.sellAmount}
              onAmountChange={swap.setSellAmount}
              balance={swap.sellBalance}
              isBalanceLoading={swap.isSellBalanceLoading}
              onMaxClick={handleMax}
            />

            {/* Flip button */}
            <div className="flex justify-center relative h-0">
              <button
                onClick={swap.flipTokens}
                className="absolute -top-5 z-10 h-10 w-10 rounded-xl bg-background border border-border/60 shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-all hover:scale-105 active:scale-95"
              >
                <ArrowDownUp className="h-4 w-4" />
              </button>
            </div>

            {/* Buy field */}
            <div className="pt-4">
              <TokenField
                label="You receive"
                token={swap.buyToken}
                onTokenSelect={swap.setBuyToken}
                excludeToken={swap.sellToken}
                amount={swap.buyAmount}
                onAmountChange={() => {}}
                balance={swap.buyBalance}
                isBalanceLoading={false}
                isReadOnly
                isLoading={swap.isFetchingQuote}
              />
            </div>

            {/* Quote error */}
            {swap.quoteError && (
              <p className="text-xs text-destructive text-center py-1 px-3 bg-destructive/10 rounded-lg">
                {swap.quoteError}
              </p>
            )}

            {/* Price info */}
            {swap.exchangeRate && (
              <div className="rounded-xl bg-muted/40 px-3.5 py-3 space-y-2">
                <button
                  className="w-full flex items-center justify-between text-sm"
                  onClick={() => setShowRouteDetails((v) => !v)}
                >
                  <span className="text-muted-foreground">{swap.exchangeRate}</span>
                  <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-3.5 w-3.5" />
                    <span className="text-xs">{showRouteDetails ? "Hide" : "Details"}</span>
                  </div>
                </button>

                {showRouteDetails && swap.quote && (
                  <div className="border-t border-border/40 pt-2 space-y-1.5">
                    {swap.priceImpact && (
                      <RouteInfo
                        label="Price impact"
                        value={swap.priceImpact}
                        className={
                          parseFloat(swap.priceImpact) > 3
                            ? "text-destructive"
                            : parseFloat(swap.priceImpact) > 1
                            ? "text-amber-500"
                            : "text-green-500"
                        }
                      />
                    )}
                    <RouteInfo label="Slippage tolerance" value="0.5%" />
                    <RouteInfo label="Protocol" value="Ekubo" />
                  </div>
                )}
              </div>
            )}

            {/* Insufficient balance warning */}
            {swap.insufficientBalance && (
              <p className="text-xs text-destructive text-center">
                Insufficient {swap.sellToken.symbol} balance
              </p>
            )}

            {/* CTA button */}
            <Button
              onClick={swap.executeSwap}
              disabled={!swap.canSwap}
              className="w-full h-12 text-base font-semibold rounded-xl mt-1"
            >
              {swap.isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Swapping…
                </>
              ) : swap.isFetchingQuote ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Getting best price…
                </>
              ) : swap.insufficientBalance ? (
                `Insufficient ${swap.sellToken.symbol}`
              ) : !swap.sellAmount ? (
                "Enter an amount"
              ) : swap.quoteError ? (
                "No route found"
              ) : (
                `Swap ${swap.sellToken.symbol} → ${swap.buyToken.symbol}`
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Tx confirmation */}
        {swap.txHash && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-center justify-between gap-3 text-sm">
            <div className="space-y-0.5">
              <p className="font-semibold text-green-600 dark:text-green-400">Swap submitted</p>
              <p className="text-muted-foreground text-xs font-mono truncate max-w-[200px]">
                {swap.txHash}
              </p>
            </div>
            <a
              href={`${EXPLORER_URL}/tx/${swap.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}

        {/* Powered by */}
        <p className="text-center text-xs text-muted-foreground pt-2">
          Prices and routes via{" "}
          <span className="font-medium text-foreground">AVNU Exchange</span>
        </p>
      </div>
    </div>
  );
}
