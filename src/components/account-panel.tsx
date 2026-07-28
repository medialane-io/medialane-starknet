"use client";

import { AlertCircle, Copy, ExternalLink, LogOut, User, Wallet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useAccount } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNetwork } from "@/components/starknet-provider";
import { useWallet } from "@/hooks/use-wallet";
import type { WalletType } from "@/lib/wallet-types";
import { useNavAccountSheet } from "@medialane/ui";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** The specific connected wallet's name — never the generic "Browser Wallet" category. */
function walletName(type: WalletType | null): string {
  if (type === "argent") return "Ready";
  if (type === "braavos") return "Braavos";
  return "Browser Wallet";
}

/**
 * The account/wallet panel content — identity, the specific connected
 * wallet, network, and disconnect. No app navigation here by design (no
 * Portfolio/Creator-tools links) — this is an account & wallet surface, not
 * another menu. Rendered once, globally, inside `<NavAccountSheet>`.
 */
export function AccountPanel() {
  const { chainId } = useAccount();
  const { networkConfig } = useNetwork();
  const { address, walletType, disconnect } = useWallet();
  const { close } = useNavAccountSheet();

  if (!address) return null;

  const isWrongNetwork = !!chainId && BigInt(chainId).toString() !== networkConfig.chainId;

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
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted">
          <User className="h-5 w-5 text-muted-foreground" />
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
              <Wallet className="h-3 w-3" />
              {walletName(walletType)}
            </Badge>
            <Badge
              variant="outline"
              className={`px-2 py-0.5 text-[10px] font-normal ${isWrongNetwork ? "border-red-500/30 bg-red-500/5 text-red-400" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"}`}
            >
              {networkConfig.name}
            </Badge>
          </div>
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
