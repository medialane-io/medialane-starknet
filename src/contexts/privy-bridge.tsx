"use client";

/**
 * PrivyBridge — rendered only when PrivyProvider is active.
 * Contains all usePrivy() calls so the rest of the app has zero Privy dependency.
 */

import { useCallback, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { OnboardStrategy } from "starkzap";
import { getStarkZapSdk, isStarkZapSponsorshipEnabled } from "@/lib/starkzap";
import { useStarkZapPrivyBridge } from "./starkzap-wallet-context";

export function PrivyBridge() {
  const { authenticated, login, logout, getAccessToken, user } = usePrivy();
  const bridge = useStarkZapPrivyBridge();

  const initPrivyWallet = useCallback(async (silent = false) => {
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

    if (!isStarkZapSponsorshipEnabled()) {
      throw new Error("Privy onboarding requires AVNU paymaster sponsorship to deploy the Starknet account.");
    }

    const result = await sdk.onboard({
      strategy: OnboardStrategy.Privy,
      accountPreset: "argentXV050",
      feeMode: "sponsored",
      privy: { resolve: privyResolve },
      deploy: "never",
    });

    await result.wallet.ensureReady({
      deploy: "if_needed",
      feeMode: "sponsored",
    });

    bridge?.onPrivyConnected(result.wallet, result.wallet.address as unknown as string, user ?? null);
  }, [getAccessToken, user, bridge]);

  // Handle explicit connect request (user clicked "Connect with Privy")
  useEffect(() => {
    if (!bridge?.pendingPrivyConnect) return;
    bridge.clearPendingPrivyConnect();
    bridge.onPrivyConnecting();

    const run = async () => {
      if (!authenticated) await login();
      await initPrivyWallet();
    };

    run().catch((err) => {
      bridge.onPrivyError(err instanceof Error ? err.message : "Failed to connect with Privy");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge?.pendingPrivyConnect]);

  // Auto-reconnect on page reload — only fires when user previously used Privy
  useEffect(() => {
    if (!authenticated || bridge?.walletType === "cartridge") return;
    if (!localStorage.getItem("ml_privy_session")) return;

    initPrivyWallet(true).catch((err) => {
      console.error("Privy auto-reconnect failed:", err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  // Sync logout when Privy session ends externally
  useEffect(() => {
    if (!authenticated && bridge?.walletType === "privy") {
      logout().catch(() => {});
      bridge.onPrivyDisconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  return null;
}
