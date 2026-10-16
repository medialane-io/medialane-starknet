import { normalizeAddress } from "@medialane/sdk";

export type WalletStatus = "connected" | "disconnected" | "connecting" | "reconnecting";

export function sessionBelongsTo(sessionWallet: string | null | undefined, address: string | null | undefined): boolean {
  if (!sessionWallet || !address) return false;
  return normalizeAddress("STARKNET", sessionWallet) === normalizeAddress("STARKNET", address);
}

export function nextSessionStep(input: {
  status: WalletStatus;
  address: string | null;
  sessionWallet: string | null;
  sessionLoading: boolean;
  declined: string[];
  signingIn: boolean;
}): "sign-in" | "sign-out" | "none" {
  if (input.sessionLoading || input.signingIn) return "none";
  if (input.status !== "connected" || !input.address) return "none";
  if (sessionBelongsTo(input.sessionWallet, input.address)) return "none";
  if (input.sessionWallet) return "sign-out";
  const wallet = normalizeAddress("STARKNET", input.address);
  if (input.declined.some((d) => normalizeAddress("STARKNET", d) === wallet)) return "none";
  return "sign-in";
}

export async function signOut(fetchImpl: typeof fetch = fetch): Promise<void> {
  await fetchImpl("/api/session", { method: "DELETE" });
}
