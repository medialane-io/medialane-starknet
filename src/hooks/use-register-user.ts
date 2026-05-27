"use client";

import { useEffect } from "react";
import type { ApiWalletType } from "@medialane/sdk";
import { MEDIALANE_API_KEY } from "@/lib/constants";
import { getMedialaneClient } from "@/lib/medialane-client";

type FrontendWalletType =
  | "argent" | "braavos" | "injected" | "cartridge" | "privy" | null;

function toBackendWalletType(walletType: FrontendWalletType): ApiWalletType {
  if (walletType === "argent") return "ARGENT";
  if (walletType === "braavos") return "BRAAVOS";
  if (walletType === "cartridge") return "CARTRIDGE";
  if (walletType === "privy") return "PRIVY";
  if (walletType === "injected") return "INJECTED";
  return "UNKNOWN";
}

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
    if (!address || !MEDIALANE_API_KEY) return;

    // Key on (address, walletType) so switching connectors (e.g. Argent → Braavos
    // on the same smart-account address) re-registers and the backend can upgrade
    // walletType. Address alone would skip the second registration.
    const sessionKey = `${SESSION_KEY_PREFIX}${address}:${walletType ?? "null"}`;
    if (sessionStorage.getItem(sessionKey)) return;

    getMedialaneClient()
      .api.registerUser({
        walletAddress: address,
        walletType: toBackendWalletType(walletType),
        appSource: "MEDIALANE_DAPP",
        chain: "STARKNET",
      })
      .then(() => sessionStorage.setItem(sessionKey, "1"))
      .catch((error: unknown) => {
        // non-fatal toward the user, but log structured so silent drift in
        // Account creation is observable (Vercel logs / future Sentry).
        console.error("[ml-register] failed", {
          appSource: "MEDIALANE_DAPP",
          walletType: toBackendWalletType(walletType),
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [address, walletType]);
}
