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

interface ConnectWalletProps {
  label?: string;
  className?: string;

  children?: React.ReactNode;

  trigger?: React.ReactElement<{ onClick?: () => void }>;
}

export function ConnectWallet({ label, className, children, trigger }: ConnectWalletProps = {}) {
  const { isConnected: injectedConnected, chainId } = useAccount();
  const { networkConfig } = useNetwork();
  const { address, isConnected, isConnecting: sessionConnecting } = useWallet();
  const { open: openAccountSheet } = useNavAccountSheet();
  const { open: openConnectDialog } = useConnectDialog();

  const isWrongNetwork = injectedConnected && computeIsWrongNetwork(chainId, networkConfig.chainId);

  if (sessionConnecting && !isConnected) {

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
