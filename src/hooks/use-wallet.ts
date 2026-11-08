"use client";

import { useCallback } from "react";
import { useAccount, useDisconnect } from "@starknet-react/core";
import { refreshSession } from "@/hooks/use-session";
import { signOut } from "@/lib/wallet-session";
import type { WalletType } from "@/lib/wallet-types";

function walletTypeOf(connectorId: string | undefined): WalletType {
  const id = connectorId?.toLowerCase();
  if (id === "argentx" || id === "argent") return "argent";
  if (id === "braavos") return "braavos";
  return "injected";
}

export function useWallet() {
  const { address, isConnected, status, chainId, connector } = useAccount();
  const connectedAddress = isConnected && address ? address : null;

  return {
    address: connectedAddress,
    isConnected: connectedAddress !== null,
    isConnecting: status === "connecting" || status === "reconnecting",
    walletType: connectedAddress ? walletTypeOf(connector?.id) : null,
    chainId,
    connector,
  };
}

export function useDisconnectWallet() {
  const { disconnect } = useDisconnect();
  return useCallback(() => {
    disconnect();
    void signOut().then(() => refreshSession());
  }, [disconnect]);
}
