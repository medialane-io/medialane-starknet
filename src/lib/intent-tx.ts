// The one place a backend intent's `calls`/`typedData` gets signed, executed,
// and confirmed. Every write flow (marketplace + launchpad create/mint) goes
// through one of these functions instead of hand-building calldata or SNIP-12
// typed data client-side — see medialane-core/docs/audits/
// 2026-08-04-medialane-starknet-backend-bypass-audit.md (H1).
import type { Call, TypedData } from "starknet";
import type { StarknetVenueSigner, MedialaneClient } from "@medialane/sdk/starknet";

/**
 * Report a submitted tx hash back to the backend so it can settle/hydrate the
 * intent (receipt-derived data, e.g. MINT's assigned id) or reconcile status.
 * Best-effort by design: some intent types (CREATE_COLLECTION, CREATE_TIER)
 * reject confirmation outright (medialane-backend's MARKETPLACE_INTENT_TYPES /
 * RECEIPT_HYDRATED_INTENT_TYPES don't include them) — the wallet has already
 * submitted the tx on-chain either way, so a rejected/failed confirm call must
 * never surface as a user-facing error. The backend's own indexer/factory poll
 * is the reconciliation backstop regardless of whether this call succeeds.
 */
export async function confirmIntentBestEffort(
  client: MedialaneClient,
  intentId: string,
  txHash: string,
): Promise<void> {
  await client.api.confirmIntent(intentId, txHash).catch(() => { /* backend reconciles from chain */ });
}

export interface ExecutePrebuiltIntentOpts {
  /**
   * Submit the tx hash to `PATCH /v1/intents/:id/confirm` after execution.
   * Default true. Set false for intent types the backend route rejects
   * confirmation for (CREATE_COLLECTION, CREATE_TIER — see build.ts's
   * MARKETPLACE_INTENT_TYPES / RECEIPT_HYDRATED_INTENT_TYPES).
   */
  confirm?: boolean;
}

/**
 * For intent types the backend returns fully-populated, unsigned `calls` for
 * (MINT, CREATE_COLLECTION, CREATE_TIER, FULFILL_ORDER, and each item of a
 * CHECKOUT batch): execute directly, then best-effort confirm. A confirm
 * failure never fails the tx — the wallet already submitted it on-chain; the
 * backend's own factory/event poll is the reconciliation backstop.
 */
export async function executePrebuiltIntent(
  signer: StarknetVenueSigner,
  client: MedialaneClient,
  intent: { id: string; calls: Call[] },
  opts: ExecutePrebuiltIntentOpts = {},
): Promise<{ txHash: string }> {
  const { txHash } = await signer.execute(intent.calls);
  if (opts.confirm !== false) {
    await confirmIntentBestEffort(client, intent.id, txHash);
  }
  return { txHash };
}

/**
 * For intent types requiring a SNIP-12 signature first (CREATE_LISTING,
 * MAKE_OFFER, CANCEL_ORDER, COUNTER_OFFER): sign the returned `typedData`,
 * submit it (which populates `calls` server-side), execute the populated
 * calls, then confirm.
 */
export async function signAndExecuteIntent(
  signer: StarknetVenueSigner,
  client: MedialaneClient,
  intent: { id: string; typedData: TypedData },
): Promise<{ txHash: string }> {
  const signature = await signer.signTypedData(intent.typedData);
  const signed = await client.api.submitIntentSignature(intent.id, signature);
  const calls = signed.data.calls as Call[];
  const { txHash } = await signer.execute(calls);
  await confirmIntentBestEffort(client, intent.id, txHash);
  return { txHash };
}
