"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { normalizeAddress } from "@medialane/sdk";
import { signInWithWallet } from "@medialane/sdk/starknet";
import { describeError, UserFacingError } from "@medialane/ui";
import { useAccount } from "@starknet-react/core";
import { useSigner } from "@/hooks/use-signer";
import { useSession, refreshSession } from "@/hooks/use-session";
import { SESSION_REQUIRED } from "@/lib/account-gate";
import { MEDIALANE_BACKEND_URL } from "@/lib/constants";

type AccountSessionValue = {
  isSigningIn: boolean;
  error: string | null;
  signIn: () => Promise<boolean>;
};

const AccountSessionContext = createContext<AccountSessionValue | null>(null);

export function WalletSessionSync({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const signer = useSigner();
  const [isSigningIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (!address || !signer) return false;
    setSigningIn(true);
    setError(null);
    try {
      await signInWithWallet({ backendUrl: MEDIALANE_BACKEND_URL, walletAddress: address, signer, appSource: "MEDIALANE_STARKNET" });
      await refreshSession();
      return true;
    } catch (err) {
      setError(describeError(err).message);
      throw err;
    } finally {
      setSigningIn(false);
    }
  }, [address, signer]);

  return <AccountSessionContext.Provider value={{ isSigningIn, error, signIn }}>{children}</AccountSessionContext.Provider>;
}

export function useAccountSession() {
  const ctx = useContext(AccountSessionContext);
  const { address } = useAccount();
  const { session: current } = useSession();
  const session =
    current?.walletAddress && address && normalizeAddress("STARKNET", current.walletAddress) === normalizeAddress("STARKNET", address)
      ? current
      : null;
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
