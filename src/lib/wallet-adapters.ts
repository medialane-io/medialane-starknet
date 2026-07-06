"use client";

import type { AccountInterface, Call } from "starknet";
import type { WalletInterface } from "starkzap";
import { waitForReceipt } from "@/lib/wait-for-receipt";

/**
 * Injected (Argent/Braavos): execute through the AVNU paymaster that
 * StarknetConfig wraps around account.execute, then confirm on-chain.
 * Mirrors the non-StarkZap branch of the old executeAuto.
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

/**
 * StarkZap (Cartridge/Privy): the SDK handles gas via its configured
 * sponsorship; it waits internally. Mirrors the szWallet branch of the
 * old executeAuto (no feeMode arg — sponsorship is set on the SDK).
 */
export function makeStarkzapExecute(wallet: WalletInterface) {
  return async (calls: Call[]): Promise<string> => {
    const tx = await wallet.execute(calls);
    await tx.wait();
    return tx.hash;
  };
}
