"use client";

import { useMemo } from "react";
import { useAccount } from "@starknet-react/core";
import type { AccountInterface } from "starknet";
import { NETWORK } from "@/components/starknet-provider";
import { assertCorrectNetwork } from "@medialane/ui";

export function useSigner(): AccountInterface | undefined {
  const { account, chainId } = useAccount();

  return useMemo(() => {
    if (!account) return undefined;
    return new Proxy(account, {
      get(target, prop, receiver) {
        if (prop === "execute" || prop === "signMessage") {
          return (...args: unknown[]) => {
            assertCorrectNetwork(chainId, NETWORK.chainId);

            return (target[prop] as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }, [account, chainId]);
}
