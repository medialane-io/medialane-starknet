import type { TransactionPhase } from "@medialane/ui";

export function writePhase({ isProcessing, txHash, error }: { isProcessing: boolean; txHash: string | null; error: string | null }): TransactionPhase {
  if (isProcessing) return "submitting";
  if (error) return "error";
  return txHash ? "success" : "idle";
}
