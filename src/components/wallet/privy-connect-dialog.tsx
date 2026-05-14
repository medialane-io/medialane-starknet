"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { isPrivyConnectInFlight } from "@/lib/wallet-session";

type Phase = "authenticating" | "preparing-wallet" | "deploying-account" | "ready";

const STEPS: { key: Phase; label: string; description: string }[] = [
  { key: "authenticating", label: "Authenticating", description: "Sign in with email or social" },
  { key: "preparing-wallet", label: "Preparing wallet", description: "Creating your Starknet keys" },
  { key: "deploying-account", label: "Deploying account", description: "Sponsored by AVNU — no gas to pay" },
  { key: "ready", label: "Ready", description: "You're connected" },
];

function phaseIndex(status: string): number {
  switch (status) {
    case "authenticating": return 0;
    case "preparing-wallet": return 1;
    case "deploying-account": return 2;
    case "ready": return 3;
    default: return -1;
  }
}

export function PrivyConnectDialog() {
  const { session, connectPrivy } = useStarkZapWallet();
  const [open, setOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (isPrivyConnectInFlight(session)) {
      setOpen(true);
      return;
    }
    if (session.walletType === "privy" && session.status === "ready") {
      setOpen(true);
      const t = setTimeout(() => setOpen(false), 1200);
      return () => clearTimeout(t);
    }
    if (session.walletType === "privy" && session.status === "error") {
      setOpen(true);
      return;
    }
    setOpen(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.status, session.walletType]);

  const isError = session.walletType === "privy" && session.status === "error";
  const currentIndex = phaseIndex(session.status);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await connectPrivy();
    } finally {
      setIsRetrying(false);
    }
  };

  const allowClose = isError || session.status === "ready" || session.status === "idle";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !allowClose) return;
        setOpen(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isError ? "Connection failed" : session.status === "ready" ? "You're in" : "Connecting your wallet"}
          </DialogTitle>
          <DialogDescription>
            {isError
              ? (session.error ?? "Something went wrong while connecting.")
              : "We'll create and deploy your Starknet account. Gas is sponsored — you don't need to pay."}
          </DialogDescription>
        </DialogHeader>

        {!isError && (
          <ol className="space-y-3 py-2">
            {STEPS.map((step, idx) => {
              const isDone = currentIndex > idx || (session.status === "ready" && idx === STEPS.length - 1);
              const isActive = currentIndex === idx;
              return (
                <li key={step.key} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : isActive
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-3 w-3" />
                    ) : isActive ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                  </span>
                  <div>
                    <div
                      className={`text-sm font-medium ${
                        isActive || isDone ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {isError && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <span className="text-destructive-foreground/90">{session.error ?? "Unknown error"}</span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button onClick={handleRetry} disabled={isRetrying}>
                {isRetrying ? "Retrying…" : "Try again"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
