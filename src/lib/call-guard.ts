import { normalizeAddress } from "@medialane/sdk";
import type { Call } from "starknet";

export function assertNoSelfCalls(calls: Call[], account: string): void {
  const self = normalizeAddress("STARKNET", account);
  if (calls.some((call) => normalizeAddress("STARKNET", call.contractAddress) === self)) {
    throw new Error("This transaction targets your own wallet account, so it was not sent.");
  }
}
