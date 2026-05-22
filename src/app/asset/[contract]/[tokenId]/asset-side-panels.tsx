"use client";

import Image from "next/image";
import Link from "next/link";
import { ReportDialog } from "@/components/report-dialog";
import { ShareButton } from "@/components/shared/share-button";
import { AddressDisplay } from "@/components/shared/address-display";
import { Button } from "@/components/ui/button";
import { ipfsToHttp } from "@/lib/utils";
import { ExternalLink, Flag } from "lucide-react";

interface HolderLike {
  owner: string;
  amount: string;
}

interface CollectionLike {
  name?: string | null;
  image?: string | null;
}

interface AssetOwnersPanelProps {
  balances: HolderLike[];
  ownerLabel?: string;
  maxVisible?: number;
  showAmount?: boolean;
}

export function AssetOwnersPanel({
  balances,
  ownerLabel,
  maxVisible = 5,
  showAmount = true,
}: AssetOwnersPanelProps) {
  if (balances.length === 0) return null;

  const label = ownerLabel ?? (balances.length === 1 ? "Owner" : `${balances.length} owners`);

  return (
    <div className="rounded-xl border border-border px-4 py-3 space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-col gap-1.5">
        {balances.slice(0, maxVisible).map((balance) => (
          <div key={balance.owner} className="flex items-center justify-between gap-2">
            <Link
              href={`/creator/${balance.owner}`}
              className="hover:text-primary transition-colors font-medium text-sm truncate"
            >
              <AddressDisplay address={balance.owner} chars={6} showCopy={false} />
            </Link>
            {showAmount ? (
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                × {balance.amount}
              </span>
            ) : null}
          </div>
        ))}
        {balances.length > maxVisible ? (
          <p className="text-xs text-muted-foreground/60">
            +{balances.length - maxVisible} more holders
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface AssetLinksRowProps {
  contractHref: string;
  collectionHref: string;
  collection?: CollectionLike | null;
  shareTitle: string;
  reportTarget: {
    type: "TOKEN";
    contract: string;
    tokenId: string;
    name?: string;
  };
  reportOpen: boolean;
  onReportOpenChange: (open: boolean) => void;
}

export function AssetLinksRow({
  contractHref,
  collectionHref,
  collection,
  shareTitle,
  reportTarget,
  reportOpen,
  onReportOpenChange,
}: AssetLinksRowProps) {
  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <a
          href={contractHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          Contract <ExternalLink className="h-3 w-3" />
        </a>
        {collection ? (
          <Link
            href={collectionHref}
            className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-1.5 hover:bg-muted/40 transition-colors group min-w-0"
          >
            <div className="relative h-7 w-7 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-primary/20 to-purple-500/20 ring-1 ring-border">
              {collection.image ? (
                <Image src={ipfsToHttp(collection.image)} alt="" fill className="object-cover" unoptimized />
              ) : null}
            </div>
            <span className="text-xs font-medium truncate group-hover:text-primary transition-colors max-w-[120px]">
              {collection.name}
            </span>
          </Link>
        ) : null}
        <ShareButton title={shareTitle} variant="ghost" size="icon" />
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onReportOpenChange(true)}
          title="Report this asset"
        >
          <Flag className="w-4 h-4" />
        </Button>
      </div>

      <ReportDialog
        target={reportTarget}
        open={reportOpen}
        onOpenChange={onReportOpenChange}
      />
    </>
  );
}
