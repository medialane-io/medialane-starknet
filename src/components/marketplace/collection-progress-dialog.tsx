"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { fireConfetti } from "@/lib/confetti";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@medialane/ui/dialog";
import { Button } from "@medialane/ui/button";
import { CreationSuccess } from "@medialane/ui";
import {
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { TxStatus } from "@/hooks/use-tx";

export type CollectionStep = "idle" | "processing" | "success" | "error";

interface CollectionProgressDialogProps {
  open: boolean;
  collectionStep: CollectionStep;
  txStatus: TxStatus;
  collectionName: string;
  imagePreview: string | null;
  error: string | null;
  onCreateAnother: () => void;

  createAnotherLabel?: string;

  firstStepLabel?: string;

  mintHref?: string;

  mintLabel?: string;

  viewHref?: string | null;

  caption?: string;
  successFooter?: ReactNode;
}

const makeSteps = (firstStepLabel: string) => [
  {
    label: firstStepLabel,
    done: (_: TxStatus) => true,
    active: (txStatus: TxStatus) => txStatus === "idle",
  },
  {
    label: "Submit transaction",
    done: (txStatus: TxStatus) =>
      txStatus === "confirming" || txStatus === "confirmed",
    active: (txStatus: TxStatus) => txStatus === "submitting",
  },
  {
    label: "Confirm on Starknet",
    done: (txStatus: TxStatus) => txStatus === "confirmed",
    active: (txStatus: TxStatus) => txStatus === "confirming",
  },
];

export function CollectionProgressDialog({
  open,
  collectionStep,
  txStatus,
  collectionName,
  imagePreview,
  error,
  onCreateAnother,
  createAnotherLabel = "Create another",
  firstStepLabel = "Create collection intent",
  mintHref,
  mintLabel,
  successFooter,
  viewHref,
  caption = "Your collection is live",
}: CollectionProgressDialogProps) {
  const confettiFired = useRef(false);

  useEffect(() => {
    if (collectionStep === "success" && !confettiFired.current) {
      confettiFired.current = true;
      fireConfetti();
    }
    if (collectionStep !== "success") {
      confettiFired.current = false;
    }
  }, [collectionStep]);

  const isProcessing = collectionStep === "processing";
  const isSuccess = collectionStep === "success";
  const isError = collectionStep === "error";
  const STEPS = makeSteps(firstStepLabel);

  return (
    <Dialog open={open} modal onOpenChange={(v) => { if (!v && !isProcessing) onCreateAnother(); }}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={isProcessing ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={isProcessing ? (e) => e.preventDefault() : undefined}
        {...(isProcessing ? { hideClose: true } : {})}
      >
        <DialogTitle className="sr-only">
          {isProcessing ? "Creating collection…" : isSuccess ? "Collection created!" : "Creation failed"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isProcessing
            ? "Your collection deployment transaction is being submitted and confirmed on Starknet."
            : isSuccess
            ? "Your collection has been deployed successfully."
            : "Your collection deployment failed."}
        </DialogDescription>

        {isProcessing && (
          <div className="flex flex-col items-center gap-6 py-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>

            <div className="text-center space-y-1">
              <p className="font-semibold text-lg">Deploying collection…</p>
              <p className="text-sm text-muted-foreground">
                {txStatus === "confirming"
                  ? "Waiting for block confirmation"
                  : txStatus === "submitting"
                  ? "Check your wallet to approve the transaction"
                  : "Creating intent onchain"}
              </p>
            </div>

            <div className="w-full space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
              {STEPS.map(({ label, done, active }) => {
                const isDone = done(txStatus);
                const isActive = active(txStatus);
                return (
                  <div key={label} className="flex items-center gap-3">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                    )}
                    <span
                      className={
                        isDone
                          ? "text-sm text-foreground"
                          : isActive
                          ? "text-sm text-primary font-medium"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              {txStatus === "submitting"
                ? "If your wallet extension didn't pop up, click its icon in the toolbar."
                : "This usually takes 10–30 seconds. Do not close this window."}
            </p>
          </div>
        )}

        {isSuccess && (
          <CreationSuccess
            name={collectionName || "Your collection"}
            image={imagePreview}
            caption={caption}
            primary={mintHref ? { href: mintHref, label: mintLabel ?? "Mint tokens" } : undefined}
            secondary={viewHref ? { href: viewHref, label: "View collection" } : undefined}
            onAgain={onCreateAnother}
            againLabel={createAnotherLabel}
          >
            {successFooter}
          </CreationSuccess>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-5 py-2">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-9 w-9 text-destructive" />
            </div>

            <div className="text-center space-y-1">
              <p className="font-bold text-xl">Creation failed</p>
              {error && (
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">{error}</p>
              )}
            </div>

            <Button variant="outline" className="w-full" onClick={onCreateAnother}>
              Try again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
