import type { Call } from "starknet";

export type WalletType = "argent" | "braavos" | "injected";

/** The single active wallet. Built once at connect time; routing is structural. */
export interface ActiveWallet {
  type: WalletType;
  address: string;
  /** Normalized execution → returns the tx hash after on-chain confirmation. */
  execute: (calls: Call[]) => Promise<string>;
}
