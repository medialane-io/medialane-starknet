"use client";

import { useEffect } from "react";
import { getMedialaneClient } from "@/lib/medialane-client";

// The connector id IS the wallet-software label the backend stores as
// Identity.provider (lowercased, never gated — 07-identity §II). Send it
// directly; no enum mapping. `null` is omitted and the backend records "unknown".
type FrontendWalletType =
  | "argent" | "braavos" | "injected" | "cartridge" | "privy" | null;

const SESSION_KEY_PREFIX = "ml_registered_";

/**
 * Silently registers a wallet address with the Medialane backend.
 * Fires once per (address, walletType) per browser session — never adds
 * user-visible friction. Errors are swallowed — registration must never
 * block the user.
 */
export function useRegisterUser(
  address: string | null,
  walletType: FrontendWalletType
) {
  useEffect(() => {
    if (!address) return;

    // Key on (address, walletType) so switching connectors (e.g. Argent → Braavos
    // on the same smart-account address) re-registers and the backend can upgrade
    // walletType. Address alone would skip the second registration.
    const sessionKey = `${SESSION_KEY_PREFIX}${address}:${walletType ?? "null"}`;
    if (sessionStorage.getItem(sessionKey)) return;

    getMedialaneClient()
      .api.registerUser({
        walletAddress: address,
        walletType: walletType ?? undefined,
        appSource: "MEDIALANE_STARKNET",
        chain: "STARKNET",
      })
      .then(() => sessionStorage.setItem(sessionKey, "1"))
      .catch((error: unknown) => {
        // non-fatal toward the user, but log structured so silent drift in
        // Account creation is observable (Vercel logs / future Sentry).
        console.error("[ml-register] failed", {
          appSource: "MEDIALANE_STARKNET",
          walletType: walletType ?? "unknown",
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [address, walletType]);
}
