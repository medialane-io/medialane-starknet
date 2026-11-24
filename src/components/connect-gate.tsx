"use client";

import type { ReactNode } from "react";
import { Wallet } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { ActionButton, PageState, PageStateSkeleton } from "@medialane/ui";

export type ConnectGateProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

export function ConnectGate({ children, title, subtitle }: ConnectGateProps) {
  const { isConnected, isConnecting } = useWallet();

  if (isConnecting) {
    return <PageStateSkeleton action />;
  }

  if (!isConnected) {
    return (
      <PageState
        icon={Wallet}
        title={title ?? "Connect your wallet"}
        description={subtitle ?? "Connect your wallet to continue."}
      >
        <div className="flex justify-center">
          <ConnectWallet trigger={<ActionButton solid big className="w-full max-w-xs">Connect wallet</ActionButton>} />
        </div>
      </PageState>
    );
  }

  return <>{children}</>;
}
