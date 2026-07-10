"use client";

import { useParams } from "next/navigation";
import { Ticket, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useTicketValidity } from "@/hooks/use-tickets";
import { AssetPageEdition } from "./asset-page-edition";
import { cn } from "@/lib/utils";

function TicketValidityBanner({
  contract,
  tokenId,
}: {
  contract: string;
  tokenId: string;
}) {
  const { address } = useWallet();
  const { valid, isLoading } = useTicketValidity(contract, tokenId, address ?? null);

  if (!address) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium border",
        isLoading
          ? "bg-muted text-muted-foreground border-border"
          : valid
          ? "bg-teal-500/10 text-teal-600 border-teal-500/30 dark:text-teal-400"
          : "bg-muted/60 text-muted-foreground border-border"
      )}
    >
      {isLoading ? (
        <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking ticket…</>
      ) : valid ? (
        <><CheckCircle2 className="h-3.5 w-3.5" /> Valid ticket</>
      ) : (
        <><Ticket className="h-3.5 w-3.5" /> No valid ticket</>
      )}
    </div>
  );
}

export function AssetPageTicket() {
  const { contract, tokenId } = useParams<{ contract: string; tokenId: string }>();
  return (
    <>
      <AssetPageEdition />
      <TicketValidityBanner contract={contract} tokenId={tokenId} />
    </>
  );
}
