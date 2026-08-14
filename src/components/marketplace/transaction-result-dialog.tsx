"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MarketplaceSuccessState,
  MarketplaceErrorState,
} from "@/components/marketplace/marketplace-dialog-primitives";
import { EXPLORER_URL } from "@/lib/constants";
import { fireConfetti } from "@/lib/confetti";

export type TxResult =
  | {
      status: "success";
      title: string;
      description: ReactNode;
      txHash?: string | null;
      tokenImage?: string | null;
      name?: string;
    }
  | {
      status: "error";
      title: string;
      description: ReactNode;
      error?: string | null;
      txHash?: string | null;
      tokenImage?: string | null;
      name?: string;
      onRetry?: () => void;
    };

interface TransactionResultDialogProps {
  result: TxResult | null;

  onClose: () => void;

  confettiOnSuccess?: boolean;

  footer?: ReactNode;
}

export function TransactionResultDialog({
  result,
  onClose,
  confettiOnSuccess = true,
  footer,
}: TransactionResultDialogProps) {
  const confettiFired = useRef(false);

  useEffect(() => {
    if (result?.status === "success" && confettiOnSuccess && !confettiFired.current) {
      confettiFired.current = true;
      fireConfetti();
    }
    if (!result) confettiFired.current = false;
  }, [result, confettiOnSuccess]);

  return (
    <Dialog open={!!result} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-6px)] sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl">
        <DialogTitle className="sr-only">
          {result?.status === "error" ? "Transaction failed" : "Transaction complete"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {typeof result?.title === "string" ? result.title : "Transaction result"}
        </DialogDescription>
        {result?.status === "success" ? (
          <MarketplaceSuccessState
            tokenImage={result.tokenImage}
            name={result.name ?? "Asset"}
            title={result.title}
            description={result.description}
            txHash={result.txHash}
            explorerUrl={EXPLORER_URL}
            onDone={onClose}
            footer={footer}
          />
        ) : result?.status === "error" ? (
          <MarketplaceErrorState
            tokenImage={result.tokenImage}
            name={result.name ?? "Asset"}
            title={result.title}
            description={result.description}
            error={result.error}
            txHash={result.txHash}
            explorerUrl={EXPLORER_URL}
            onRetry={result.onRetry}
            onDone={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
