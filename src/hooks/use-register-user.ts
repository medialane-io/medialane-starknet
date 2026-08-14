"use client";

import { useEffect } from "react";
import { getMedialaneClient } from "@/lib/medialane-client";

type FrontendWalletType =
  | "argent" | "braavos" | "injected" | null;

const SESSION_KEY_PREFIX = "ml_registered_";

export function useRegisterUser(
  address: string | null,
  walletType: FrontendWalletType
) {
  useEffect(() => {
    if (!address) return;

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

        console.error("[ml-register] failed", {
          appSource: "MEDIALANE_STARKNET",
          walletType: walletType ?? "unknown",
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [address, walletType]);
}
