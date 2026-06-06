"use client";

import { useMemo } from "react";
import { useAccount } from "@starknet-react/core";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import {
  IDLE_WALLET_SESSION,
  isWalletSessionBusy,
  walletReady,
  type WalletSession,
  type WalletSessionType,
} from "@/lib/wallet-session";

export interface ActiveWalletSession {
  session: WalletSession;
  address: string | null;
  walletType: WalletSessionType | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useWalletSession(): ActiveWalletSession {
  const {
    session: starkZapSession,
    address: starkZapAddress,
  } = useStarkZapWallet();
  const {
    address: injectedAddress,
    isConnected: injectedConnectedRaw,
    connector: injectedConnector,
    status: injectedStatus,
  } = useAccount();
  const injectedConnected = injectedConnectedRaw ?? false;
  // On reload, starknet-react's autoConnect rehydrates the injected wallet
  // asynchronously and surfaces here as "connecting"/"reconnecting". Surface it
  // so wallet-gated pages can show a "Connecting…" state instead of flashing a
  // disconnected/connect prompt that disappears a beat later.
  const injectedConnecting =
    injectedStatus === "connecting" || injectedStatus === "reconnecting";

  const injectedWalletType: WalletSessionType = (() => {
    const id = injectedConnector?.id?.toLowerCase();
    if (id === "argentx" || id === "argent") return "argent";
    if (id === "braavos") return "braavos";
    return "injected";
  })();

  return useMemo(() => {
    if (starkZapSession.status !== "idle" && starkZapSession.status !== "error") {
      return {
        session: starkZapSession,
        address: starkZapSession.address,
        walletType: starkZapSession.walletType,
        isConnected: Boolean(starkZapSession.address),
        isConnecting: isWalletSessionBusy(starkZapSession),
        error: starkZapSession.error,
      };
    }

    if (starkZapAddress) {
      const session = walletReady(starkZapSession.walletType ?? "cartridge", starkZapAddress);
      return {
        session,
        address: starkZapAddress,
        walletType: session.walletType,
        isConnected: true,
        isConnecting: false,
        error: null,
      };
    }

    if (injectedConnected && injectedAddress) {
      const session = walletReady(injectedWalletType, injectedAddress);
      return {
        session,
        address: injectedAddress,
        walletType: injectedWalletType,
        isConnected: true,
        isConnecting: false,
        error: null,
      };
    }

    return {
      session: starkZapSession.status === "error" ? starkZapSession : IDLE_WALLET_SESSION,
      address: null,
      walletType: null,
      isConnected: false,
      isConnecting: injectedConnecting,
      error: starkZapSession.error,
    };
  }, [starkZapSession, starkZapAddress, injectedConnected, injectedAddress, injectedConnecting]);
}
