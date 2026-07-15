"use client";

import { toast } from "sonner";
import { Loader2, CheckCircle2, Ban, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useClubMembership } from "@/hooks/use-club";
import { rewardToast } from "@/lib/reward-toast";
import { encodeU256 } from "@/lib/cairo-calldata";
import { getListableTokens } from "@medialane/sdk";

interface ClubJoinButtonProps {
  clubAddress: string;
  entryFee: string;
  paymentToken: string | null;
  open: boolean;
}

export function ClubJoinButton({ clubAddress, entryFee, paymentToken, open }: ClubJoinButtonProps) {
  const { address, isConnected } = useWallet();
  const { isMember, isLoading, mutate } = useClubMembership(clubAddress, address ?? null);
  const { executeAuto, isLoading: isSubmitting } = usePaymasterTransaction();

  const feeBigInt = BigInt(entryFee || "0");
  const isPaid = feeBigInt > 0n && !!paymentToken;
  const knownToken = isPaid
    ? getListableTokens().find((t) => t.address.toLowerCase() === paymentToken!.toLowerCase())
    : null;
  const feeDisplay = isPaid && knownToken
    ? `${Number((feeBigInt * 10000n) / BigInt(10 ** knownToken.decimals)) / 10000} ${knownToken.symbol}`
    : null;

  const handleJoin = async () => {
    if (!isConnected || !address) {
      toast.error("Connect a wallet first");
      return;
    }
    if (isPaid && !knownToken) {
      toast.error("Unknown payment token — cannot proceed");
      return;
    }
    try {
      // Join = mint a membership card on the club collection. A paid club
      // pulls the entry fee during mint, so approve the collection as
      // spender first.
      const calls = [];
      if (isPaid) {
        const [low, high] = encodeU256(feeBigInt);
        calls.push({
          contractAddress: paymentToken!,
          entrypoint: "approve",
          calldata: [clubAddress, low, high],
        });
      }
      calls.push({
        contractAddress: clubAddress,
        entrypoint: "mint",
        calldata: [address],
      });

      const txHash = await executeAuto(calls);
      if (!txHash) throw new Error("Transaction failed — no hash returned");

      rewardToast("join_club");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to join club");
    }
  };

  if (!open) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Ban className="h-3.5 w-3.5 shrink-0" />
        Not open for new members
      </div>
    );
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="w-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        Checking membership…
      </Button>
    );
  }

  if (isMember) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-brand-indigo font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        You&apos;re a member
      </div>
    );
  }

  return (
    <Button
      size="sm"
      className="w-full gap-1.5 bg-brand-indigo hover:brightness-110 text-white"
      onClick={handleJoin}
      disabled={isSubmitting}
    >
      {isSubmitting ? (
        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Joining…</>
      ) : (
        <><Users className="h-3.5 w-3.5" />{feeDisplay ? `Join for ${feeDisplay}` : "Join free"}</>
      )}
    </Button>
  );
}
