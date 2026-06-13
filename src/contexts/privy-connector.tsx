"use client";

/**
 * PrivyConnector — runs the Privy onboarding flow.
 * Rendered by StarkZapWalletProvider only when providers.tsx has loaded
 * the lazy Privy bundle. Communicates with its parent via props (no
 * second context — that pattern caused a silent-mount regression).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import type { WalletInterface } from "starkzap";
import type { User } from "@privy-io/react-auth";
import { getStarkZapSdk, isStarkZapSponsorshipEnabled } from "@/lib/starkzap";
import type { WalletSession } from "@/lib/wallet-session";
import {
  IDLE_WALLET_SESSION,
  walletAuthenticating,
  walletDeployingAccount,
  walletError,
  walletPreparingWallet,
  walletReady,
} from "@/lib/wallet-session";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { clearPersistedWallet } from "@/lib/wallet-types";

export interface PrivyConnectorProps {
  pendingConnect: boolean;
  clearPending: () => void;
  walletType: "cartridge" | "privy" | null;
  setSession: (next: WalletSession) => void;
  setWallet: (w: WalletInterface | null) => void;
  setPrivyUser: (u: User | null) => void;
}

export function PrivyConnector({
  pendingConnect,
  clearPending,
  walletType,
  setSession,
  setWallet,
  setPrivyUser,
}: PrivyConnectorProps) {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();

  // Tracks an in-flight user-initiated onboarding so we can run it once
  // `authenticated` flips true after the Privy modal closes. login() can
  // resolve before authentication completes, so we don't drive onboarding
  // off of awaiting it.
  const [needsOnboard, setNeedsOnboard] = useState(false);
  const onboardingRef = useRef(false);

  const runOnboarding = useCallback(async (silent = false) => {
    if (!silent) setSession(walletPreparingWallet("privy"));

    const token = await getAccessToken();
    if (!token) {
      if (silent) return;
      throw new Error("No Privy access token");
    }

    const res = await fetch("/api/wallet/starknet", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to create Privy Starknet wallet");
    const walletData = (await res.json()) as { id: string; address: string; publicKey: string };

    if (!isStarkZapSponsorshipEnabled()) {
      throw new Error("Privy onboarding requires AVNU paymaster sponsorship to deploy the Starknet account.");
    }

    if (!silent) setSession(walletDeployingAccount("privy", walletData.address));

    const sdk = getStarkZapSdk();
    const privyResolve = async () => ({
      walletId: walletData.id,
      publicKey: walletData.publicKey,
      serverUrl: `${window.location.origin}/api/wallet/sign`,
      headers: async (): Promise<Record<string, string>> => {
        const freshToken = await getAccessToken();
        if (!freshToken) return {};
        return { Authorization: `Bearer ${freshToken}` };
      },
    });

    const result = await sdk.onboard({
      strategy: OnboardStrategy.Privy,
      accountPreset: "argentXV050",
      feeMode: "sponsored",
      privy: { resolve: privyResolve },
      deploy: "if_needed",
    });

    setWallet(result.wallet);
    setSession(walletReady("privy", result.wallet.address as unknown as string));
    setPrivyUser(user ?? null);
  }, [getAccessToken, setSession, setWallet, setPrivyUser, user]);

  // Step 1: explicit connect request — open Privy login modal.
  useEffect(() => {
    if (!pendingConnect) return;
    if (!ready) return;
    clearPending();
    setSession(walletAuthenticating("privy"));
    setNeedsOnboard(true);
    if (!authenticated) {
      // Don't await — login() may resolve before auth completes. The
      // onboarding effect below watches `authenticated` and fires when it
      // flips true.
      login();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pendingConnect]);

  // Step 2: once authenticated, run the onboarding pipeline — EXPLICIT connect
  // only (needsOnboard=true). There is no silent background auto-reconnect: a
  // Privy session never restores itself over the wallet the user is using. The
  // page-reload restore (below) routes through this same pipeline by setting
  // needsOnboard, and only when Privy is the persisted choice.
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (onboardingRef.current) return;
    if (walletType === "cartridge") return;
    if (!needsOnboard) return;

    onboardingRef.current = true;
    setNeedsOnboard(false);

    runOnboarding(false)
      .catch((err) => {
        // Raw detail → console only; users see a friendly message (e.g. a
        // transient RPC -32001 becomes "Network busy — try again").
        console.error("[Privy] onboarding failed:", err);
        setWallet(null);
        setSession(walletError("privy", getFriendlyWalletError(err).message));
      })
      .finally(() => {
        onboardingRef.current = false;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, needsOnboard]);

  // Page-reload restore: if Privy is the persisted wallet and the Privy session
  // is still authenticated, run the (explicit-equivalent) pipeline once. This
  // restores ONLY Privy, and ONLY when it is the user's last explicit choice —
  // never over an injected pick (an injected connect clears ml_wallet, so the
  // guard below is false).
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (onboardingRef.current || needsOnboard) return;
    if (walletType === "privy") return; // already active
    const persisted =
      typeof window !== "undefined" ? window.localStorage.getItem("ml_wallet") : null;
    if (persisted !== "privy") return;
    setNeedsOnboard(true); // re-uses the explicit pipeline above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  // Sync logout when Privy session ends externally.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && walletType === "privy") {
      logout().catch(() => {});
      setWallet(null);
      setSession(IDLE_WALLET_SESSION);
      setPrivyUser(null);
      clearPersistedWallet();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  return null;
}
