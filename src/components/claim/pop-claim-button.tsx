"use client";

import { useEffect, useState, type ReactNode } from "react";
import { decodePopClaimFragment } from "@medialane/sdk/starknet";
import { starknetProvider } from "@/lib/starknet";
import { popClaimState } from "@/lib/pop-claim";
import { RewardEarned } from "@/lib/reward-earned";
import { Loader2, CheckCircle2, Ban, Award, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/use-wallet";
import { describeError } from "@medialane/ui";
import { usePopClaimStatus } from "@/hooks/use-pop";
import { TransactionResultDialog, type TxResult } from "@/components/marketplace/transaction-result-dialog";

interface PopClaimButtonProps {
  collectionAddress: string;
}

export function PopClaimButton({ collectionAddress }: PopClaimButtonProps) {
  const { address, isConnected, execute } = useWallet();
  const { hasClaimed, error, mutate } = usePopClaimStatus(collectionAddress, address ?? null);
  const [result, setResult] = useState<TxResult | null>(null);
  const [isTxLoading, setIsTxLoading] = useState(false);
  const [proof, setProof] = useState<string[] | null>(null);
  const [root, setRoot] = useState<string | null>(null);

  useEffect(() => {
    setProof(decodePopClaimFragment(window.location.hash));
    starknetProvider
      .callContract({ contractAddress: collectionAddress, entrypoint: "allowlist_root", calldata: [] })
      .then(([value]) => setRoot(value ?? null))
      .catch(() => setRoot(null));
  }, [collectionAddress]);

  const state = popClaimState({ hasClaimed, proof, root, wallet: address ?? null });

  const handleClaim = async () => {
    if (!proof) return;
    setIsTxLoading(true);
    try {
      const hash = await execute([
        { contractAddress: collectionAddress, entrypoint: "claim", calldata: [String(proof.length), ...proof] },
      ]);
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

  let content: ReactNode;
  if (!isConnected) {
    content = <ConnectWallet />;
  } else if (error) {
    content = (
      <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-1.5" onClick={() => mutate()}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    );
  } else if (state === "loading") {
    content = (
      <Button variant="outline" size="sm" disabled className="w-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        Checking…
      </Button>
    );
  } else if (state === "claimed") {
    content = (
      <div className="flex items-center gap-1.5 text-sm text-green-500 font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Claimed
      </div>
    );
  } else if (state === "closed") {
    content = <p className="text-sm text-muted-foreground">Claims for this credential are closed.</p>;
  } else if (state === "no-link") {
    content = (
      <p className="text-sm text-muted-foreground">Open the claim link you received to claim this credential.</p>
    );
  } else if (state === "wrong-wallet") {
    content = (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Ban className="h-3.5 w-3.5 shrink-0" />
        This claim link doesn&apos;t match this wallet, or the organizer has since published a new list.
      </div>
    );
  } else {
    content = (
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
    );
  }

  return (
    <>
      {content}
      <TransactionResultDialog
        footer={<RewardEarned actionType="claim_pop" />} result={result} onClose={() => setResult(null)} />
    </>
  );
}
