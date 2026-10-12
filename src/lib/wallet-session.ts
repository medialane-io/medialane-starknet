import { normalizeAddress } from "@medialane/sdk";

export type WalletStatus = "connected" | "disconnected" | "connecting" | "reconnecting";

export function nextSessionStep(input: {
  status: WalletStatus;
  address: string | null;
  sessionWallet: string | null;
  sessionLoading: boolean;
  declined: string[];
  signingIn: boolean;
}): "sign-in" | "sign-out" | "none" {
  if (input.sessionLoading || input.signingIn) return "none";
  if (input.status === "disconnected") return input.sessionWallet ? "sign-out" : "none";
  if (input.status !== "connected" || !input.address) return "none";
  const wallet = normalizeAddress("STARKNET", input.address);
  if (input.sessionWallet && normalizeAddress("STARKNET", input.sessionWallet) === wallet) return "none";
  if (input.declined.some((d) => normalizeAddress("STARKNET", d) === wallet)) return "none";
  return "sign-in";
}
