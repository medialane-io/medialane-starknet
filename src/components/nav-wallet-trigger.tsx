"use client";

import { NavWalletTrigger as SharedNavWalletTrigger } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { ConnectWallet } from "@/components/ConnectWallet";

/**
 * The global header's top-right wallet entry point (fixed, mirrors
 * `NavBrandButton` on the left). Wraps the shared `@medialane/ui`
 * `NavWalletTrigger` visual with this app's real connect state and reuses
 * `ConnectWallet`'s existing connector-picker dialog / account sheet — this
 * component owns no wallet logic of its own, only the trigger visual.
 */
export function HeaderWalletTrigger() {
  const { isConnected } = useWallet();

  return (
    <ConnectWallet trigger={<SharedNavWalletTrigger connected={isConnected} />} />
  );
}
