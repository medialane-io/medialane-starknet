"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Activity as ActivityIcon, AlertCircle, ChevronRight, Copy, ExternalLink,
  HandCoins, LayoutGrid, LogOut, Settings, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { useNetwork } from "@/components/starknet-provider";
import { useWallet } from "@/hooks/use-wallet";
import { useActivitiesByAddress } from "@/hooks/use-activities";
import { useReceivedOffers } from "@/hooks/use-orders";
import { useTokensByOwner } from "@/hooks/use-tokens";
import { getConnectorIconSrc } from "@/lib/wallet-connectors";
import { isWrongNetwork as computeIsWrongNetwork } from "@/lib/wallet-error";
import { timeAgo } from "@/lib/utils";
import { useNavAccountSheet, NavThemeToggle } from "@medialane/ui";
import type { ApiActivity } from "@medialane/sdk";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const ACTIVITY_VERB: Record<ApiActivity["type"], string> = {
  sale: "Sold",
  listing: "Listed",
  offer: "Offer on",
  transfer: "Transferred",
  mint: "Minted",
  cancelled: "Cancelled listing",
};

function activitySummary(activity: ApiActivity): string {
  if (activity.type === "cancelled") return "Cancelled listing";
  const name = activity.token?.name;
  return name ? `${ACTIVITY_VERB[activity.type]} "${name}"` : ACTIVITY_VERB[activity.type];
}

/** Icon in the same muted circular chip treatment used for currency icons
 *  elsewhere in the app (dual-price.tsx's CoinChip) — keeps smart-chip
 *  icons visually consistent with the rest of the design system. */
function ChipIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground">
      {children}
    </span>
  );
}

function SmartChip({
  href, icon, children, onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
    >
      <ChipIcon>{icon}</ChipIcon>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{children}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
    </Link>
  );
}

/**
 * Settings row — same icon/spacing language as SmartChip, but the theme
 * toggle sits as a sibling control after the link rather than inside it:
 * NavThemeToggle renders its own <button>s, and nesting interactive
 * controls inside an <a> is both invalid HTML and would fire navigation
 * on every theme click.
 */
function SettingsRow({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40">
      <Link href="/settings" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
        <ChipIcon>
          <Settings className="h-4 w-4" />
        </ChipIcon>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">Settings</span>
      </Link>
      <NavThemeToggle />
    </div>
  );
}

/**
 * The account/wallet panel content — identity, a compact contextual
 * dashboard (last activity, pending offers, asset count — each collapsed
 * to one smart chip, only rendered when there's something real to show),
 * and disconnect. No crypto balance here — the connected wallet already
 * shows that natively. Rendered once, globally, inside `<NavAccountSheet>`.
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

  const { activities } = useActivitiesByAddress(address ?? null);
  const { orders: receivedOffers } = useReceivedOffers(address ?? null);
  const { meta: assetsMeta } = useTokensByOwner(address ?? null, 1, 1);

  if (!address) return null;

  const isWrongNetwork = computeIsWrongNetwork(chainId, networkConfig.chainId);
  const lastActivity = activities[0];
  const offersCount = receivedOffers.length;
  const assetsCount = assetsMeta?.total ?? 0;

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
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {walletName} · {networkConfig.name}
          </p>
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

      <div className="space-y-1">
        <SettingsRow onNavigate={close} />
        {lastActivity && (
          <SmartChip href="/portfolio/activity" icon={<ActivityIcon className="h-4 w-4" />} onNavigate={close}>
            {activitySummary(lastActivity)} · {timeAgo(lastActivity.timestamp)}
          </SmartChip>
        )}
        {offersCount > 0 && (
          <SmartChip href="/portfolio/received" icon={<HandCoins className="h-4 w-4" />} onNavigate={close}>
            {offersCount} offer{offersCount > 1 ? "s" : ""} received
          </SmartChip>
        )}
        {assetsCount > 0 && (
          <SmartChip href="/portfolio/assets" icon={<LayoutGrid className="h-4 w-4" />} onNavigate={close}>
            {assetsCount} asset{assetsCount > 1 ? "s" : ""}
          </SmartChip>
        )}
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
