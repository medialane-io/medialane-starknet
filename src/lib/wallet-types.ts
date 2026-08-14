import type { Call } from "starknet";

export type WalletType = "argent" | "braavos" | "injected";

export interface ActiveWallet {
  type: WalletType;
  address: string;

  execute: (calls: Call[]) => Promise<string>;
}
