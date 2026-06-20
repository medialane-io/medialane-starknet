"use client";

import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Skeleton } from "@/components/ui/skeleton";

export type ConnectGateProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
};

/**
 * Single source of truth for "you must connect to use this page".
 *
 * Three states off useWallet():
 *  - isConnecting  → skeleton placeholder (returning users never flash the panel)
 *  - !isConnected  → friendly connect panel (reuses the shared <ConnectWallet/>)
 *  - connected     → children
 *
 * Wrap the body of any protected launchpad/portfolio page in this. Public
 * discovery pages (/launchpad landing, /marketplace, /asset, /collections)
 * must NOT use it.
 */
export function ConnectGate({ children, title, subtitle, icon }: ConnectGateProps) {
  const { isConnected, isConnecting } = useWallet();

  if (isConnecting) {
    return (
      <div className="container max-w-lg mx-auto px-4 pt-24 pb-8 space-y-4">
        <Skeleton className="h-10 w-10 rounded-full mx-auto" />
        <Skeleton className="h-7 w-56 mx-auto" />
        <Skeleton className="h-4 w-72 mx-auto" />
        <Skeleton className="h-10 w-44 mx-auto rounded-md" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="container max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        {icon ?? <Wallet className="h-10 w-10 text-muted-foreground mx-auto" />}
        <h1 className="text-2xl font-bold">{title ?? "Connect your wallet"}</h1>
        <p className="text-muted-foreground">
          {subtitle ?? "Connect your wallet to continue."}
        </p>
        <div className="flex justify-center">
          <ConnectWallet />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
