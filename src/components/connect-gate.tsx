"use client";

import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { GradientButton } from "@medialane/ui";
import { Skeleton } from "@medialane/ui/skeleton";

export type ConnectGateProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
};

export function ConnectGate({ children, title, subtitle, icon }: ConnectGateProps) {
  const { isConnected, isConnecting } = useWallet();

  if (isConnecting) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-8 space-y-4">
        <Skeleton className="h-10 w-10 rounded-full mx-auto" />
        <Skeleton className="h-7 w-56 mx-auto" />
        <Skeleton className="h-4 w-72 mx-auto" />
        <Skeleton className="h-10 w-44 mx-auto rounded-md" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-4">
        {icon ?? <Wallet className="h-10 w-10 text-muted-foreground mx-auto" />}
        <h1 className="text-2xl font-bold">{title ?? "Connect your wallet"}</h1>
        <p className="text-muted-foreground">
          {subtitle ?? "Connect your wallet to continue."}
        </p>
        <div className="flex justify-center">

          <GradientButton asChild big wrapperClassName="max-w-xs">
            <ConnectWallet label="Connect wallet" />
          </GradientButton>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
