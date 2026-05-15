"use client";

import { Tag, ArrowRightLeft, GitBranch, X, Loader2 } from "lucide-react";
import { HelpIcon } from "@/components/ui/help-icon";
import type { ApiOrder } from "@medialane/sdk";

interface OwnerActionPanelProps {
  /** Active listing for this token; renders the Cancel button when present. */
  myListing: ApiOrder | null;
  isERC1155: boolean;
  isProcessing: boolean;
  onCancelListing: (order: ApiOrder) => void;
  onOpenList: () => void;
  onOpenTransfer: () => void;
  /** When omitted, the Remix button is not rendered (Collection Drops aren't remixable). */
  onOpenRemix?: () => void;
}

/**
 * Owner-only action row for the standard ERC-721 asset page.
 * Renders Cancel (if has listing) + List + Transfer + Remix.
 * Extracted from asset-page-standard.tsx where the same block was
 * inlined twice (has-listing branch + no-listing branch).
 */
export function OwnerActionPanel({
  myListing,
  isERC1155,
  isProcessing,
  onCancelListing,
  onOpenList,
  onOpenTransfer,
  onOpenRemix,
}: OwnerActionPanelProps) {
  return (
    <div className="space-y-2">
      {myListing && (
        <div className="btn-border-animated p-[1px] rounded-xl">
          <button
            className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-destructive disabled:opacity-50"
            disabled={isProcessing}
            onClick={() => onCancelListing(myListing)}
          >
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Cancel listing
          </button>
        </div>
      )}
      <div className="btn-border-animated p-[1px] rounded-xl">
        <button
          className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-blue"
          onClick={onOpenList}
        >
          <Tag className="h-4 w-4" />
          {isERC1155 ? "List edition for sale" : myListing ? "Create new listing" : "List for sale"}
        </button>
      </div>
      <div className="btn-border-animated p-[1px] rounded-xl">
        <button
          className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-orange"
          onClick={onOpenTransfer}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Transfer
        </button>
      </div>
      {onOpenRemix && (
        <div className="btn-border-animated p-[1px] rounded-xl">
          <button
            className="w-full h-10 rounded-[11px] flex items-center justify-center gap-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] bg-brand-purple"
            onClick={onOpenRemix}
          >
            <GitBranch className="h-4 w-4" />
            Create a Remix
            <HelpIcon
              content="Build a licensed derivative of this IP asset — your remix is minted as a new onchain NFT linked to the original"
              side="top"
            />
          </button>
        </div>
      )}
    </div>
  );
}
