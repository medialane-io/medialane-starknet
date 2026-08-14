

import type { Call, TypedData } from "starknet";
import type { StarknetVenueSigner, MedialaneClient } from "@medialane/sdk/starknet";

export async function confirmIntentBestEffort(
  client: MedialaneClient,
  intentId: string,
  txHash: string,
): Promise<void> {
  await client.api.confirmIntent(intentId, txHash).catch(() => {  });
}

export interface ExecutePrebuiltIntentOpts {

  confirm?: boolean;
}

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
