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
    if (!ready) {
      console.log("[Privy] pending connect but SDK not ready yet — waiting");
      return;
    }
    console.log("[Privy] SDK ready, starting connect flow. authenticated=", authenticated);
    clearPending();
    setSession(walletAuthenticating("privy"));
    setNeedsOnboard(true);
    if (!authenticated) {
      console.log("[Privy] calling login()");
      // Don't await — login() may resolve before auth completes. The
      // onboarding effect below watches `authenticated` and fires when it
      // flips true.
      login();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pendingConnect]);

  // Step 2: once authenticated, run the onboarding pipeline.
  // Covers both the explicit-connect path (needsOnboard=true) and the
  // page-reload auto-reconnect path (ml_privy_session set in storage).
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (onboardingRef.current) return;
    if (walletType === "cartridge") return;

    const isExplicit = needsOnboard;
    const isAutoReconnect =
      !needsOnboard &&
      typeof window !== "undefined" &&
      !!localStorage.getItem("ml_privy_session");

    if (!isExplicit && !isAutoReconnect) return;

    onboardingRef.current = true;
    setNeedsOnboard(false);

    runOnboarding(isAutoReconnect)
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

  // Sync logout when Privy session ends externally.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && walletType === "privy") {
      logout().catch(() => {});
      setWallet(null);
      setSession(IDLE_WALLET_SESSION);
      setPrivyUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("ml_privy_session");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  return null;
}
