import { starknetProvider } from "@/lib/starknet";

export async function waitForReceipt(hash: string): Promise<
  | { ok: true; polledOk?: boolean }
  | { ok: false; reason: string }
> {
  try {
    const receipt = await starknetProvider.waitForTransaction(hash, {
      retryInterval: 3000,
    });

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

    console.warn("[waitForReceipt] receipt polling failed", {
      hash,
      err: waitErr instanceof Error ? waitErr.message : String(waitErr),
    });
    return { ok: true, polledOk: false };
  }
}
