"use client";

/**
 * PrivyLeaf — runs the Privy onboarding pipeline (auth → create wallet → sponsored
 * auto-deploy → ready). Ported VERBATIM from the old contexts/privy-connector.tsx;
 * the only change is that outputs go to the wallet store via gated `ingest` instead
 * of context setState. Rendered inside <PrivyProvider> by WalletProvider, lazily.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import { getStarkZapSdk, isStarkZapSponsorshipEnabled } from "@/lib/starkzap";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import type { WalletStoreApi } from "../store";
import { clearLastChoice } from "../persistence";

export interface PrivyLeafProps {
  store: WalletStoreApi;
  /** A connect("privy") was requested this session (explicit user action). */
  pending: boolean;
  /** Reconnect/already-authenticated mode — run onboarding silently. */
  adopt: boolean;
  clearPending: () => void;
}

export function PrivyLeaf({ store, pending, adopt, clearPending }: PrivyLeafProps) {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();
  const [needsOnboard, setNeedsOnboard] = useState(false);
  const onboardingRef = useRef(false);

  const runOnboarding = useCallback(
    async (silent = false) => {
      const ingest = store.getState().ingest;
      if (!silent) {
        ingest("embedded", { status: "connecting", method: "privy", address: null, error: null });
      }

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
        throw new Error(
          "Privy onboarding requires AVNU paymaster sponsorship to deploy the Starknet account.",
        );
      }

      if (!silent) {
        ingest("embedded", {
          status: "deploying",
          method: "privy",
          address: walletData.address,
          error: null,
        });
      }

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

      store
        .getState()
        .ingest(
          "embedded",
          {
            status: "ready",
            method: "privy",
            address: result.wallet.address as unknown as string,
            error: null,
          },
          result.wallet,
        );
      store.getState().setPrivyUser(user ?? null);
    },
    [getAccessToken, store, user],
  );

  // Step 1: explicit connect request → open Privy login modal.
  useEffect(() => {
    if (!pending) return;
    if (!ready) return;
    clearPending();
    store.getState().ingest("embedded", {
      status: "connecting",
      method: "privy",
      address: null,
      error: null,
    });
    setNeedsOnboard(true);
    // In adopt mode the caller already authenticated Privy (e.g. the airdrop inline
    // email-OTP login) — never re-open the modal; just wait for `authenticated` and
    // onboard in Step 2.
    if (!authenticated && !adopt) login();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pending]);

  // Step 2: once authenticated, run the onboarding pipeline (explicit or adopt).
  useEffect(() => {
    if (!ready || !authenticated) return;
    if (onboardingRef.current) return;

    const isExplicit = needsOnboard;
    const isAdopt = !needsOnboard && adopt;
    if (!isExplicit && !isAdopt) return;

    onboardingRef.current = true;
    setNeedsOnboard(false);

    runOnboarding(isAdopt)
      .catch((err) => {
        console.error("[Privy] onboarding failed:", err);
        store.getState().ingest("embedded", {
          status: "error",
          method: "privy",
          address: null,
          error: getFriendlyWalletError(err).message,
        });
      })
      .finally(() => {
        onboardingRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated, needsOnboard, adopt]);

  // Step 3: Privy session ended externally → clear our store + persistence.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && store.getState().method === "privy") {
      logout().catch(() => {});
      clearLastChoice();
      store.getState().clearActive();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  // Disconnect coordination: when the store leaves Privy (user disconnected) but
  // the Privy session is still authenticated, log Privy out so it can't re-adopt.
  useEffect(() => {
    const unsub = store.subscribe((s) => {
      if (authenticated && s.method !== "privy" && s.backend === null) {
        logout().catch(() => {});
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  return null;
}
