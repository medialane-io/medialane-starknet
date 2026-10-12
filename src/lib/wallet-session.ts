import { normalizeAddress } from "@medialane/sdk";

export type WalletStatus = "connected" | "disconnected" | "connecting" | "reconnecting";

export function nextSessionStep(input: {
  status: WalletStatus;
  address: string | null;
  sessionWallet: string | null;
  sessionLoading: boolean;
  declined: string[];
  signingIn: boolean;
}): "sign-in" | "none" {
  if (input.sessionLoading || input.signingIn) return "none";
  if (input.status !== "connected" || !input.address) return "none";
  const wallet = normalizeAddress("STARKNET", input.address);
  if (input.sessionWallet && normalizeAddress("STARKNET", input.sessionWallet) === wallet) return "none";
  if (input.declined.some((d) => normalizeAddress("STARKNET", d) === wallet)) return "none";
  return "sign-in";
}

export async function signOut(fetchImpl: typeof fetch = fetch): Promise<void> {
  await fetchImpl("/api/session", { method: "DELETE" });
}

type TabStorage = Pick<Storage, "getItem" | "setItem">;
const DECLINED_KEY = "ml_wallet_sign_in_declined";

export function declinedWallets(storage: TabStorage | null): string[] {
  try {
    const raw = storage?.getItem(DECLINED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberDeclined(storage: TabStorage | null, wallet: string): void {
  try {
    const current = declinedWallets(storage);
    if (!current.includes(wallet)) storage?.setItem(DECLINED_KEY, JSON.stringify([...current, wallet]));
  } catch {
    return;
  }
}
