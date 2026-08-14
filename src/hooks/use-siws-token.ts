"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { useWallet } from "@/hooks/use-wallet";
import { useSigner } from "@/hooks/use-signer";
import {
  getStoredSiwsToken,
  requestSiwsToken,
} from "@/lib/siws-client";
import { getFriendlyWalletError } from "@/lib/wallet-error";

export function useSiwsToken() {
  const account = useSigner();
  const { address: activeAddress } = useWallet();
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const signer = account;
    if (!signer) {
      const message = "Your wallet isn't ready to sign yet — try again in a moment.";
      setError(message);
      throw new Error(message);
    }

    setIsSigningIn(true);
    setError(null);

    const signToast = toast.loading("Check your wallet to sign in and continue.");
    try {
      const newToken = await requestSiwsToken({ walletAddress: activeAddress, signer });
      toast.dismiss(signToast);
      setToken(newToken);
      return newToken;
    } catch (err) {

      console.error("[siws] error:", err);
      const message = getFriendlyWalletError(err).message;
      toast.dismiss(signToast);
      setError(message);
      throw new Error(message);
    } finally {
      setIsSigningIn(false);
    }
  }, [activeAddress, account]);

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
