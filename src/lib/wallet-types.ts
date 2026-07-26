import type { Call } from "starknet";

export type WalletType = "argent" | "braavos" | "injected" | "cartridge";

/** The single active wallet. Built once at connect time; routing is structural. */
export interface ActiveWallet {
  type: WalletType;
  address: string;
  /** Normalized execution → returns the tx hash after on-chain confirmation. */
  execute: (calls: Call[]) => Promise<string>;
}

/** localStorage key recording the one wallet the user last explicitly chose. */
export const WALLET_STORAGE_KEY = "ml_wallet";

export type PersistedWalletType = "argent" | "braavos" | "cartridge";

export function readPersistedWallet(): PersistedWalletType | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(WALLET_STORAGE_KEY);
  return v === "argent" || v === "braavos" || v === "cartridge" ? v : null;
}

export function writePersistedWallet(type: PersistedWalletType): void {
  if (typeof window !== "undefined") window.localStorage.setItem(WALLET_STORAGE_KEY, type);
}

export function clearPersistedWallet(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(WALLET_STORAGE_KEY);
    window.localStorage.removeItem("ml_privy_session"); // retire an old flag from a prior Privy build
  }
}
