"use client";

import { useAccount } from "@starknet-react/core";
import { NavWalletTrigger as SharedNavWalletTrigger } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { getConnectorIconSrc } from "@/lib/wallet-connectors";

export function HeaderWalletTrigger() {
  const { isConnected } = useWallet();
  const { connector } = useAccount();

  return (
    <ConnectWallet
      trigger={<SharedNavWalletTrigger connected={isConnected} iconSrc={getConnectorIconSrc(connector?.icon)} />}
    />
  );
}
