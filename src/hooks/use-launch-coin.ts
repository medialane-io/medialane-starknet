"use client";

import { useState, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { hash, type AccountInterface } from "starknet";
import {
  VALIDATED_EKUBO_PARAMS,
  getTokenBySymbol,
  normalizeAddress,
  CREATOR_COIN_FACTORY_CONTRACT_MAINNET,
} from "@medialane/sdk";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { getMedialaneClient } from "@/lib/medialane-client";
import { starknetProvider } from "@/lib/starknet";
import { toRaw, teamCoinsRaw, buybackQuoteRaw } from "@/lib/coin-launch";

export interface LaunchCoinInput {
  name: string;
  symbol: string;
  supplyHuman: string;     // validated whole-number string
  quoteSymbol: "STRK" | "ETH";
  teamPct: number;         // 0–10
}

export type LaunchStatus = "idle" | "deploying" | "launching" | "indexing" | "done" | "error";

const FACTORY = normalizeAddress(CREATOR_COIN_FACTORY_CONTRACT_MAINNET);
const CREATED_SELECTOR = hash.getSelectorFromName("CreatorCoinCreated");

/** Pull the deployed coin address from the Factory's CreatorCoinCreated event.
 *  Event data = [owner, name, symbol, supply_low, supply_high, coin_address]. */
function coinAddressFromReceipt(receipt: any): string {
  const events: any[] = receipt?.events ?? [];
  for (const ev of events) {
    let from: string;
    try { from = normalizeAddress(ev.from_address); } catch { continue; }
    if (from !== FACTORY) continue;
    const k0 = ev.keys?.[0];
    if (!k0 || normalizeAddress(k0) !== normalizeAddress(CREATED_SELECTOR)) continue;
    const data: string[] = ev.data ?? [];
    if (data.length < 1) continue;
    return normalizeAddress(data[data.length - 1]); // coin_address is last
  }
  throw new Error("Launch deployed but the coin address could not be read from the receipt");
}

export function useLaunchCoin() {
  const { account } = useAccount();
  const { wallet: szWallet } = useStarkZapWallet();
  const [status, setStatus] = useState<LaunchStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const launch = useCallback(
    async (input: LaunchCoinInput): Promise<{ coinAddress: string }> => {
      setError(null);
      const signer = (szWallet ?? account) as AccountInterface | undefined;
      const owner = account?.address ?? (szWallet as any)?.address;
      if (!signer || !owner) throw new Error("Connect a wallet first");

      const quote = getTokenBySymbol(input.quoteSymbol);
      if (!quote) throw new Error(`Unsupported quote token: ${input.quoteSymbol}`);

      const supplyRaw = toRaw(BigInt(input.supplyHuman));
      const teamRaw = teamCoinsRaw(supplyRaw, input.teamPct);
      const buybackRaw = buybackQuoteRaw(teamRaw, quote.decimals);
      const ownerAddr = normalizeAddress(owner);
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
        const coinAddress = coinAddressFromReceipt(receipt);

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
        setStatus("error");
        setError(e instanceof Error ? e.message : "Launch failed");
        throw e;
      }
    },
    [account, szWallet]
  );

  return { launch, status, error };
}
