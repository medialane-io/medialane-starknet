"use client";

import { formatDisplayPrice } from "@medialane/ui";
import { CurrencyIcon } from "@medialane/ui/currency-icon";
import type { ApiOrder } from "@medialane/sdk";
import { resolveFeeConfig } from "@medialane/sdk";

export function PriceBreakdown({ order, quantity }: { order: ApiOrder; quantity: number }) {
  if (!order.price?.formatted) return null;
  const unitPrice = parseFloat(order.price.formatted);
  const totalPrice = unitPrice * quantity;
  const bps = resolveFeeConfig({}).marketplaceBps;
  const feeAmount = (totalPrice * bps) / 10000;
  const grandTotal = totalPrice + feeAmount;
  const decimals = order.price.decimals <= 6 ? 2 : 4;

  return (
    <div className="rounded-xl border border-border divide-y divide-border text-sm">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-muted-foreground">Item price</span>
        <span className="font-medium">{formatDisplayPrice(totalPrice.toFixed(decimals))} {order.price.currency}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-muted-foreground">Platform fee ({(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%)</span>
        <span className="font-medium">{formatDisplayPrice(feeAmount.toFixed(decimals))} {order.price.currency}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="font-semibold">Total due</span>
        <span className="font-bold flex items-center gap-1.5">
          <CurrencyIcon symbol={order.price.currency} size={13} />
          {formatDisplayPrice(grandTotal.toFixed(decimals))} {order.price.currency}
        </span>
      </div>
    </div>
  );
}
