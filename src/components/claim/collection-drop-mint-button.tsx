"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnifiedWallet } from "@/hooks/use-unified-wallet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { useDropMintStatus, type DropConditions } from "@/hooks/use-drops";
import { getListableTokens } from "@medialane/sdk";
import { dappFeeConfig, buildFeeCall } from "@/lib/fee";
import { useConnect } from "@starknet-react/core";
import { StarknetkitConnector, useStarknetkitConnectModal } from "starknetkit";

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

  const { connectAsync, connectors } = useConnect();
  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
    modalTheme: "dark",
  });

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

  const handleConnectWallet = async () => {
    try {
      const { connector } = await starknetkitConnectModal();
      if (!connector) return;
      await connectAsync({ connector });
    } catch { /* user closed modal */ }
  };

  const handleMint = async () => {
    if (!isConnected) {
      handleConnectWallet();
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

      await executeAuto(calls);
      toast.success("Minted! Your drop token is on-chain.");
      mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mint failed");
    }
  };

  if (!isConnected) {
    return (
      <Button
        size="lg"
        className="w-full gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
        onClick={handleConnectWallet}
      >
        <Package className="h-4 w-4" />
        Connect wallet to mint
      </Button>
    );
  }

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled className="w-full">
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        Loading…
      </Button>
    );
  }

  if (mintStatus && mintStatus.mintedByWallet > 0) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-orange-500 font-medium">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Minted · {mintStatus.mintedByWallet} token{mintStatus.mintedByWallet !== 1 ? "s" : ""}
      </div>
    );
  }

  return (
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
  );
}
