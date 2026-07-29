"use client";

import { Wallet } from "lucide-react";
import type { Chain } from "@medialane/sdk";
import { ConnectWallet } from "@/components/ConnectWallet";
import { OpenInIoCallout } from "./open-in-io-callout";

interface SignedOutAssetActionsProps {
  chain: Chain;
  contract: string;
  tokenId: string;
}

/**
 * Balanced 2-column entry point for signed-out visitors — the inverse
 * pairing of medialane-io's SignedOutAssetActions. This is the wallet-native
 * dapp, so the wallet connect is the primary (left) action; the bridge to
 * medialane.io's managed Google/email wallet is secondary (right). Colors
 * are inverted too, so each slot keeps a consistent visual language across
 * both apps (left = blue→purple, right = rose→orange) regardless of which
 * action occupies it.
 */
export function SignedOutAssetActions({ chain, contract, tokenId }: SignedOutAssetActionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
      <ConnectWallet className="group flex h-full w-full items-start gap-3 whitespace-normal rounded-2xl border border-transparent bg-gradient-to-br from-brand-blue/15 via-brand-purple/10 to-transparent p-4 text-left transition-colors hover:border-brand-purple/30">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue/20 to-brand-purple/10 text-white">
          <Wallet className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug">Use your Starknet wallet</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            Connect your wallet to trade non-custodially.
          </p>
        </div>
      </ConnectWallet>

      <OpenInIoCallout chain={chain} contract={contract} tokenId={tokenId} />
    </div>
  );
}
