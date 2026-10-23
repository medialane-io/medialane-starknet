"use client";

import { useCallback } from "react";
import type { ApiIntentCreated } from "@medialane/sdk";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { runIntentCalls } from "@medialane/ui";

export function useIntentExecute() {
  const signer = useVenueSigner();
  return useCallback(
    async (create: () => Promise<ApiIntentCreated>): Promise<string> => {
      if (!signer) throw new Error("Wallet not connected");
      const { txHash } = await runIntentCalls(signer, create);
      return txHash;
    },
    [signer],
  );
}
