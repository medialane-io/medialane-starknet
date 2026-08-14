"use client";

import {
  requestSiwsToken as sdkRequestSiwsToken,
  storeSiwsToken,
  isSiwsTokenValid,
  getSiwsStorageKey,
  normalizeSiwsSignature,
  type SiwsSigner,
  type RequestSiwsTokenArgs as SdkRequestSiwsTokenArgs,
} from "@medialane/sdk/starknet";
import { MEDIALANE_BACKEND_URL } from "@/lib/constants";

const STORAGE_PREFIX = "ml_siws_";

export type { SiwsSigner };
export type RequestSiwsTokenArgs = Omit<SdkRequestSiwsTokenArgs, "backendUrl">;
export { storeSiwsToken, isSiwsTokenValid, getSiwsStorageKey, normalizeSiwsSignature };

export function getStoredSiwsToken(address: string): string | null {
  if (typeof window === "undefined") return null;
  const key = getSiwsStorageKey(address);
  const token = localStorage.getItem(key);
  if (isSiwsTokenValid(token)) return token;

  const legacyKey = `${STORAGE_PREFIX}${address}`;
  const legacyToken = legacyKey === key ? null : localStorage.getItem(legacyKey);
  if (isSiwsTokenValid(legacyToken)) {
    localStorage.setItem(key, legacyToken);
    localStorage.removeItem(legacyKey);
    return legacyToken;
  }

  localStorage.removeItem(key);
  if (legacyKey !== key) localStorage.removeItem(legacyKey);
  return null;
}

export function getAnyStoredSiwsToken(): string | null {
  if (typeof window === "undefined") return null;

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    const token = localStorage.getItem(key);
    if (isSiwsTokenValid(token)) return token;
    localStorage.removeItem(key);
  }

  return null;
}

export function requestSiwsToken(args: RequestSiwsTokenArgs): Promise<string> {
  return sdkRequestSiwsToken({ ...args, backendUrl: MEDIALANE_BACKEND_URL });
}
