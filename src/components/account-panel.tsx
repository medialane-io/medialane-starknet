"use client";

import Image from "next/image";
import { AlertCircle, Copy, ExternalLink, LogOut, Wallet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAccount } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNetwork } from "@/components/starknet-provider";
import { useWallet } from "@/hooks/use-wallet";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { getConnectorIconSrc } from "@/lib/wallet-connectors";
import { isWrongNetwork as computeIsWrongNetwork } from "@/lib/wallet-error";
import { useNavAccountSheet } from "@medialane/ui";
import { CreatorScoreInline } from "@/components/rewards/creator-score-inline";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * The account/wallet panel content — identity, the specific connected
 * wallet, network, balance, and disconnect. No app navigation here by design
 * (no Portfolio/Creator-tools links) — the command menu already covers that,
 * and duplicating it here would be redundant at best, an incomplete second
 * nav surface at worst. Rendered once, globally, inside `<NavAccountSheet>`.
 */
export function AccountPanel() {
  const { chainId, connector } = useAccount();
  const { networkConfig } = useNetwork();
  const { address, disconnect } = useWallet();
  const { close } = useNavAccountSheet();
  // The connector's own display name (e.g. "Ready Wallet (formerly Argent)",
  // "Braavos", "Cartridge Controller") — same source connect-dialog.tsx uses,
  // so this never drifts out of sync with what a wallet actually calls itself.
  const walletName = connector?.name ?? "Browser Wallet";
  const walletIconSrc = getConnectorIconSrc(connector?.icon);
  const { formatted: strkBalance, isLoading: balanceLoading } = useTokenBalance("STRK", address ?? undefined);

  if (!address) return null;

  const isWrongNetwork = computeIsWrongNetwork(chainId, networkConfig.chainId);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied");
  };

  const handleDisconnect = () => {
    disconnect();
    close();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted">
          {walletIconSrc ? (
            <Image src={walletIconSrc} alt="" fill className="object-cover" unoptimized />
          ) : (
            <Wallet className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{truncate(address)}</h3>
            <button onClick={copyAddress} className="text-muted-foreground transition-colors hover:text-foreground" aria-label="Copy address">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Badge variant="outline" className="flex items-center gap-1 border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-normal text-emerald-400">
              {walletIconSrc ? (
                <Image src={walletIconSrc} alt="" width={12} height={12} className="rounded-sm" unoptimized />
              ) : (
                <Wallet className="h-3 w-3" />
              )}
              {walletName}
            </Badge>
            <Badge
              variant="outline"
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-normal ${isWrongNetwork ? "border-red-500/30 bg-red-500/5 text-red-400" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"}`}
            >
              <Image src="/Starknet-icon.svg" alt="" width={12} height={12} />
              {networkConfig.name}
            </Badge>
          </div>
          <CreatorScoreInline address={address} size="sm" className="mt-2" />
        </div>
        <Link
          href={`${networkConfig.explorerUrl}/address/${address}`}
          target="_blank"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-all hover:text-foreground"
          aria-label="View on explorer"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-3.5 py-2.5">
        <span className="text-xs text-muted-foreground">Balance</span>
        <span className="text-sm font-semibold tabular-nums">
          {balanceLoading ? "…" : strkBalance ? `${strkBalance} STRK` : "0 STRK"}
        </span>
      </div>

      {isWrongNetwork && (
        <div className="flex gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-red-200">Switch network needed</p>
            <p className="text-[10px] leading-relaxed text-red-200/60">
              Switch to {networkConfig.name} in your wallet to interact with Medialane.
            </p>
          </div>
        </div>
      )}

      <Button
        variant="outline"
        onClick={handleDisconnect}
        className="group h-11 w-full border-border/40 transition-all hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Disconnect
      </Button>
    </div>
  );
}
