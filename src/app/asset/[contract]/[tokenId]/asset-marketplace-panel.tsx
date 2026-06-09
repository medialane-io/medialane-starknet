"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectWallet } from "@/components/ConnectWallet";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { AddressDisplay } from "@/components/shared/address-display";
import { HelpIcon } from "@/components/ui/help-icon";
import { formatDisplayPrice, timeUntil } from "@/lib/utils";
import type { ApiOrder } from "@medialane/sdk";
import {
  ArrowRightLeft,
  CheckCircle,
  Clock,
  GitBranch,
  HandCoins,
  Loader2,
  ShoppingCart,
  Tag,
  X,
} from "lucide-react";

interface ActionButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone: "blue" | "orange" | "purple" | "destructive" | "transparent";
  disabled?: boolean;
  helpContent?: string;
}

const actionToneClass: Record<ActionButtonProps["tone"], string> = {
  blue: "bg-brand-blue",
  orange: "bg-brand-orange",
  purple: "bg-brand-purple",
  destructive: "bg-destructive",
  transparent: "bg-transparent",
};

function ActionButton({
  label,
  icon,
  onClick,
  tone,
  disabled = false,
  helpContent,
}: ActionButtonProps) {
  return (
    <div className={`btn-border-animated p-[1px] rounded-2xl ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <button
        className={`w-full h-10 rounded-[15px] flex items-center justify-center gap-2 px-3 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 ${actionToneClass[tone]}`}
        disabled={disabled}
        onClick={onClick}
      >
        {icon}
        {label}
        {helpContent ? <HelpIcon content={helpContent} side="top" /> : null}
      </button>
    </div>
  );
}

interface AssetMarketplacePanelProps {
  cheapest?: ApiOrder;
  /** Listings still loading — render a neutral placeholder instead of flashing
   *  the no-listing (offer) action and then swapping to the listing (trade) one. */
  isMarketLoading?: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
  isProcessing: boolean;
  isERC1155: boolean;
  myListing: ApiOrder | null;
  activeBids: ApiOrder[];
  walletAddress?: string | null;
  remixEnabled?: boolean;
  onCancelClick: (order: ApiOrder) => void;
  onAcceptBid: (order: ApiOrder) => void;
  onOpenListing: () => void;
  onOpenTransfer: () => void;
  onOpenPurchase: (order: ApiOrder) => void;
  onOpenOffer: () => void;
  onOpenRemix?: () => void;
  showDealOption?: boolean;
  onProposeDeal?: () => void;
}

export function AssetMarketplacePanel({
  cheapest,
  isMarketLoading = false,
  isOwner,
  isSignedIn,
  isProcessing,
  isERC1155,
  myListing,
  activeBids,
  walletAddress,
  remixEnabled = false,
  onCancelClick,
  onAcceptBid,
  onOpenListing,
  onOpenTransfer,
  onOpenPurchase,
  onOpenOffer,
  onOpenRemix,
  showDealOption = false,
  onProposeDeal,
}: AssetMarketplacePanelProps) {
  const myBid = !isOwner && walletAddress
    ? activeBids.find((bid) => bid.offerer.toLowerCase() === walletAddress.toLowerCase()) ?? null
    : null;

  // For ERC-1155: a listing from a different seller is still purchasable even when the user owns some editions
  const canBuyMore =
    isERC1155 &&
    isOwner &&
    !!cheapest &&
    !!walletAddress &&
    cheapest.offerer.toLowerCase() !== walletAddress.toLowerCase();

  // Until listings resolve we don't know whether to show the "trade" (has
  // listing) or "make an offer" (no listing) action — render a neutral
  // placeholder so the connect/action button doesn't render once and then
  // swap style/label a moment later.
  if (isMarketLoading && !cheapest) {
    return (
      <div className="rounded-2xl border border-border p-5 space-y-4">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <>
      {cheapest ? (
        <div className="rounded-2xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CurrencyIcon symbol={cheapest.price.currency ?? ""} size={22} />
            <span className="text-3xl font-bold">
              {formatDisplayPrice(cheapest.price.formatted)}
            </span>
            <HelpIcon
              content={`${isOwner && !canBuyMore ? "Your listing" : "Current price"} · Expires ${timeUntil(cheapest.endTime)}`}
              side="top"
            />
          </div>

          {isOwner ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {myListing ? (
                  <ActionButton
                    label="Cancel"
                    icon={isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    onClick={() => onCancelClick(myListing)}
                    disabled={isProcessing}
                    tone="destructive"
                  />
                ) : null}

                <ActionButton
                  label="List"
                  icon={<Tag className="h-4 w-4" />}
                  onClick={onOpenListing}
                  tone="blue"
                />

                <ActionButton
                  label="Transfer"
                  icon={<ArrowRightLeft className="h-4 w-4" />}
                  onClick={onOpenTransfer}
                  tone="orange"
                />

                {remixEnabled && onOpenRemix ? (
                  <ActionButton
                    label="Remix"
                    icon={<GitBranch className="h-4 w-4" />}
                    onClick={onOpenRemix}
                    helpContent="Build a licensed derivative of this digital asset — your remix is minted as a new onchain NFT linked to the original"
                    tone="purple"
                  />
                ) : null}

                {showDealOption && onProposeDeal ? (
                  <ActionButton
                    label="License this IP"
                    icon={<HandCoins className="h-4 w-4" />}
                    onClick={onProposeDeal}
                    helpContent="Propose license terms and a fee to the creator. If they accept, the licensed derivative is minted and listed for you."
                    tone="purple"
                  />
                ) : null}
              </div>

              {/* ERC-1155: owner can still buy more editions from a different seller */}
              {canBuyMore && (
                <>
                  <div className="border-t border-border/40 pt-2 mt-1" />
                  <div className="grid grid-cols-2 gap-2">
                    <ActionButton
                      label="Buy"
                      icon={<ShoppingCart className="h-4 w-4" />}
                      onClick={() => onOpenPurchase(cheapest!)}
                      tone="transparent"
                    />
                    <ActionButton
                      label="Make offer"
                      icon={<HandCoins className="h-4 w-4" />}
                      onClick={onOpenOffer}
                      tone="orange"
                    />
                  </div>
                </>
              )}
            </div>
          ) : isSignedIn ? (
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="Buy"
                icon={<ShoppingCart className="h-4 w-4" />}
                onClick={() => onOpenPurchase(cheapest)}
                tone="transparent"
              />
              <ActionButton
                label="Make offer"
                icon={<HandCoins className="h-4 w-4" />}
                onClick={onOpenOffer}
                tone="orange"
              />
              {remixEnabled && onOpenRemix ? (
                <ActionButton
                  label="Remix"
                  icon={<GitBranch className="h-4 w-4" />}
                  onClick={onOpenRemix}
                  tone="purple"
                />
              ) : null}
              {showDealOption && onProposeDeal ? (
                <ActionButton
                  label="License this IP"
                  icon={<HandCoins className="h-4 w-4" />}
                  onClick={onProposeDeal}
                  tone="purple"
                />
              ) : null}
            </div>
          ) : (
            <div className="btn-border-animated p-[1px] rounded-2xl">
              <ConnectWallet
                label="Connect wallet to trade"
                className="w-full h-12 text-base bg-transparent text-white rounded-[15px] flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-[0.98]"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border p-5 space-y-3">
          {isOwner ? (
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="List"
                icon={<Tag className="h-4 w-4" />}
                onClick={onOpenListing}
                tone="transparent"
              />
              <ActionButton
                label="Transfer"
                icon={<ArrowRightLeft className="h-4 w-4" />}
                onClick={onOpenTransfer}
                tone="orange"
              />
              {remixEnabled && onOpenRemix ? (
                <ActionButton
                  label="Remix"
                  icon={<GitBranch className="h-4 w-4" />}
                  onClick={onOpenRemix}
                  helpContent="Build a licensed derivative of this digital asset — your remix is minted as a new onchain NFT linked to the original"
                  tone="purple"
                />
              ) : null}
            </div>
          ) : isSignedIn ? (
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="Make offer"
                icon={<HandCoins className="h-4 w-4" />}
                onClick={onOpenOffer}
                tone="orange"
              />
              {remixEnabled && onOpenRemix ? (
                <ActionButton
                  label="Remix"
                  icon={<GitBranch className="h-4 w-4" />}
                  onClick={onOpenRemix}
                  helpContent="Build a licensed derivative of this digital asset — your remix is minted as a new onchain NFT linked to the original"
                  tone="purple"
                />
              ) : null}
            </div>
          ) : (
            <ConnectWallet
              label="Connect wallet to make an offer"
              className="w-full h-10 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
            />
          )}
        </div>
      )}

      {myBid ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2.5">
            <HandCoins className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-500">Your active offer</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-foreground inline-flex items-center gap-1">
                  {formatDisplayPrice(myBid.price.formatted)}
                  <CurrencyIcon symbol={myBid.price.currency ?? ""} size={12} />
                </span>
                <span>·</span>
                <Clock className="h-3 w-3" />
                {timeUntil(myBid.endTime)}
              </p>
            </div>
          </div>
          <button
            className="shrink-0 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
            onClick={() => onCancelClick(myBid)}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </button>
        </div>
      ) : null}

      {isOwner && activeBids.length > 0 ? (
        <div className="rounded-xl border border-border p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Incoming offers ({activeBids.length})
          </p>
          <div className="space-y-2">
            {activeBids.map((bid) => (
              <div
                key={bid.orderHash}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      {formatDisplayPrice(bid.price.formatted)}
                      <CurrencyIcon symbol={bid.price.currency ?? ""} size={14} />
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <AddressDisplay
                      address={bid.offerer}
                      chars={4}
                      showCopy={false}
                      className="text-xs text-muted-foreground"
                    />
                    <span className="text-xs text-muted-foreground">·</span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeUntil(bid.endTime)}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => onAcceptBid(bid)}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Accept
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
