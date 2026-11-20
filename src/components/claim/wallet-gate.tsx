"use client";

import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Lock } from "lucide-react";
import { IconTile } from "@medialane/ui";

interface WalletGateProps {
  children: React.ReactNode;
}

export function WalletGate({ children }: WalletGateProps) {
  const { isConnected } = useWallet();

  if (isConnected) return <>{children}</>;

  return (
    <div className="relative">

      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-background/60 backdrop-blur-[2px]">
        <IconTile>
          <Lock />
        </IconTile>
        <p className="text-sm font-medium text-center px-4">Connect wallet to access this claim</p>
        <ConnectWallet label="Connect wallet" />
      </div>
    </div>
  );
}
