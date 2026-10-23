"use client";

import { useEffect, useState } from "react";
import { popClaimState, type PopClaimInfo } from "@medialane/sdk/starknet";
import { claimProofFor, describeError, usePopClaimStatus } from "@medialane/ui";

import { RewardEarned } from "@/lib/reward-earned";
import { Loader2, Award } from "lucide-react";
import { Button } from "@medialane/ui/button";
import { useWallet } from "@/hooks/use-wallet";

import { TransactionResultDialog, type TxResult } from "@/components/marketplace/transaction-result-dialog";
import { useIntentExecute } from "@/hooks/use-intent-execute";
import { getMedialaneClient } from "@/lib/medialane-client";

interface PopClaimButtonProps {
  collectionAddress: string;
}

export function PopClaimButton({ collectionAddress }: PopClaimButtonProps) {
  const { address } = useWallet();
  const runIntent = useIntentExecute();
  const { hasClaimed, mutate } = usePopClaimStatus(collectionAddress, address ?? null);
  const [result, setResult] = useState<TxResult | null>(null);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [proof, setProof] = useState<string[] | null>(null);
  const [info, setInfo] = useState<PopClaimInfo | null>(null);

  useEffect(() => {
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    setProof(claimProofFor(storage, collectionAddress, window.location.hash));
    getMedialaneClient().api.chainReads.popClaimInfo(collectionAddress)
      .then(setInfo)
      .catch(() => setInfo(null));
  }, [collectionAddress]);

  const state = popClaimState({
    hasClaimed,
    proof,
    wallet: address ?? null,
    info: info && { ...info, now: Math.floor(Date.now() / 1000) },
  });

  const handleClaim = async () => {
    if (!proof) return;
    setIsTxLoading(true);
    try {
      const hash = await runIntent(() => getMedialaneClient().api.intents.create("pop-claim", { claimer: address!, collection: collectionAddress, proof }));
      setResult({
        status: "success",
        title: "Credential claimed!",
        description: "Your proof of participation is on-chain.",
        txHash: hash,
        name: "Credential",
      });
      mutate();
    } catch (err) {
      console.error("[pop-claim] error:", err);
      const friendly = describeError(err);
      setResult({
        status: "error",
        title: friendly.title,
        description: friendly.message,
        onRetry: () => { setResult(null); void handleClaim(); },
      });
    } finally {
      setIsTxLoading(false);
    }
  };

  return (
    <>
      {(state === "ready" || isTxLoading) && (
        <Button
          size="sm"
          className="w-full gap-1.5"
          onClick={handleClaim}
          disabled={isTxLoading}
        >
          {isTxLoading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Claiming…</>
          ) : (
            <><Award className="h-3.5 w-3.5" />Claim credential</>
          )}
        </Button>
      )}
      <TransactionResultDialog
        footer={<RewardEarned actionType="claim_pop" />} result={result} onClose={() => setResult(null)} />
    </>
  );
}
