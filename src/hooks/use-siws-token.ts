"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useWallet } from "@/hooks/use-wallet";
import {
  getStoredSiwsToken,
  requestSiwsToken,
  type SiwsSigner,
} from "@/lib/siws-client";
import { getFriendlyWalletError } from "@/lib/wallet-error";

export function useSiwsToken() {
  const { account } = useAccount();
  const { wallet: starkZapWallet } = useStarkZapWallet();
  // The active-wallet slot decides WHO signs (2026-06-07 redesign) — the old
  // `starkZapWallet ?? account` priority let a stale Cartridge/Privy session
  // sign SIWS for a different wallet than the one the user is actually using.
  const { address: activeAddress, walletType } = useWallet();
  const isStarkZap = walletType === "cartridge" || walletType === "privy";
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync stored token on address change (handles wallet switch / disconnect)
  useEffect(() => {
    if (!activeAddress) {
      setToken(null);
      setError(null);
      return;
    }
    setToken(getStoredSiwsToken(activeAddress));
    setError(null);
  }, [activeAddress]);

  const signIn = useCallback(async (): Promise<string | null> => {
    if (!activeAddress) return null;

    // Resolve the signer that belongs to the ACTIVE wallet — never cross rails.
    // (Injected `account` hydrates async and can be momentarily undefined while
    // connected; surface that as a retryable message instead of a silent null.)
    const signer = (isStarkZap ? starkZapWallet : account) as SiwsSigner | null;
    if (!signer) {
      const message = "Your wallet isn't ready to sign yet — try again in a moment.";
      setError(message);
      throw new Error(message);
    }

    setIsSigningIn(true);
    setError(null);
    try {
      const newToken = await requestSiwsToken({ walletAddress: activeAddress, signer });
      setToken(newToken);
      return newToken;
    } catch (err) {
      // Capture for UI surfaces that read the hook's `error` field, AND
      // rethrow so callers awaiting getValidToken() see the real reason
      // (e.g. "Check if your wallet is deployed on Starknet.") in their
      // try/catch instead of a null they convert to a generic message.
      // getFriendlyWalletError() passes specific, safe messages like that
      // one through unchanged — it only rewrites raw wallet/RPC blobs (e.g.
      // the SNIP wallet-api's own "An error occurred (UNKNOWN_ERROR)").
      console.error("[siws] error:", err);
      const message = getFriendlyWalletError(err).message;
      setError(message);
      throw new Error(message);
    } finally {
      setIsSigningIn(false);
    }
  }, [activeAddress, isStarkZap, starkZapWallet, account]);

  /**
   * Returns an existing valid token or triggers the SIWS sign-in flow.
   * Call this inside SWR fetchers or mutation handlers, not at render time.
   */
  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!activeAddress) return null;

    const existing = getStoredSiwsToken(activeAddress);
    if (existing) {
      setToken(existing);
      return existing;
    }
    return signIn();
  }, [activeAddress, signIn]);

  return { token, signIn, getValidToken, isSigningIn, error };
}
