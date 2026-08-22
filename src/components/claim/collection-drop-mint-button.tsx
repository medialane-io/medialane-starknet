"use client";

import { useState, type ReactNode } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { useDropMintStatus, type DropConditions } from "@/hooks/use-drops";
import { getListableTokens, normalizeAddress } from "@medialane/sdk";
import { feeConfig, buildFeeCall } from "@/lib/fee";
import { ConnectWallet } from "@/components/ConnectWallet";
import { TransactionResultDialog, type TxResult } from "@/components/marketplace/transaction-result-dialog";

interface CollectionDropMintButtonProps {
  collectionAddress: string;
  conditions?: DropConditions;
}

function getPriceBigInt(conditions?: DropConditions): bigint {
  if (!conditions || conditions.price === "0" || conditions.paymentToken === "0x0") return 0n;
  try {
    return BigInt(conditions.price);
  } catch {
    return 0n;
  }
}

function u256CallData(value: bigint): [string, string] {
  const low  = (value & BigInt("0xffffffffffffffffffffffffffffffff")).toString();
  const high = (value >> 128n).toString();
  return [low, high];
}

export function CollectionDropMintButton({
  collectionAddress,
  conditions,
}: CollectionDropMintButtonProps) {
  const { isConnected, address: walletAddress, execute } = useWallet();
  const { mintStatus, isLoading, mutate } = useDropMintStatus(
    collectionAddress,
    walletAddress ?? null
  );
  const [result, setResult] = useState<TxResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const price = getPriceBigInt(conditions);
  const isPaid = price > 0n;

  const paymentToken = isPaid && conditions
    ? getListableTokens().find(
        (t) => normalizeAddress("STARKNET", t.address) === normalizeAddress("STARKNET", conditions.paymentToken)
      ) ?? null
    : null;

  const priceDisplay = isPaid && paymentToken
    ? `${Number(price * 10000n / BigInt(10 ** paymentToken.decimals)) / 10000} ${paymentToken.symbol}`
    : null;

  const handleMint = async () => {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }

    setIsProcessing(true);
    try {
      const calls: Array<{ contractAddress: string; entrypoint: string; calldata: string[] }> = [];

      if (isPaid && conditions && conditions.paymentToken !== "0x0") {
        const [priceLow, priceHigh] = u256CallData(price);
        calls.push({
          contractAddress: conditions.paymentToken,
          entrypoint: "approve",
          calldata: [collectionAddress, priceLow, priceHigh],
        });
      }

      calls.push({
        contractAddress: collectionAddress,
        entrypoint: "claim",
        calldata: ["1", "0"],
      });

      if (isPaid && conditions && conditions.paymentToken !== "0x0") {
        const feeCall = buildFeeCall(
          { surface: "launchpad", token: conditions.paymentToken, grossAmount: price },
          feeConfig
        );
        if (feeCall) {
          calls.push({
            contractAddress: feeCall.contractAddress,
            entrypoint: feeCall.entrypoint,
            calldata: feeCall.calldata as string[],
          });
        }
      }

      const hash = await execute(calls);
      setResult({
        status: "success",
        title: "Minted!",
        description: "Your drop token is on-chain.",
        txHash: hash,
        name: "Drop token",
      });
      rewardToast("claim_drop");
      mutate();
    } catch (err) {
      console.error("[drop-mint] error:", err);
      const friendly = getFriendlyWalletError(err);
      setResult({
        status: "error",
        title: friendly.title,
        description: friendly.message,
        onRetry: () => { setResult(null); void handleMint(); },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const maxPerWallet = conditions ? parseInt(conditions.maxPerWallet, 10) : 0;
  const mintedByWallet = mintStatus?.mintedByWallet ?? 0;
  const remaining = maxPerWallet > 0 ? Math.max(0, maxPerWallet - mintedByWallet) : Infinity;

  let content: ReactNode;
  if (!isConnected) {
    content = <ConnectWallet label="Connect wallet to mint" className="w-full" />;
  } else if (isLoading) {
    content = (
      <Button variant="outline" size="sm" disabled className="w-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        Loading…
      </Button>
    );
  } else if (maxPerWallet > 0 && remaining <= 0) {
    content = (
      <div className="flex items-center gap-1.5 text-sm text-brand-orange font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Minted · {mintedByWallet} token{mintedByWallet !== 1 ? "s" : ""} (max reached)
      </div>
    );
  } else {
    content = (
      <>
        <Button
          size="lg"
          className="w-full gap-1.5 bg-brand-orange hover:brightness-110 text-white"
          onClick={handleMint}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Minting…
            </>
          ) : (
            <>
              <Package className="h-4 w-4" />
              {priceDisplay ? `Mint for ${priceDisplay}` : "Mint free"}
            </>
          )}
        </Button>
        {Number.isFinite(remaining) && (
          <p className="text-xs text-center text-muted-foreground mt-1.5">
            {mintedByWallet > 0 ? `You've minted ${mintedByWallet} · ` : ""}You can mint {remaining} more
          </p>
        )}
      </>
    );
  }

  return (
    <>
      {content}
      <TransactionResultDialog result={result} onClose={() => setResult(null)} />
    </>
  );
}
