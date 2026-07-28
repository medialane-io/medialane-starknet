"use client";

import type { AccountInterface, Call } from "starknet";
import { waitForReceipt } from "@/lib/wait-for-receipt";

/**
 * Injected (Argent/Braavos): execute through the AVNU paymaster that
 * StarknetConfig wraps around account.execute, then confirm on-chain.
 */
export function makeInjectedExecute(account: AccountInterface) {
  return async (calls: Call[]): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await account.execute(calls as any);
    const hash: string = response.transaction_hash;
    const result = await waitForReceipt(hash);
    if (!result.ok) throw new Error(result.reason);
    return hash;
  };
}
