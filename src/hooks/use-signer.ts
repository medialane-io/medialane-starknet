"use client";

import { useMemo } from "react";
import { useAccount } from "@starknet-react/core";
import type { AccountInterface } from "starknet";
import { useNetwork } from "@/components/starknet-provider";
import { assertCorrectNetwork } from "@/lib/wallet-error";

/**
 * The single place that resolves "the account that signs for the connected
 * wallet." Trivial today (there's only one wallet rail — injected), but
 * kept as one hook rather than `useAccount().account as AccountInterface`
 * repeated at each call site: every call site duplicating wallet-resolution
 * logic is exactly how the multi-rail version of this (Cartridge, removed)
 * ended up with subtly different behavior in different files.
 *
 * `execute`/`signMessage` are wrapped to assert the wallet is actually on
 * Starknet Mainnet first — every consumer gets this for free instead of
 * each hook re-deriving it (or, as happened before this existed, not
 * checking at all and letting a wrong-network wallet reach its own tx
 * builder, which fails with a confusing, unrelated-looking error).
 */
export function useSigner(): AccountInterface | undefined {
  const { account, chainId } = useAccount();
  const { networkConfig } = useNetwork();

  return useMemo(() => {
    if (!account) return undefined;
    return new Proxy(account, {
      get(target, prop, receiver) {
        if (prop === "execute" || prop === "signMessage") {
          return (...args: unknown[]) => {
            assertCorrectNetwork(chainId, networkConfig.chainId);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (target[prop] as (...a: unknown[]) => unknown).apply(target, args as any);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }, [account, chainId, networkConfig.chainId]);
}
