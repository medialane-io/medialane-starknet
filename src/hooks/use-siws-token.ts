"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import type { TypedData } from "starknet";
import { MEDIALANE_BACKEND_URL } from "@/lib/constants";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";

const STORAGE_PREFIX = "ml_siws_";

function decodeBase64url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  return atob(base64 + padding);
}

function getStoredToken(address: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${address}`);
    if (!raw || !raw.startsWith("siws_")) return null;
    const inner = raw.slice(5);
    const dot = inner.lastIndexOf(".");
    if (dot === -1) return null;
    const data = JSON.parse(decodeBase64url(inner.slice(0, dot))) as { exp?: number };
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) {
      localStorage.removeItem(`${STORAGE_PREFIX}${address}`);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

function storeToken(address: string, token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(`${STORAGE_PREFIX}${address}`, token);
  }
}

function normalizeSignature(signature: unknown): string[] {
  if (Array.isArray(signature)) {
    return signature.map(String);
  }

  if (signature && typeof signature === "object") {
    const { r, s } = signature as { r?: unknown; s?: unknown };
    if (r !== undefined && s !== undefined) {
      return [String(r), String(s)];
    }
  }

  return [String(signature)];
}

export function useSiwsToken() {
  const { account, address } = useAccount();
  const {
    wallet: starkZapWallet,
    address: starkZapAddress,
  } = useStarkZapWallet();
  const activeAddress = starkZapAddress ?? address;
  const [token, setToken] = useState<string | null>(null);

  // Sync stored token on address change (handles wallet switch / disconnect)
  useEffect(() => {
    if (!activeAddress) {
      setToken(null);
      return;
    }
    setToken(getStoredToken(activeAddress));
  }, [activeAddress]);

  const signIn = useCallback(async (): Promise<string | null> => {
    if (!activeAddress) return null;

    const signer = starkZapWallet ?? account;
    if (!signer) return null;

    try {
      // Step 1: Get nonce + SNIP-12 typed data from backend (no API key needed)
      const nonceRes = await fetch(`${MEDIALANE_BACKEND_URL}/v1/auth/siws/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: activeAddress }),
      });
      if (!nonceRes.ok) return null;
      const { nonce, typedData } = await nonceRes.json() as {
        nonce: string;
        typedData: TypedData;
      };

      // Step 2: Prompt wallet to sign — user will see the typed data popup
      const signature = await signer.signMessage(typedData);
      const sig = normalizeSignature(signature);

      // Step 3: Backend verifies the signature and issues a 24h siws_ token
      const verifyRes = await fetch(`${MEDIALANE_BACKEND_URL}/v1/auth/siws/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: activeAddress, nonce, signature: sig }),
      });
      if (!verifyRes.ok) return null;
      const { token: newToken } = await verifyRes.json() as { token: string };

      storeToken(activeAddress, newToken);
      setToken(newToken);
      return newToken;
    } catch {
      return null;
    }
  }, [activeAddress, starkZapWallet, account]);

  /**
   * Returns an existing valid token or triggers the SIWS sign-in flow.
   * Call this inside SWR fetchers or mutation handlers, not at render time.
   */
  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!activeAddress) return null;

    const existing = getStoredToken(activeAddress);
    if (existing) {
      setToken(existing);
      return existing;
    }
    return signIn();
  }, [activeAddress, signIn]);

  return { token, signIn, getValidToken };
}
