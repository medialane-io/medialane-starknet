"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useRegisterUser } from "@/hooks/use-register-user";

/**
 * Invisible component mounted once in Providers.
 * Fires silent user registration whenever a wallet address resolves.
 * Keeping this out of useWallet preserves the hook as a pure identity read.
 */
export function UserRegistration() {
  const { address, walletType } = useWallet();
  useRegisterUser(address ?? null, walletType);
  return null;
}
