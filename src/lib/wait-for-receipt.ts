import { starknetProvider } from "@/lib/starknet";

/**
 * Wait for a tx to reach on-chain finality and detect reverts.
 * (Moved out of use-paymaster-transaction.ts so the wallet adapters and the
 * paymaster hook can share one copy without a circular import.)
 *
 * Returns:
 *  - `{ ok: true }` on confirmed success
 *  - `{ ok: false, reason }` on on-chain revert (caller surfaces error)
 *  - `{ ok: true, polledOk: false }` on polling failure — tx may still
 *    confirm; consumers can pair with useTxTracker for streaming finality.
 */
export async function waitForReceipt(hash: string): Promise<
  | { ok: true; polledOk?: boolean }
  | { ok: false; reason: string }
> {
  try {
    const receipt = await starknetProvider.waitForTransaction(hash, {
      retryInterval: 3000,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = receipt as any;
    const executionStatus: string | undefined = r?.execution_status ?? r?.status;
    const isReverted =
      executionStatus === "REVERTED" ||
      executionStatus === "REJECTED" ||
      Boolean(r?.revert_reason);
    if (isReverted) {
      const reason: string =
        r?.revert_reason ?? `Transaction reverted (${executionStatus ?? "unknown"})`;
      return { ok: false, reason };
    }
    return { ok: true, polledOk: true };
  } catch (waitErr) {
    // RPC blip / timeout — the tx may still be on-chain, we just couldn't
    // verify it from this client. Optimistic: return ok so consumers don't
    // throw, but log so a missed revert leaves a trail.
    console.warn("[waitForReceipt] receipt polling failed", {
      hash,
      err: waitErr instanceof Error ? waitErr.message : String(waitErr),
    });
    return { ok: true, polledOk: false };
  }
}
