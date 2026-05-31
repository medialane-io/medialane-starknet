"use client";

import { useUnifiedWallet } from "./use-unified-wallet";

/**
 * Normalized wallet hook — single interface across all wallet types.
 * Use this when a component only needs to know WHO the user is.
 *
 * For signing, session keys, paymaster, or execution — use the
 * platform-specific hooks (useUnifiedWallet, usePaymasterTransaction, etc.).
 *
 * Registration side-effect lives in <UserRegistration /> mounted in Providers,
 * not here — this hook stays a pure identity read.
 */
export function useWallet() {
  const { address, isConnected, isConnecting, walletType } = useUnifiedWallet();
  return {
    address: address ?? null,
    isConnected,
    isConnecting,
    walletType,
  };
}
