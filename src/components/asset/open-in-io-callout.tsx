import { Mail } from "lucide-react";
import { assetHref } from "@/lib/routes";
import type { Chain } from "@medialane/sdk";

interface OpenInIoCalloutProps {
  chain: Chain;
  contract: string;
  tokenId: string;
}

/**
 * Bridge from this chain-native dapp to medialane.io — the chain-agnostic
 * consumer app for visitors who'd rather trade with a managed, frictionless
 * wallet (Google/email) than connect their own. Mirrors OpenInDappCallout on
 * medialane-io, which bridges the opposite direction.
 */
export function OpenInIoCallout({ chain, contract, tokenId }: OpenInIoCalloutProps) {
  const url = `https://medialane.io${assetHref(chain, contract, tokenId)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full items-start gap-3 rounded-2xl border border-transparent bg-gradient-to-br from-brand-rose/15 via-brand-orange/10 to-transparent p-4 transition-colors hover:border-brand-orange/30"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-rose to-brand-orange text-white">
        <Mail className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug">Trade with Google or email</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Buy, offer, and collect on medialane.io — no wallet needed.
        </p>
      </div>
    </a>
  );
}
