"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { popCalls } from "@medialane/sdk/starknet";
import { describeError } from "@medialane/ui";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";

interface PopBurnButtonProps {
  collectionAddress: string;
  tokenId: string;
}

/** Lets a holder permanently remove their own credential from their wallet. */
export function PopBurnButton({ collectionAddress, tokenId }: PopBurnButtonProps) {
  const { execute } = useWallet();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) return <p className="text-xs text-muted-foreground">Removed from your wallet.</p>;

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirming(true)}>
        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
        Remove from my wallet
      </Button>
    );
  }

  const handleBurn = async () => {
    setBusy(true);
    setError(null);
    try {
      await execute([popCalls.burn(collectionAddress, tokenId)]);
      setDone(true);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">
        This permanently destroys this credential. You won&apos;t be able to claim it again.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" disabled={busy} onClick={() => setConfirming(false)}>
          Keep it
        </Button>
        <Button variant="destructive" size="sm" className="flex-1" disabled={busy} onClick={() => void handleBurn()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Remove"}
        </Button>
      </div>
    </div>
  );
}
