import { createStore } from "zustand/vanilla";
import type {
  WalletBackend,
  WalletBridge,
  WalletMethod,
  WalletSigner,
  WalletSnapshot,
  WalletState,
} from "./types";
import { METHOD_BACKEND } from "./types";

interface WalletStore extends WalletState {
  signer: WalletSigner | null;
  /** The Privy User object (email/social identity) — set by the Privy leaf for
   *  display in the connect dialog / account panel. Typed `unknown` to keep the
   *  core store free of the Privy dependency; consumers cast it. */
  privyUser: unknown;
  bridges: Partial<Record<WalletBackend, WalletBridge>>;
  registerBridge: (backend: WalletBackend, bridge: WalletBridge) => void;
  setActive: (method: WalletMethod) => void;
  clearActive: () => void;
  ingest: (backend: WalletBackend, snap: WalletSnapshot, signer?: WalletSigner | null) => void;
  setPrivyUser: (user: unknown) => void;
}

const IDLE: WalletState = {
  status: "idle",
  backend: null,
  method: null,
  address: null,
  error: null,
};

export function createWalletStore() {
  return createStore<WalletStore>((set, get) => ({
    ...IDLE,
    signer: null,
    privyUser: null,
    bridges: {},
    registerBridge: (backend, bridge) =>
      set((st) => ({ bridges: { ...st.bridges, [backend]: bridge } })),
    setActive: (method) => {
      const backend = METHOD_BACKEND[method];
      set({ backend, method, status: "connecting", address: null, error: null, signer: null });
    },
    clearActive: () => set({ ...IDLE, signer: null, privyUser: null }),
    setPrivyUser: (user) => set({ privyUser: user }),
    ingest: (backend, snap, signer) => {
      // GATING: only the active backend may update the store. This is what makes
      // "no merge / no hijack" structural — a non-active backend's events are dropped.
      if (backend !== get().backend) return;
      set({
        status: snap.status,
        method: snap.method,
        address: snap.address,
        error: snap.error,
        ...(signer !== undefined ? { signer } : {}),
      });
    },
  }));
}

export type WalletStoreApi = ReturnType<typeof createWalletStore>;
