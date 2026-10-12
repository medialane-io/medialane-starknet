"use client";

import { normalizeAddress } from "@medialane/sdk";
import { useWallet } from "@/hooks/use-wallet";
import { useRegisterUser } from "@/hooks/use-register-user";
import { useSession } from "@/hooks/use-session";

export function UserRegistration() {
  const { address, walletType } = useWallet();
  const { session } = useSession();
  const signedInAs =
    address && session?.walletAddress &&
    normalizeAddress("STARKNET", session.walletAddress) === normalizeAddress("STARKNET", address)
      ? address
      : null;
  useRegisterUser(signedInAs, walletType);
  return null;
}
