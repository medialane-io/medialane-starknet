import type { Call } from "starknet";
import { executeSponsored, type TypedDataSigner } from "@medialane/sdk/starknet";

const SPONSORED_INVOKE_PATH = "/api/proxy/v1/paymaster/invoke";

export async function executeWithSponsorship(
  deps: {
    signedIn: () => Promise<boolean>;
    sponsored?: typeof executeSponsored;
    fallback: (calls: Call[]) => Promise<{ txHash: string }>;
  },
  signer: TypedDataSigner,
  calls: Call[],
  intentIds?: string[],
): Promise<{ txHash: string }> {
  if (!intentIds?.length) return deps.fallback(calls);
  if (!(await deps.signedIn())) return deps.fallback(calls);
  const result = await (deps.sponsored ?? executeSponsored)({ proxyUrl: SPONSORED_INVOKE_PATH }, signer, { intentIds });
  return result.status === "sponsored" ? { txHash: result.transactionHash } : deps.fallback(calls);
}
