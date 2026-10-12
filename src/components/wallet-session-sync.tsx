"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { signInWithWallet } from "@medialane/sdk/starknet";
import { describeError, UserFacingError } from "@medialane/ui";
import { useAccount } from "@starknet-react/core";
import { useSigner } from "@/hooks/use-signer";
import { useSession, refreshSession } from "@/hooks/use-session";
import { SESSION_REQUIRED } from "@/lib/account-gate";
import { MEDIALANE_BACKEND_URL } from "@/lib/constants";
import { nextSessionStep, type WalletStatus } from "@/lib/wallet-session";

type AccountSessionValue = {
  isSigningIn: boolean;
  error: string | null;
  signIn: () => Promise<boolean>;
};

const AccountSessionContext = createContext<AccountSessionValue | null>(null);

export function WalletSessionSync({ children }: { children: React.ReactNode }) {
  const { address, status } = useAccount();
  const signer = useSigner();
  const { session, isLoading } = useSession();
  const [declined, setDeclined] = useState<string[]>([]);
  const [isSigningIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address || !signer) return false;
    setSigningIn(true);
    setError(null);
    try {
      await signInWithWallet({ backendUrl: MEDIALANE_BACKEND_URL, walletAddress: address, signer, appSource: "MEDIALANE_STARKNET" });
      setDeclined((d) => d.filter((x) => x !== address));
      await refreshSession();
      return true;
    } catch (err) {
      setDeclined((d) => [...d, address]);
      setError(describeError(err).message);
      throw err;
    } finally {
      setSigningIn(false);
    }
  }, [address, signer]);

  useEffect(() => {
    const step = nextSessionStep({
      status: status as WalletStatus,
      address: address ?? null,
      sessionWallet: session?.walletAddress ?? null,
      sessionLoading: isLoading,
      declined,
      signingIn: isSigningIn,
    });
    if (step === "sign-in" && signer) void signIn().catch(() => {});
    if (step === "sign-out") void fetch("/api/session", { method: "DELETE" }).then(() => refreshSession());
  }, [status, address, session?.walletAddress, isLoading, declined, isSigningIn, signer, signIn]);

  return <AccountSessionContext.Provider value={{ isSigningIn, error, signIn }}>{children}</AccountSessionContext.Provider>;
}

export function useAccountSession() {
  const ctx = useContext(AccountSessionContext);
  const { session } = useSession();
  const signIn = ctx?.signIn ?? (async () => false);
  return {
    session,
    isSigningIn: ctx?.isSigningIn ?? false,
    error: ctx?.error ?? null,
    signIn,
    ensureSignedIn: async () => {
      if (session) return;
      if (!(await signIn())) throw new UserFacingError(SESSION_REQUIRED);
    },
    signedIn: async () => {
      if (session) return true;
      try {
        return await signIn();
      } catch {
        return false;
      }
    },
  };
}
