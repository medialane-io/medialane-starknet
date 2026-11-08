"use client";

import { NavWalletTrigger as SharedNavWalletTrigger } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { getConnectorIconSrc } from "@/lib/wallet-connectors";

export function HeaderWalletTrigger() {
  const { isConnected, connector } = useWallet();

  return (
    <ConnectWallet
      trigger={<SharedNavWalletTrigger connected={isConnected} iconSrc={getConnectorIconSrc(connector?.icon)} />}
    />
  );
}
