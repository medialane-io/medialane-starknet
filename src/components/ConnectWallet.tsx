"use client";

import React from "react";
import { useAccount } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2 } from "lucide-react";
import { useNetwork } from "@/components/starknet-provider";
import { useWallet } from "@/hooks/use-wallet";
import { isWrongNetwork as computeIsWrongNetwork } from "@/lib/wallet-error";
import { useNavAccountSheet } from "@medialane/ui";
import { useConnectDialog } from "@/components/connect-dialog";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConnectWalletProps {
  label?: string;
  className?: string;
  /** Overrides the default icon+label trigger content (not-connected state only). */
  children?: React.ReactNode;
  /**
   * Replaces the entire clickable trigger element, in BOTH the connected and
   * not-connected states — for a caller that owns its own trigger visual
   * across both states (e.g. a header component that already knows whether
   * a wallet is connected). Unlike `children`, this is not nested inside the
   * default `<Button>` — it receives the click handler directly, so it
   * renders as-is.
   */
  trigger?: React.ReactElement<{ onClick?: () => void }>;
}

/**
 * A pure trigger — all real UI lives in two global singletons mounted once
 * in the Shell: `ConnectDialog` (connector picker, not connected) and
 * `NavAccountSheet`+`AccountPanel` (identity/wallet, connected). Every
 * `<ConnectWallet/>` mounted anywhere in the app opens the SAME dialog/panel
 * instead of rendering its own — clicking any instance behaves identically.
 */
export function ConnectWallet({ label, className, children, trigger }: ConnectWalletProps = {}) {
  const { isConnected: injectedConnected, chainId } = useAccount();
  const { networkConfig } = useNetwork();
  const { address, isConnected, isConnecting: sessionConnecting } = useWallet();
  const { open: openAccountSheet } = useNavAccountSheet();
  const { open: openConnectDialog } = useConnectDialog();

  const isWrongNetwork = injectedConnected && computeIsWrongNetwork(chainId, networkConfig.chainId);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (sessionConnecting && !isConnected) {
    // `sessionConnecting` is global (one shared wallet slot), so every
    // mounted <ConnectWallet/> on the page hits this branch simultaneously —
    // including ones rendered as a full custom card via `className`/
    // `children` (e.g. the asset page's signed-out actions). This used to
    // unconditionally collapse into a bare 8x8 icon button regardless of
    // what was passed in, discarding the caller's layout entirely and
    // reading as the component breaking. Preserve the caller's shape:
    // custom content keeps rendering as-is (just disabled); the default
    // icon/label trigger swaps its icon for a spinner as before.
    return (
      <Button
        variant="ghost"
        size={label || children ? "default" : "icon"}
        className={className ?? (label || children ? undefined : "rounded-full h-8 w-8")}
        disabled
      >
        {children ?? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {label && <span>{label}</span>}
          </>
        )}
      </Button>
    );
  }

  // ---------------------------------------------------------------------------
  // Connected — opens the global account panel
  // ---------------------------------------------------------------------------

  if (isConnected && address) {
    return trigger ? (
      React.cloneElement(trigger, { onClick: openAccountSheet })
    ) : (
      <Button
        variant="ghost"
        size="icon"
        onClick={openAccountSheet}
        className={`relative rounded-full h-8 w-8 transition-all duration-300 hover:bg-foreground/10 dark:hover:bg-foreground/10
          ${isWrongNetwork
            ? "bg-red-500/10 text-red-500"
            : "text-foreground"}`}
      >
        <Wallet className="h-4 w-4" />
        <span
          className={`absolute top-2 right-2 h-1.5 w-1.5 rounded-full border border-background
            ${isWrongNetwork ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`}
        />
      </Button>
    );
  }

  // ---------------------------------------------------------------------------
  // Not connected — opens the global connector picker
  // ---------------------------------------------------------------------------

  return trigger ? (
    React.cloneElement(trigger, { onClick: openConnectDialog })
  ) : (
    <Button
      variant="ghost"
      size={label ? "default" : "icon"}
      className={
        className ??
        (label
          ? "h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          : "rounded-full h-9 w-9 bg-black/5 dark:bg-foreground/5 hover:bg-black/10 dark:hover:bg-foreground/10 border border-black/5 dark:border-foreground/5 transition-all text-foreground")
      }
      onClick={openConnectDialog}
    >
      {children ?? (
        <>
          <Wallet className="h-4 w-4" />
          {label && <span>{label}</span>}
        </>
      )}
    </Button>
  );
}
