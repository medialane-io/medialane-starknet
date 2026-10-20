"use client";

import { Mail } from "lucide-react";
import type { MedialaneApp } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useConnectDialog } from "@/components/connect-dialog";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { getMedialaneClient } from "@/lib/medialane-client";
import { ReportDialog } from "@/components/report-dialog";

export function useAppAdapter(): MedialaneApp {
  const { address } = useWallet();
  const { open } = useConnectDialog();
  const signer = useVenueSigner();
  return {
    getClient: getMedialaneClient,
    walletAddress: address ?? null,
    onRequireWallet: open,
    connectLabel: "Connect wallet",
    connectDescription: "Use your Starknet wallet to trade non-custodially.",
    companion: {
      title: "Trade with Google or email",
      description: "Open this asset on Medialane and trade with your email.",
      icon: Mail,
      origin: "https://medialane.io",
    },
    ReportDialog,
    getSigner: () => {
      if (!signer) throw new Error("Wallet not ready. Please reconnect and try again.");
      return signer;
    },
  };
}
