export type WalletSessionType =
  | "argent"
  | "braavos"
  | "injected"
  | "cartridge";

export type WalletSessionStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "error";

export interface WalletSession {
  status: WalletSessionStatus;
  walletType: WalletSessionType | null;
  address: string | null;
  error: string | null;
}

export const IDLE_WALLET_SESSION: WalletSession = {
  status: "idle",
  walletType: null,
  address: null,
  error: null,
};

export function walletConnecting(walletType: WalletSessionType): WalletSession {
  return { status: "connecting", walletType, address: null, error: null };
}

export function walletReady(walletType: WalletSessionType, address: string): WalletSession {
  return { status: "ready", walletType, address, error: null };
}

export function walletError(walletType: WalletSessionType | null, error: string): WalletSession {
  return { status: "error", walletType, address: null, error };
}

export function isWalletSessionBusy(session: WalletSession): boolean {
  return session.status === "connecting";
}
