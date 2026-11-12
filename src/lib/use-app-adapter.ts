"use client";

import { Mail } from "lucide-react";
import type { MedialaneApp } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useAccountSession } from "@/components/wallet-session-sync";
import { useConnectDialog } from "@/components/connect-dialog";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { getMedialaneClient } from "@/lib/medialane-client";
import { resolveImage } from "@/lib/utils";

export function useAppAdapter(): MedialaneApp {
  const { address, isConnecting } = useWallet();
  const { ensureSignedIn, session } = useAccountSession();
  const { open } = useConnectDialog();
  const signer = useVenueSigner();
  return {
    getClient: getMedialaneClient,
    walletAddress: address ?? null,
    walletLoading: isConnecting,
    onRequireWallet: open,
    ensureSignedIn,
    signedIn: !!session,
    connectLabel: "Connect wallet",
    companion: {
      title: "Trade with Google or email",
      description: "Open this asset on Medialane and trade with your email.",
      icon: Mail,
      origin: "https://medialane.io",
    },
    resolveImage,
    getSigner: () => {
      if (!signer) throw new Error("Wallet not ready. Please reconnect and try again.");
      return signer;
    },
  };
}
