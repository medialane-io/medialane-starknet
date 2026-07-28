"use client";

import { useAccount } from "@starknet-react/core";
import { NavWalletTrigger as SharedNavWalletTrigger } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";
import { getConnectorIconSrc } from "@/lib/wallet-connectors";

/**
 * The global header's top-right wallet entry point (fixed, mirrors
 * `NavBrandButton` on the left). Wraps the shared `@medialane/ui`
 * `NavWalletTrigger` visual with this app's real connect state and reuses
 * `ConnectWallet`'s existing connector-picker dialog / account sheet — this
 * component owns no wallet logic of its own, only the trigger visual. The
 * connected wallet's own icon (Argent/Braavos/Cartridge) is passed through
 * via `iconSrc` — same source `account-panel.tsx` already uses.
 */
export function HeaderWalletTrigger() {
  const { isConnected } = useWallet();
  const { connector } = useAccount();

  return (
    <ConnectWallet
      trigger={<SharedNavWalletTrigger connected={isConnected} iconSrc={getConnectorIconSrc(connector?.icon)} />}
    />
  );
}
