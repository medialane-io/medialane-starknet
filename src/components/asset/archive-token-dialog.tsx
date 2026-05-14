"use client";

import { useState } from "react";
import { Archive, AlertTriangle } from "lucide-react";
import { Contract } from "starknet";
import { starknetProvider } from "@/lib/starknet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { COLLECTION_721_CONTRACT } from "@/lib/constants";
import { ipCollectionAbi } from "@/abis/ip_collection";
import { toast } from "sonner";

interface ArchiveTokenDialogProps {
  /** On-chain numeric collection ID (decimal string). */
  collectionId: string;
  /** Numeric token ID within the collection (decimal string). */
  tokenId: string;
  onArchived?: () => void;
}

/**
 * Permanent token archive flow against the audited MIP IPCollection.
 * Archive is non-destructive — the legal record (creator, mint date, URI)
 * stays readable forever, but the token can no longer be transferred or sold.
 */
export function ArchiveTokenDialog({ collectionId, tokenId, onArchived }: ArchiveTokenDialogProps) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { executeAuto } = usePaymasterTransaction();

  const handleArchive = async () => {
    if (!acknowledged) return;
    setSubmitting(true);
    try {
      const tokenKey = `${collectionId}:${tokenId}`;
      // Contract.populate serializes the Cairo ByteArray correctly without manual layout.
      const contract = new Contract({
        abi: ipCollectionAbi as any,
        address: COLLECTION_721_CONTRACT,
        providerOrAccount: starknetProvider,
      });
      const call = contract.populate("archive", [tokenKey]);
      await executeAuto([call]);
      toast.success("Token archived", {
        description: "The legal record is preserved on-chain forever.",
      });
      setOpen(false);
      setAcknowledged(false);
      onArchived?.();
    } catch (err) {
      toast.error("Archive failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAcknowledged(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Archive className="h-4 w-4" /> Archive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" /> Archive this token?
          </DialogTitle>
          <DialogDescription>Archiving is permanent and cannot be undone.</DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-xs flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>
              <strong>Archive is not burn.</strong> The token is not destroyed.
            </p>
            <p>After archiving:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li>The token can no longer be transferred or sold.</li>
              <li>The creator, mint date, and metadata stay readable on-chain forever (Berne Convention).</li>
              <li>This action cannot be reversed.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Checkbox
            id="archive-ack"
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
          />
          <Label htmlFor="archive-ack" className="text-sm">
            I understand this is permanent.
          </Label>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleArchive} disabled={!acknowledged || submitting}>
            {submitting ? "Archiving…" : "Archive token"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
