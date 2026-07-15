"use client";

import { toast } from "sonner";
import { Loader2, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useClubInfo } from "@/hooks/use-club";

interface ClubOpenToggleProps {
  clubAddress: string;
  open: boolean;
}

/** Owner-only. Reversible pause on new joins — never affects existing members. */
export function ClubOpenToggle({ clubAddress, open }: ClubOpenToggleProps) {
  const { executeAuto, isLoading: isSubmitting } = usePaymasterTransaction();
  const { mutate } = useClubInfo(clubAddress);

  const handleToggle = async () => {
    try {
      const txHash = await executeAuto([{
        contractAddress: clubAddress,
        entrypoint: "set_open",
        calldata: [open ? "0" : "1"],
      }]);
      if (!txHash) throw new Error("Transaction failed — no hash returned");
      await mutate();
      toast.success(open ? "Club closed to new members" : "Club reopened to new members");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update club");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full gap-1.5"
      onClick={handleToggle}
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : open ? (
        <Lock className="h-3.5 w-3.5" />
      ) : (
        <Unlock className="h-3.5 w-3.5" />
      )}
      {open ? "Close to new members" : "Reopen to new members"}
    </Button>
  );
}
