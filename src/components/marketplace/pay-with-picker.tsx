"use client";

import { Loader2 } from "lucide-react";
import { SWAP_TOKENS, formatTokenAmount } from "@/utils/swap-tokens";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useSwapQuote } from "@/hooks/use-swap-quote";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { cn } from "@/lib/utils";

interface PayWithOptionProps {
  symbol: string;
  decimals: number;
  orderCurrency: string;
  requiredRaw: bigint;
  walletAddress: string | null;
  selected: boolean;
  onSelect: () => void;
}

function PayWithOption({
  symbol, decimals, orderCurrency, requiredRaw, walletAddress, selected, onSelect,
}: PayWithOptionProps) {
  const { raw: rawBalance } = useTokenBalance(symbol, walletAddress ?? undefined);
  const hasBalance = rawBalance !== null && rawBalance > 0n;

  // Only fetch a browsing quote for tokens the user actually holds — a zero
  // balance can never cover the purchase regardless of rate, so there's no
  // reason to spend a credit finding out.
  const { quote, isLoading } = useSwapQuote(
    hasBalance ? symbol : null,
    orderCurrency,
    hasBalance ? requiredRaw.toString() : null,
    walletAddress
  );

  const sellAmount = quote ? BigInt(quote.sellAmount) : null;
  const insufficient = !hasBalance || (sellAmount !== null && rawBalance! < sellAmount);

  return (
    <button
      type="button"
      disabled={insufficient}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
        insufficient && "opacity-40 pointer-events-none"
      )}
    >
      <CurrencyIcon symbol={symbol} size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{symbol}</p>
        <p className="text-xs text-muted-foreground">
          Balance: {rawBalance !== null ? formatTokenAmount(rawBalance, decimals) : "—"}
        </p>
      </div>
      {hasBalance && isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
      ) : sellAmount !== null ? (
        <p className="text-xs text-muted-foreground shrink-0">
          ≈ {formatTokenAmount(sellAmount, decimals)} {symbol}
        </p>
      ) : insufficient ? (
        <p className="text-xs text-amber-500 shrink-0">Insufficient</p>
      ) : null}
    </button>
  );
}

interface PayWithPickerProps {
  orderCurrency: string;
  requiredRaw: bigint;
  walletAddress: string | null;
  selected: string | null;
  onSelect: (symbol: string) => void;
}

/**
 * Shown only when the buyer's balance in the order's own currency is
 * insufficient — lets them pay with any other SWAP_TOKENS currency instead,
 * auto-swapped into the order's currency as part of the same atomic
 * purchase transaction (executed via checkoutCart's swapCalls option).
 */
export function PayWithPicker({ orderCurrency, requiredRaw, walletAddress, selected, onSelect }: PayWithPickerProps) {
  const alternatives = SWAP_TOKENS.filter((t) => t.symbol !== orderCurrency);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Your {orderCurrency} balance is too low — pay with another token instead:
      </p>
      <div className="space-y-1.5">
        {alternatives.map((token) => (
          <PayWithOption
            key={token.symbol}
            symbol={token.symbol}
            decimals={token.decimals}
            orderCurrency={orderCurrency}
            requiredRaw={requiredRaw}
            walletAddress={walletAddress}
            selected={selected === token.symbol}
            onSelect={() => onSelect(token.symbol)}
          />
        ))}
      </div>
    </div>
  );
}
