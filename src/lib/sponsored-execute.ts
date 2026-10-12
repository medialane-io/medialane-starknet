import type { Call } from "starknet";
import { executeSponsored, type TypedDataSigner } from "@medialane/sdk/starknet";

const SPONSORED_INVOKE_PATH = "/api/wallet/sponsored-invoke";

export async function executeWithSponsorship(
  deps: {
    token: () => Promise<string | null>;
    sponsored?: typeof executeSponsored;
    fallback: (calls: Call[]) => Promise<{ txHash: string }>;
  },
  signer: TypedDataSigner,
  calls: Call[],
  intentIds?: string[],
): Promise<{ txHash: string }> {
  if (!intentIds?.length) return deps.fallback(calls);
  const token = await deps.token();
  if (!token) return deps.fallback(calls);
  const result = await (deps.sponsored ?? executeSponsored)(
    { proxyUrl: SPONSORED_INVOKE_PATH, headers: { authorization: `Bearer ${token}` } },
    signer,
    { intentIds },
  );
  return result.status === "sponsored" ? { txHash: result.transactionHash } : deps.fallback(calls);
}
