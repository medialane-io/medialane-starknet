"use client";

import { useState, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { getTokenBySymbol, normalizeAddress } from "@medialane/sdk";
import {
  VALIDATED_EKUBO_PARAMS,
  parseCreatorCoinCreated,
  coinToRaw as toRaw,
  teamCoinsRaw,
  buybackQuoteRaw,
  type CreatorCoinReceiptLike,
} from "@medialane/sdk/starknet";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { getMedialaneClient } from "@/lib/medialane-client";
import { starknetProvider } from "@/lib/starknet";
import { getFriendlyWalletError } from "@/lib/wallet-error";

export interface LaunchCoinInput {
  name: string;
  symbol: string;
  supplyHuman: string;     // validated whole-number string
  quoteSymbol: "STRK" | "ETH";
  teamPct: number;         // 0–10
}

export type LaunchStatus = "idle" | "deploying" | "launching" | "indexing" | "done" | "error";

export function useLaunchCoin() {
  const { account } = useAccount();
  // Gate the StarkZap wallet on the active-wallet slot — same hijack class as
  // use-siws-token/use-marketplace. The old code could even split rails:
  // signer = szWallet but owner = injected address when both were present.
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, address: activeAddress } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const [status, setStatus] = useState<LaunchStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(
    async (input: LaunchCoinInput): Promise<{ coinAddress: string }> => {
      setError(null);
      const signer = (szWallet ?? account) as AccountInterface | undefined;
      const owner = activeAddress;
      if (!signer || !owner) throw new Error("Connect a wallet first");

      const quote = getTokenBySymbol(input.quoteSymbol);
      if (!quote) throw new Error(`Unsupported quote token: ${input.quoteSymbol}`);

      const supplyRaw = toRaw(BigInt(input.supplyHuman));
      const teamRaw = teamCoinsRaw(supplyRaw, input.teamPct);
      const buybackRaw = buybackQuoteRaw(teamRaw, quote.decimals);
      const ownerAddr = normalizeAddress("STARKNET", owner);
      const client = getMedialaneClient();
      const salt = "0x" + Date.now().toString(16);

      try {
        // Tx1 — deploy the coin (full supply to the Factory).
        setStatus("deploying");
        const created = await client.services.creatorCoin.createCreatorCoin(signer, {
          owner: ownerAddr,
          name: input.name,
          symbol: input.symbol,
          initialSupply: supplyRaw,
          salt,
        });
        const receipt = await starknetProvider.waitForTransaction(created.txHash);
        const coinAddress = parseCreatorCoinCreated(receipt as unknown as CreatorCoinReceiptLike);

        // Tx2 — launch on Ekubo at the fixed validated price; buyback pre-funded
        // in the same multicall. Anti-snipe off (delay 0) in v1.
        setStatus("launching");
        await client.services.creatorCoin.launchOnEkubo(signer, {
          creatorCoin: coinAddress,
          quoteToken: quote.address,
          initialHolders: input.teamPct > 0 ? [ownerAddr] : [],
          initialHoldersAmounts: input.teamPct > 0 ? [teamRaw] : [],
          transferRestrictionDelay: 0,
          ekubo: VALIDATED_EKUBO_PARAMS,
          quoteFundAmount: buybackRaw,
        });

        // Index instantly (50s factory poll is the backstop).
        setStatus("indexing");
        await fetch("/api/proxy/v1/coins/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coinAddress, owner: ownerAddr }),
        }).catch(() => { /* poll backstop will index it */ });

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
    [account, szWallet, activeAddress]
  );

  return { launch, status, error };
}
