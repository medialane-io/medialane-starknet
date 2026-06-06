"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { readLastChoice } from "./persistence";
import type { WalletStoreApi } from "./store";

const isPrivyRoute = (p: string) =>
  p === "/mint" || p === "/airdrop" || p.startsWith("/br/");

/**
 * Privy reconnect fires ONLY when the last explicit choice was Privy AND we're on
 * a Privy route (/airdrop, /mint, /br/*). Injected reconnect is handled natively by
 * starknet-react autoConnect (not here). Off these routes Privy is never loaded —
 * the marketplace/launchpad stay a clean, Privy-free, hijack-free surface.
 */
export function usePrivyReconnect(store: WalletStoreApi, onWantPrivy: () => void) {
  const pathname = usePathname();
  useEffect(() => {
    if (readLastChoice() !== "privy") return;
    if (!isPrivyRoute(pathname)) return;
    if (store.getState().backend) return; // something already active — don't override
    store.getState().setActive("privy");
    onWantPrivy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
