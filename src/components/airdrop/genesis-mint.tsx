"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/use-wallet";
import { usePaymasterTransaction } from "@/hooks/use-paymaster-transaction";
import { serializeByteArray } from "@/lib/cairo-calldata";
import { EXPLORER_URL } from "@/lib/constants";

interface GenesisMintProps {
  contract: string;
  nftUri: string;
  storageKey: string;
  locale?: "en" | "br";
}

type MintPhase = "idle" | "ready" | "minting" | "success" | "error";

const COPY = {
  en: {
    connect: "Join the airdrop",
    claim: "Claim my spot",
    minting: "Claiming…",
    success: "You're in!",
    viewTx: "View transaction",
    retry: "Try again",
    noContract: "Mint not started yet",
  },
  br: {
    connect: "Participar do airdrop",
    claim: "Ativar minha participação",
    minting: "Ativando…",
    success: "Participação confirmada!",
    viewTx: "Ver transação",
    retry: "Tentar novamente",
    noContract: "Distribuição não iniciada ainda",
  },
};

export function GenesisMint({
  contract,
  nftUri,
  storageKey,
  locale = "en",
}: GenesisMintProps) {
  const { address, isConnected } = useWallet();
  const { executeAuto, isLoading } = usePaymasterTransaction();
  const copy = COPY[locale];

  const [phase, setPhase] = useState<MintPhase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lsKey = address ? `${storageKey}_${address}` : null;

  // Restore prior mint from localStorage
  useEffect(() => {
    if (!lsKey) return;
    const stored = localStorage.getItem(lsKey);
    if (stored) {
      setTxHash(stored);
      setPhase("success");
      return;
    }
    setPhase(isConnected ? "ready" : "idle");
  }, [lsKey, isConnected]);

  // Sync idle <-> ready when wallet connects/disconnects
  useEffect(() => {
    setPhase((prev) => {
      if (prev === "success" || prev === "minting") return prev;
      return isConnected ? "ready" : "idle";
    });
  }, [isConnected]);

  const handleMint = useCallback(async () => {
    if (!contract || !address) return;
    setPhase("minting");
    setError(null);
    try {
      // The mint_item contract requires an ipfs:// or ar:// scheme. The
      // configured URI env var is a bare CID, so normalize it the same way
      // medialane-io does before building calldata.
      const tokenUri =
        nftUri.startsWith("ipfs://") || nftUri.startsWith("ar://")
          ? nftUri
          : `ipfs://${nftUri}`;
      const calldata = [address, ...serializeByteArray(tokenUri)];
      const hash = await executeAuto([
        { contractAddress: contract, entrypoint: "mint_item", calldata },
      ]);
      if (!hash) throw new Error("Transaction not confirmed");
      setTxHash(hash);
      setPhase("success");
      if (lsKey) localStorage.setItem(lsKey, hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setPhase("error");
    }
  }, [contract, address, nftUri, executeAuto, lsKey]);

  if (phase === "success" && txHash) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {copy.success}
          </span>
        </div>
        <a
          href={`${EXPLORER_URL}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copy.viewTx}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  if (phase === "idle") {
    return <ConnectWallet label={copy.connect} />;
  }

  if (!contract) {
    return (
      <Button disabled size="lg" className="font-bold">
        {copy.noContract}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {phase === "error" && error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <Button
        size="lg"
        className="font-bold gap-2"
        onClick={
          phase === "error"
            ? () => { setPhase("ready"); setError(null); }
            : handleMint
        }
        disabled={phase === "minting" || isLoading}
      >
        {(phase === "minting" || isLoading) && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {phase === "error"
          ? copy.retry
          : phase === "minting"
          ? copy.minting
          : copy.claim}
      </Button>
    </div>
  );
}
