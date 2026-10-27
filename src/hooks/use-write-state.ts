"use client";

import { useState, useCallback } from "react";
import { describeError } from "@medialane/ui";

export function useWriteState() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setTxHash(null);
    setError(null);
    setIsProcessing(false);
  }, []);

  const run = useCallback(async <T,>(work: () => Promise<T>, onError?: (err: unknown) => void): Promise<T | undefined> => {
    setIsProcessing(true);
    setError(null);
    try {
      return await work();
    } catch (err) {
      onError?.(err);
      setError(describeError(err).message);
      return undefined;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    isProcessing,
    txHash,
    setTxHash,
    error,
    setError,
    isConfirmed: !isProcessing && !!txHash && !error,
    isTerminalError: !isProcessing && !!txHash && !!error,
    run,
    resetState,
  };
}
