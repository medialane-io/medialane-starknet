export type WalletType = "argent" | "braavos" | "injected";

export interface ActiveWallet {
  type: WalletType;
  address: string;
}
