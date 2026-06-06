import type { AccountInterface, Call } from "starknet";
import type { WalletInterface } from "starkzap";

export type WalletMethod = "argent" | "braavos" | "cartridge" | "privy";
export type WalletBackend = "injected" | "embedded";

export type WalletStatus =
  | "idle" // nothing connected
  | "connecting" // user picked a method; backend working
  | "deploying" // embedded only: deploying the Starknet account (Privy)
  | "ready" // connected + (for Privy) deployed
  | "error";

export const METHOD_BACKEND: Record<WalletMethod, WalletBackend> = {
  argent: "injected",
  braavos: "injected",
  cartridge: "embedded",
  privy: "embedded",
};

/** A live signer is either a starknet-react account or a StarkZap wallet. */
export type WalletSigner = AccountInterface | WalletInterface;

export interface WalletState {
  status: WalletStatus;
  backend: WalletBackend | null;
  method: WalletMethod | null;
  address: string | null;
  error: string | null;
}

/** What a host registers with the store so the store can drive it. */
export interface WalletBridge {
  connect: (method: WalletMethod, opts?: { adoptSession?: boolean }) => Promise<void>;
  disconnect: () => void;
}

/** A snapshot a host pushes into the store via ingest(). */
export interface WalletSnapshot {
  status: WalletStatus;
  method: WalletMethod | null;
  address: string | null;
  error: string | null;
}

export type { Call };
