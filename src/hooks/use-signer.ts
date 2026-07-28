"use client";

import { useAccount } from "@starknet-react/core";
import type { AccountInterface } from "starknet";

/**
 * The single place that resolves "the account that signs for the connected
 * wallet." Trivial today (there's only one wallet rail — injected), but
 * kept as one hook rather than `useAccount().account as AccountInterface`
 * repeated at each call site: every call site duplicating wallet-resolution
 * logic is exactly how the multi-rail version of this (Cartridge, removed)
 * ended up with subtly different behavior in different files.
 */
export function useSigner(): AccountInterface | undefined {
  const { account } = useAccount();
  return account as AccountInterface | undefined;
}
