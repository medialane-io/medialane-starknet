"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Zap } from "lucide-react";
import { Button } from "@medialane/ui/button";
import { assetHref as buildAssetHref } from "@/lib/routes";
import { EXPLORER_URL } from "@/lib/constants";
import { formatDisplayPrice, resolveImage } from "@/lib/utils";
import { CurrencyIcon } from "@medialane/ui/currency-icon";
import { MarketplaceTxLink, successMessages } from "@medialane/ui";
import type { ApiOrder } from "@medialane/sdk";
import { resolveFeeConfig } from "@medialane/sdk";

export function TokenHero({ order, quantity }: { order: ApiOrder; quantity: number }) {
  const image = resolveImage(order.token?.image);
  const name = order.token?.name || `Token #${order.nftTokenId}`;
  const unitPrice = order.price?.formatted ? parseFloat(order.price.formatted) : null;
  const totalPrice = unitPrice !== null ? unitPrice * quantity : null;
  const showTotal = quantity > 1 && totalPrice !== null;

  return (
    <div>
      <div className="flex justify-center pt-6 shrink-0">
        <div className="relative h-32 w-32 rounded-2xl overflow-hidden border border-border bg-muted">
          {image ? (
            <Image src={image} alt={name} fill sizes="128px" className="h-full w-full object-cover" unoptimized />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/20 via-brand-purple/10 to-transparent flex items-center justify-center text-2xl font-bold text-muted-foreground/30">
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between px-5 pt-4 pb-1 gap-4">
        <div className="min-w-0">
          <p className="font-bold text-lg leading-tight truncate">{name}</p>
          <div className="flex items-center gap-1 mt-1">
            <Zap className="h-3 w-3 text-emerald-500" />
            <span className="text-2xs font-medium text-emerald-500">Digital Asset Ownership</span>
          </div>
        </div>
        {order.price ? (
          <div className="shrink-0 text-right">
            <p className="flex items-center gap-1.5 font-bold text-2xl justify-end">
              <CurrencyIcon symbol={order.price.currency} size={18} />
              {showTotal
                ? formatDisplayPrice(totalPrice!.toFixed(order.price.decimals <= 6 ? 2 : 4))
                : formatDisplayPrice(order.price.formatted)}
            </p>
            {showTotal ? (
              <p className="text-xs text-muted-foreground">
                {formatDisplayPrice(order.price.formatted)} x {quantity} {order.price.currency}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{order.price.currency}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

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

export function SuccessScreen({
  order,
  quantity,
  txHash,
  onClose,
  onViewPortfolio,
}: {
  order: ApiOrder;
  quantity: number;
  txHash: string | null;
  onClose: () => void;
  onViewPortfolio: () => void;
}) {
  const image = resolveImage(order.token?.image);
  const name = order.token?.name ?? null;
  const is1155 = order.offer?.itemType === "ERC1155";
  const assetHref = buildAssetHref("STARKNET", order.nftContract, order.nftTokenId);
  const unitPrice = order.price?.formatted ? parseFloat(order.price.formatted) : null;
  const totalPrice = unitPrice !== null ? unitPrice * quantity : null;
  const message = successMessages.purchased({ name: name ?? "the asset", quantity: is1155 ? quantity : 1 });

  return (
    <div className="flex flex-col">
      <div className="flex flex-col items-center gap-4 px-5 pt-8 shrink-0">
        <div className="relative">
          <div className="relative h-32 w-32 rounded-2xl overflow-hidden border border-border bg-muted">
            {image ? (
              <Image src={image} alt={name ?? ""} fill sizes="128px" className="h-full w-full object-cover" unoptimized />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-primary/20 via-brand-purple/10 to-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500/40" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-background">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
        </div>
        <div className="text-center min-w-0 max-w-full">
          <p className="font-black text-xl leading-tight">{message.title}</p>
          <p className="text-muted-foreground text-sm mt-0.5 break-words">{message.description}</p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        <div className="rounded-xl border border-border divide-y divide-border text-sm">
          {order.price ? (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Price paid</span>
              <span className="font-semibold flex items-center gap-1.5">
                <CurrencyIcon symbol={order.price.currency} size={13} />
                {totalPrice !== null && quantity > 1
                  ? `${formatDisplayPrice(totalPrice.toFixed(order.price.decimals <= 6 ? 2 : 4))} ${order.price.currency}`
                  : `${formatDisplayPrice(order.price.formatted)} ${order.price.currency}`}
              </span>
            </div>
          ) : null}
          {txHash ? (
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-muted-foreground">Transaction</span>
              <MarketplaceTxLink txHash={txHash} explorerUrl={EXPLORER_URL} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button variant="outline" className="flex-1" asChild>
            <Link href={assetHref} onClick={onClose}>View asset</Link>
          </Button>
          <Button className="flex-1" onClick={onViewPortfolio}>
            View portfolio
          </Button>
        </div>
      </div>
    </div>
  );
}
