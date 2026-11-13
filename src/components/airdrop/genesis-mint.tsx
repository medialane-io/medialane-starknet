"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { CheckCircle2, Loader2, AlertCircle, ImageIcon } from "lucide-react";
import { GradientButton, runIntentCalls, useTransaction } from "@medialane/ui";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/use-wallet";
import { getMedialaneClient } from "@/lib/medialane-client";
import { readStored, writeStored } from "@/lib/browser-storage";

export function AirdropEventCard() {
  const [errored, setErrored] = useState(false);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-xl shadow-black/10 aspect-square w-full">
      {errored ? (
        <div className="w-full h-full bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-purple-500/10 flex flex-col items-center justify-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ImageIcon className="h-7 w-7 text-primary/40" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">Medialane Airdrop 2026</p>
        </div>
      ) : (

        <Image
          src="/genesis.jpg"
          alt="Medialane Creator's Airdrop"
          fill
          className="object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

interface GenesisMintProps {
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
    retry: "Try again",
  },
  br: {
    connect: "Participar do airdrop",
    claim: "Ativar minha participação",
    minting: "Ativando…",
    success: "Participação confirmada!",
    retry: "Tentar novamente",
  },
};

export function GenesisMint({
  storageKey,
  locale = "en",
}: GenesisMintProps) {
  const { address, isConnected } = useWallet();
  const tx = useTransaction();
  const copy = COPY[locale];

  const [phase, setPhase] = useState<MintPhase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lsKey = address ? `${storageKey}_${address}` : null;

  useEffect(() => {
    if (!lsKey) return;
    const stored = readStored("localStorage", lsKey);
    if (stored) {
      setTxHash(stored);
      setPhase("success");
      return;
    }
    setPhase(isConnected ? "ready" : "idle");
  }, [lsKey, isConnected]);

  useEffect(() => {
    setPhase((prev) => {
      if (prev === "success" || prev === "minting") return prev;
      return isConnected ? "ready" : "idle";
    });
  }, [isConnected]);

  const handleMint = useCallback(() => {
    if (!address) return;
    setPhase("minting");
    setError(null);
    void tx.run(async (signer) => {
      await runIntentCalls(signer, () => getMedialaneClient().createIntent("genesis-mint", { owner: address, recipient: address }));
    });
  }, [address, tx]);

  useEffect(() => {
    if (tx.phase === "success" && tx.txHash) {
      setTxHash(tx.txHash);
      setPhase("success");
      if (lsKey) writeStored("localStorage", lsKey, tx.txHash);
    }
    if (tx.phase === "error") {
      setError(tx.error ?? "");
      setPhase("error");
    }
  }, [tx.phase, tx.txHash, tx.error, lsKey]);

  const card = "rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 space-y-4 shadow-lg shadow-black/5";

  if (phase === "success" && txHash) {
    return (
      <div className={card}>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {copy.success}
          </span>
        </div>
      </div>
    );
  }

  if (phase === "idle") {
    return (
      <div className={card}>
        <GradientButton asChild big>
          <ConnectWallet label={copy.connect} />
        </GradientButton>
      </div>
    );
  }

  return (
    <div className={card}>
      {phase === "error" && error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <GradientButton
        big
        onClick={
          phase === "error"
            ? () => { tx.reset(); setPhase("ready"); setError(null); }
            : handleMint
        }
        disabled={phase === "minting"}
      >
        {phase === "minting" && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}
        {phase === "error"
          ? copy.retry
          : phase === "minting"
          ? copy.minting
          : copy.claim}
      </GradientButton>
    </div>
  );
}
