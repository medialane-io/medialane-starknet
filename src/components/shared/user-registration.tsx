"use client";

import { useWallet } from "@/hooks/use-wallet";
import { useRegisterUser } from "@/hooks/use-register-user";

export function UserRegistration() {
  const { address, walletType } = useWallet();
  useRegisterUser(address ?? null, walletType);
  return null;
}
