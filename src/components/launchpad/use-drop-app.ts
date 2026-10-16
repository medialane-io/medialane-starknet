"use client";

import type { DropAppProps } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { getMedialaneClient } from "@/lib/medialane-client";

/** The dapp's connected wallet and client for the shared drop screens. */
export function useDropApp(): DropAppProps {
  const { address } = useWallet();
  const { open } = useConnectDialog();
  const signer = useVenueSigner();
  return {
    getClient: getMedialaneClient,
    walletAddress: address ?? null,
    onRequireWallet: open,
    connectLabel: "Connect wallet",
    getSigner: () => {
      if (!signer) throw new Error("Wallet not ready. Please reconnect and try again.");
      return signer;
    },
  };
}
