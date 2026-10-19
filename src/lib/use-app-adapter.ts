"use client";

import type { MedialaneApp } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { getMedialaneClient } from "@/lib/medialane-client";

export function useAppAdapter(): MedialaneApp {
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
