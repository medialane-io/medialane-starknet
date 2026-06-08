"use client";

import { useState, type ReactNode } from "react";
import { Loader2, CheckCircle2, Ban, Award, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { usePopClaimStatus } from "@/hooks/use-pop";
import { TransactionResultDialog, type TxResult } from "@/components/marketplace/transaction-result-dialog";

interface PopClaimButtonProps {
  collectionAddress: string;
}

export function PopClaimButton({ collectionAddress }: PopClaimButtonProps) {
  const { address, isConnected } = useUnifiedWallet();
  const { claimStatus, isLoading, error, mutate } = usePopClaimStatus(
    collectionAddress,
    address ?? null
  );
  const { executeAuto, isLoading: isTxLoading } = usePaymasterTransaction();
  const [result, setResult] = useState<TxResult | null>(null);

  const handleClaim = async () => {
    try {
      const hash = await executeAuto([
        { contractAddress: collectionAddress, entrypoint: "claim", calldata: [] },
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
      setResult({
        status: "error",
        title: "Claim failed",
        description: "Something went wrong while claiming.",
        error: err instanceof Error ? err.message : "Claim failed",
        onRetry: () => { setResult(null); void handleClaim(); },
      });
    }
  };

  let content: ReactNode;
  if (!isConnected) {
    content = <ConnectWallet />;
  } else if (isLoading) {
    content = (
      <Button variant="outline" size="sm" disabled className="w-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        Checking eligibility…
      </Button>
    );
  } else if (error) {
    content = (
      <Button variant="ghost" size="sm" className="w-full text-muted-foreground gap-1.5" onClick={() => mutate()}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    );
  } else if (claimStatus?.hasClaimed) {
    content = (
      <div className="flex items-center gap-1.5 text-sm text-green-500 font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Claimed{claimStatus.tokenId ? ` · #${claimStatus.tokenId}` : ""}
      </div>
    );
  } else if (claimStatus && !claimStatus.isEligible) {
    content = (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Ban className="h-3.5 w-3.5 shrink-0" />
        Not eligible
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
      <TransactionResultDialog result={result} onClose={() => setResult(null)} />
    </>
  );
}
