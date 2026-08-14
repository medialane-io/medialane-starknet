"use client";

import { useMemo } from "react";
import { useAccount } from "@starknet-react/core";
import type { AccountInterface } from "starknet";
import { useNetwork } from "@/components/starknet-provider";
import { assertCorrectNetwork } from "@/lib/wallet-error";

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

            return (target[prop] as (...a: unknown[]) => unknown).apply(target, args as any);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }, [account, chainId, networkConfig.chainId]);
}
