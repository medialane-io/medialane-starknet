"use client";

import { useState, useCallback } from "react";
import type { Call } from "starknet";
import { getTokenBySymbol, normalizeAddress } from "@medialane/sdk";
import {
  parseCreatorCoinCreated,
  coinToRaw as toRaw,
  teamCoinsRaw,
  buybackQuoteRaw,
  type CreatorCoinReceiptLike,
} from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { useSigner } from "@/hooks/use-signer";
import { getMedialaneClient } from "@/lib/medialane-client";
import { starknetProvider } from "@/lib/starknet";
import { getFriendlyWalletError } from "@/lib/wallet-error";

export interface LaunchCoinInput {
  name: string;
  symbol: string;
  supplyHuman: string;
  quoteSymbol: "STRK" | "ETH";
  teamPct: number;
}

export type LaunchStatus = "idle" | "deploying" | "launching" | "indexing" | "done" | "error";

export function useLaunchCoin() {
  const account = useSigner();
  const { address: activeAddress } = useWallet();
  const [status, setStatus] = useState<LaunchStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(
    async (input: LaunchCoinInput): Promise<{ coinAddress: string }> => {
      setError(null);
      const signer = account;
      const owner = activeAddress;
      if (!signer || !owner) throw new Error("Connect a wallet first");

      const quote = getTokenBySymbol(input.quoteSymbol);
      if (!quote) throw new Error(`Unsupported quote token: ${input.quoteSymbol}`);

      const supplyRaw = toRaw(BigInt(input.supplyHuman));
      const teamRaw = teamCoinsRaw(supplyRaw, input.teamPct);
      const buybackRaw = buybackQuoteRaw(teamRaw, quote.decimals);
      const ownerAddr = normalizeAddress("STARKNET", owner);
      const client = getMedialaneClient();

      try {

        setStatus("deploying");
        const createIntent = await client.api.createCoinIntent({
          owner: ownerAddr,
          name: input.name,
          symbol: input.symbol,
          initialSupply: supplyRaw.toString(),
        });
        if (createIntent.data.requiresSignature) throw new Error("Expected a prebuilt create-coin intent");
        const createRes = await signer.execute(createIntent.data.calls as Call[]);
        const receipt = await starknetProvider.waitForTransaction(createRes.transaction_hash);
        const coinAddress = parseCreatorCoinCreated(receipt as unknown as CreatorCoinReceiptLike);

        setStatus("launching");
        const launchIntent = await client.api.launchCoinIntent({
          owner: ownerAddr,
          creatorCoin: coinAddress,
          quoteToken: quote.address,
          initialHolders: input.teamPct > 0 ? [ownerAddr] : [],
          initialHoldersAmounts: input.teamPct > 0 ? [teamRaw.toString()] : [],
          transferRestrictionDelay: 0,
          quoteFundAmount: buybackRaw.toString(),
        });
        if (launchIntent.data.requiresSignature) throw new Error("Expected a prebuilt launch-coin intent");
        await signer.execute(launchIntent.data.calls as Call[]);

        setStatus("indexing");
        await fetch("/api/proxy/v1/coins/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coinAddress, owner: ownerAddr }),
        }).catch(() => {  });

        setStatus("done");
        return { coinAddress };
      } catch (e) {
        console.error("[launch-coin] error:", e);
        setStatus("error");
        const friendly = getFriendlyWalletError(e);
        setError(friendly.message);
        throw new Error(friendly.message);
      }
    },
    [account, activeAddress]
  );

  return { launch, status, error };
}
