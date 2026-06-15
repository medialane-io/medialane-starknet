"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { getFriendlyWalletError } from "@/lib/wallet-error";
import { useDropMintStatus, type DropConditions } from "@/hooks/use-drops";
import { getListableTokens } from "@medialane/sdk";
import { dappFeeConfig, buildFeeCall } from "@/lib/fee";
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
  const { isConnected, address: walletAddress } = useUnifiedWallet();
  const { mintStatus, isLoading, mutate } = useDropMintStatus(
    collectionAddress,
    walletAddress ?? null
  );
  const { executeAuto, isLoading: isProcessing } = usePaymasterTransaction();
  const [result, setResult] = useState<TxResult | null>(null);

  const price = getPriceBigInt(conditions);
  const isPaid = price > 0n;

  const paymentToken = isPaid && conditions
    ? getListableTokens().find(
        (t) => t.address.toLowerCase() === conditions.paymentToken.toLowerCase()
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

      // claim(quantity: u256(1,0))
      calls.push({
        contractAddress: collectionAddress,
        entrypoint: "claim",
        calldata: ["1", "0"],
      });

      // Platform fee (creators fund) — paid mints only; quantity fixed at 1.
      if (isPaid && conditions && conditions.paymentToken !== "0x0") {
        const feeCall = buildFeeCall(
          { surface: "launchpad", token: conditions.paymentToken, grossAmount: price },
          dappFeeConfig
        );
        if (feeCall) {
          calls.push({
            contractAddress: feeCall.contractAddress,
            entrypoint: feeCall.entrypoint,
            calldata: feeCall.calldata as string[],
          });
        }
      }

      const hash = await executeAuto(calls);
      setResult({
        status: "success",
        title: "Minted!",
        description: "Your drop token is on-chain.",
        txHash: hash,
        name: "Drop token",
      });
      mutate();
    } catch (err) {
      const friendly = getFriendlyWalletError(err);
      setResult({
        status: "error",
        title: friendly.title,
        description: friendly.message,
        error: friendly.isUserRejection ? null : (err instanceof Error ? err.message : "Mint failed"),
        onRetry: () => { setResult(null); void handleMint(); },
      });
    }
  };

  // Per-wallet allowance: maxPerWallet "0" = unlimited.
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
      <div className="flex items-center gap-1.5 text-sm text-orange-500 font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Minted · {mintedByWallet} token{mintedByWallet !== 1 ? "s" : ""} (max reached)
      </div>
    );
  } else {
    content = (
      <>
        <Button
          size="lg"
          className="w-full gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
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
