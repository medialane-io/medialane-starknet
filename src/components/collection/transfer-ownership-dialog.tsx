"use client";

import { useState } from "react";
import { UserRoundCog } from "lucide-react";
import { Button } from "@medialane/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@medialane/ui/dialog";
import { Input } from "@medialane/ui/input";
import { Label } from "@medialane/ui/label";
import { useWallet } from "@/hooks/use-wallet";
import { normalizeAddress } from "@medialane/sdk";
import { MarketplaceSuccessState } from "@medialane/ui";
import { EXPLORER_URL } from "@/lib/constants";
import { useIntentExecute } from "@/hooks/use-intent-execute";
import { getMedialaneClient } from "@/lib/medialane-client";

interface TransferOwnershipDialogProps {

  collectionId: string;
  currentOwner: string;
  onTransferred?: () => void;
}

export function TransferCollectionOwnershipDialog({
  collectionId,
  currentOwner,
  onTransferred,
}: TransferOwnershipDialogProps) {
  const [open, setOpen] = useState(false);
  const [newOwner, setNewOwner] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [transferredTo, setTransferredTo] = useState<string>("");
  const runIntent = useIntentExecute();
  const { address } = useWallet();

  const trimmed = newOwner.trim();
  const isValid = /^0x[0-9a-fA-F]{1,64}$/.test(trimmed);
  const wouldNoop =
    isValid && normalizeAddress("STARKNET", trimmed) === normalizeAddress("STARKNET", currentOwner);

  const handleTransfer = async () => {
    setTransferError(null);
    if (!isValid || wouldNoop) return;
    setSubmitting(true);
    try {
      const hash = await runIntent(() =>
        getMedialaneClient().api.intents.create("transfer-collection-ownership", { owner: address!, collectionId: String(collectionId), newOwner: trimmed }),
      );
      setTxHash(hash);
      setTransferredTo(trimmed);
      setDone(true);
      onTransferred?.();
    } catch (err) {
      console.error("ownership transfer failed", err);
      setTransferError("The transfer could not be completed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setDone(false); setNewOwner(""); setTxHash(null); setTransferredTo(""); }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <UserRoundCog className="h-4 w-4" /> Transfer ownership
        </Button>
      </DialogTrigger>
      <DialogContent>
        {done ? (
          <MarketplaceSuccessState
            name="Collection"
            title="Ownership transferred"
            description={`New owner: ${transferredTo.slice(0, 6)}…${transferredTo.slice(-4)}`}
            txHash={txHash}
            explorerUrl={EXPLORER_URL}
            onDone={() => {
              setOpen(false);
              setDone(false);
              setNewOwner("");
              setTxHash(null);
              setTransferredTo("");
            }}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Transfer collection ownership</DialogTitle>
              <DialogDescription>
                The new owner will control minting and future ownership transfers
                for this collection. Existing tokens are unaffected.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="new-owner">New owner address</Label>
              <Input
                id="new-owner"
                placeholder="0x…"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="tabular-nums text-sm"
                spellCheck={false}
                autoComplete="off"
              />
              {trimmed && !isValid && (
                <p className="text-xs text-red-500">Not a valid Starknet address.</p>
              )}
              {wouldNoop && (
                <p className="text-xs text-amber-500">
                  This is already the current owner.
                </p>
              )}
            </div>

            {transferError && <p role="alert" className="text-sm text-destructive">{transferError}</p>}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransfer}
                disabled={!isValid || wouldNoop || submitting}
              >
                {submitting ? "Transferring…" : "Transfer"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
