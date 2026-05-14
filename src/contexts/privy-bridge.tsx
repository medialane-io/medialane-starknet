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
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();
  const bridge = useStarkZapPrivyBridge();

  const initPrivyWallet = useCallback(async (silent = false) => {
    if (!bridge) return;

    bridge.onPrivyPreparingWallet();

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

    bridge.onPrivyDeployingAccount(walletData.address);

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

    bridge.onPrivyConnected(
      result.wallet,
      result.wallet.address as unknown as string,
      user ?? null,
    );
  }, [bridge, getAccessToken, user]);

  // Explicit connect — gated on Privy `ready` so login() isn't called before init.
  useEffect(() => {
    if (!bridge?.pendingPrivyConnect) return;
    if (!ready) {
      console.log("[Privy] pending connect but SDK not ready yet — waiting");
      return;
    }
    console.log("[Privy] SDK ready, starting connect flow. authenticated=", authenticated);
    bridge.clearPendingPrivyConnect();
    bridge.onPrivyConnecting();

    const run = async () => {
      if (!authenticated) {
        console.log("[Privy] calling login()");
        await login();
        console.log("[Privy] login() resolved");
      } else {
        console.log("[Privy] already authenticated, skipping login()");
      }
      await initPrivyWallet();
    };

    run().catch((err) => {
      console.error("[Privy] connect flow failed:", err);
      bridge.onPrivyError(err instanceof Error ? err.message : "Failed to connect with Privy");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, bridge?.pendingPrivyConnect]);

  // Auto-reconnect on page reload — also gated on `ready`.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated || bridge?.walletType === "cartridge") return;
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("ml_privy_session")) return;

    initPrivyWallet(true).catch((err) => {
      console.error("Privy auto-reconnect failed:", err);
      bridge?.onPrivyError(err instanceof Error ? err.message : "Privy auto-reconnect failed");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  // Sync logout when Privy session ends externally.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated && bridge?.walletType === "privy") {
      logout().catch(() => {});
      bridge.onPrivyDisconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, authenticated]);

  return null;
}
