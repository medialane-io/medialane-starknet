"use client";

import { getAnyStoredSiwsToken } from "@/lib/siws-client";

export function withSiwsAuth(
  tokenOrInit?: string | null | RequestInit,
  init?: RequestInit,
): RequestInit {
  let token: string | null;
  let options: RequestInit | undefined;

  if (typeof tokenOrInit === "string" || tokenOrInit === null) {
    token = tokenOrInit ?? null;
    options = init;
  } else {
    token = getAnyStoredSiwsToken();
    options = tokenOrInit;
  }

  if (!token) return options ?? {};
  return {
    ...options,
    headers: {
      ...(options?.headers as Record<string, string> ?? {}),
      Authorization: `Bearer ${token}`,
    },
  };
}
