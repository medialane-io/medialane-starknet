"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useConnect } from "@starknet-react/core";
import { StarknetkitConnector, useStarknetkitConnectModal } from "starknetkit";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface WalletGateProps {
  children: React.ReactNode;
}

export function WalletGate({ children }: WalletGateProps) {
  const { isConnected } = useWallet();
  const { connectAsync, connectors } = useConnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
    modalTheme: "dark",
  });

  const handleConnect = async () => {
    try {
      const { connector } = await starknetkitConnectModal();
      if (!connector) return;
      await connectAsync({ connector });
    } catch { /* user closed modal */ }
  };

  if (isConnected) return <>{children}</>;

  return (
    <div className="relative">
      {/* Blurred children preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-background/60 backdrop-blur-[2px]">
        <div className="h-10 w-10 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-center px-4">Connect wallet to access this claim</p>
        <Button onClick={handleConnect} className="bg-violet-600 hover:bg-violet-700 text-white">
          Connect wallet
        </Button>
      </div>
    </div>
  );
}
