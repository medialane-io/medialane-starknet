"use client";

import { useEffect } from "react";
import { getMedialaneClient } from "@/lib/medialane-client";
import { readStored, writeStored } from "@/lib/browser-storage";

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
    if (readStored("sessionStorage", sessionKey)) return;

    getMedialaneClient()
      .api.account.registerUser({
        walletAddress: address,
        walletType: walletType ?? undefined,
        chain: "STARKNET",
      })
      .then(() => writeStored("sessionStorage", sessionKey, "1"))
      .catch((error: unknown) => {

        console.error("[ml-register] failed", {
            walletType: walletType ?? "unknown",
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }, [address, walletType]);
}
