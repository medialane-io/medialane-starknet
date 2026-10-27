"use client";

import { useCallback, useState } from "react";
import { useAccountSession } from "@/components/wallet-session-sync";
import type { InlineMessage } from "@/components/shared/inline-note";
import { useWriteState } from "@/hooks/use-write-state";

export function useSave() {
  const { ensureSignedIn } = useAccountSession();
  const { isProcessing, error, run } = useWriteState();
  const [notice, setMessage] = useState<InlineMessage>(null);

  const save = useCallback(
    async (successText: string, work: () => Promise<unknown>) => {
      setMessage(null);
      const saved = await run(async () => {
        await ensureSignedIn();
        await work();
        return true;
      });
      if (saved) setMessage({ tone: "success", text: successText });
    },
    [ensureSignedIn, run],
  );

  const message: InlineMessage = notice ?? (error ? { tone: "error", text: error } : null);

  return { saving: isProcessing, message, setMessage, save };
}
