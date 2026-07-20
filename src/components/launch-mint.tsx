"use client";

import { useState, useCallback, useEffect } from "react";
import { withSiwsAuth } from "@/lib/pinata-fetch";
import { useSiwsToken } from "@/hooks/use-siws-token";
import Image from "next/image";
import { ConnectWallet } from "@/components/ConnectWallet";
import { useWallet } from "@/hooks/use-wallet";
import { encodeByteArray } from "@medialane/sdk/starknet";
import {
  Sparkles,
  Zap,
  Shield,
  ExternalLink,
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
  Gift,
  Droplets,
  ArrowRight,
} from "lucide-react";
import { PinInput, validatePin } from "@/components/ui/pin-input";
import { Button } from "@/components/ui/button";
import { useTx } from "@/hooks/use-tx";
import {
  EXPLORER_URL,
  LAUNCH_MINT_CONTRACT,
  GENESIS_NFT_URI,
} from "@/lib/constants";
import { LaunchCountdown } from "./launch-countdown";

// ─── Genesis NFT card ────────────────────────────────────────────────────────

function GenesisNftCard({ minted = false }: { minted?: boolean }) {
  return (
    <div className="relative w-96 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-primary/30">
      <Image
        src="/genesis.jpg"
        alt="Medialane Genesis NFT"
        width={400}
        height={400}
        className="w-full aspect-square object-cover"
        priority
      />
      {minted && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 border border-emerald-500/40">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          <span className="text-[11px] font-semibold text-emerald-400">Minted</span>
        </div>
      )}
    </div>
  );
}

// ─── Perks ────────────────────────────────────────────────────────────────────

const PERKS = [
  { icon: Gift, label: "Free to mint", sub: "Zero platform fees" },
  { icon: Zap, label: "One click", sub: "Straight to your wallet" },
  { icon: Droplets, label: "Airdrop passport", sub: "Future distribution" },
  { icon: Shield, label: "Programmable IP", sub: "Immutable ownership" },
];

function PerksGrid() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {PERKS.map(({ icon: Icon, label, sub }) => (
        <div
          key={label}
          className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3 hover:border-primary/30 transition-colors"
        >
          <div className="mt-0.5 h-7 w-7 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold leading-tight">{label}</p>
            <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type MintStep = "ready" | "enter-pin" | "minting" | "success" | "error";

export function LaunchMint() {
  const { isConnected: isSignedIn, address: walletConnected } = useWallet();
  const isLoaded = true;
  const { address: sessionWalletAddress, isConnected: hasWallet } = useWallet();
  const isLoadingWallet = false; // shim parity — useWallet exposes connection state synchronously
  const { execute: executeTransaction, status, statusMessage, error: txError, reset } = useTx();
  const { getValidToken } = useSiwsToken();


  // Mint flow
  const [mintStep, setMintStep] = useState<MintStep>("ready");
  const [mintPin, setMintPin] = useState("");
  const [mintPinError, setMintPinError] = useState<string | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintStatusMsg, setMintStatusMsg] = useState("");
  const [completedTxHash, setCompletedTxHash] = useState<string | null>(null);

  const userId = walletConnected ?? sessionWalletAddress ?? null;

  // Restore minted state from localStorage
  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(`ml_genesis_${userId}`);
    if (stored) {
      setCompletedTxHash(stored);
      setMintStep("success");
    }
  }, [userId]);

  const recipientAddress = sessionWalletAddress ?? undefined;

  // ── Mint ──────────────────────────────────────────────────────────────────

  const handleMint = useCallback(async () => {
    const err = validatePin(mintPin);
    if (err) { setMintPinError(err); return; }
    setMintPinError(null);
    setMintError(null);
    setMintStep("minting");
    setMintStatusMsg("Preparing your NFT…");

    try {
      if (!recipientAddress) throw new Error("Wallet address not found.");
      if (!LAUNCH_MINT_CONTRACT) throw new Error("Mint contract not configured.");

      // Resolve token URI
      let tokenUri = GENESIS_NFT_URI;
      if (!tokenUri) {
        setMintStatusMsg("Uploading NFT metadata…");
        const form = new FormData();
        form.append("name", "Medialane Genesis");
        form.append(
          "description",
          "Claim your exclusive Genesis NFT."
        );
        form.append("external_url", "https://medialane.io");
        const token = await getValidToken();
        const res = await fetch("/api/pinata", withSiwsAuth(token, { method: "POST", body: form }));
        const data = await res.json();
        if (data.error) throw new Error("Metadata upload failed: " + data.error);
        tokenUri = data.uri;
      }

      setMintStatusMsg("Submitting transaction…");
      const calldata = [recipientAddress, ...encodeByteArray(tokenUri)];

      const result = await executeTransaction([
        { contractAddress: LAUNCH_MINT_CONTRACT, entrypoint: "mint_item", calldata },
      ]);

      if (result !== null) {
        setMintStep("success");
        setCompletedTxHash(result);
        if (userId) localStorage.setItem(`ml_genesis_${userId}`, result);
      } else {
        throw new Error("Transaction reverted onchain.");
      }
    } catch (err: unknown) {
      setMintStep("error");
      setMintError(err instanceof Error ? err.message : "Mint failed. Please try again.");
    }
  }, [mintPin, recipientAddress, userId, executeTransaction, getValidToken]);

  const handleRetry = () => {
    reset();
    setMintPin("");
    setMintPinError(null);
    setMintError(null);
    setMintStep("ready");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isSuccess = mintStep === "success";

  return (
    <div className="relative flex items-center">
      
      <div className="mx-auto px-4 py-8 relative max-w-5xl">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: NFT card */}
          <div className="flex justify-center">
            <GenesisNftCard minted={isSuccess} />
          </div>

          {/* Right: interactive panel */}
          <div>
            {/* ── Loading ── */}
            {(!isLoaded || (isLoaded && isSignedIn && isLoadingWallet)) && (
              <div className="space-y-6">
                <div className="h-10 w-48 rounded-lg bg-muted/40 animate-pulse" />
                <div className="h-24 rounded-xl bg-muted/30 animate-pulse" />
                <div className="h-12 rounded-xl bg-muted/20 animate-pulse" />
              </div>
            )}

            {/* ── Not signed in ── */}
            {isLoaded && !isSignedIn && (
              <div className="space-y-2">
                

                <div className="space-y-2">
                  <LaunchCountdown />
                </div>

                <PerksGrid />

                <div className="space-y-2.5 pt-1">
                  <ConnectWallet label="Connect Wallet to Mint" className="w-full" />
                </div>
              </div>
            )}

            {/* ── Connected wallet, session wallet unavailable ── */}
            {isLoaded && !isLoadingWallet && isSignedIn && !hasWallet && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Wallet connected</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.1]">
                    Reconnect your{" "}
                    <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Starknet wallet
                    </span>
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We could not find a wallet address for this minting session. Reconnect your Starknet wallet and try again.
                  </p>
                </div>

                <ConnectWallet label="Connect Wallet to Mint" className="w-full" />

                <p className="text-xs text-center text-muted-foreground">
                  Medialane uses wallet connection and SIWS. No separate app sign-up is required.
                </p>
              </div>
            )}

            {/* ── Has wallet: mint flow ── */}
            {isLoaded && !isLoadingWallet && isSignedIn && hasWallet && (
              <div className="space-y-7">
                {/* Header — shown on all sub-steps */}
                {mintStep !== "success" && (
                  <div className="space-y-3">

                    <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
                      Claim your{" "}
                      <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        NFT
                      </span>
                    </h1>
                  </div>
                )}

                {/* ── Ready ── */}
                {mintStep === "ready" && (
                  <>
                    <div className="space-y-2">
                      <LaunchCountdown />
                    </div>
                    <PerksGrid />
                    <div className="space-y-3">
                      <Button
                        size="lg"
                        className="w-full rounded-xl h-12 text-base font-bold gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 shadow-lg shadow-primary/25"
                        onClick={() => setMintStep("enter-pin")}
                        disabled={!LAUNCH_MINT_CONTRACT}
                      >
                        <Sparkles className="h-4 w-4" />
                        {LAUNCH_MINT_CONTRACT ? "Claim Genesis NFT — Free" : "Mint opening soon"}
                        <ArrowRight className="h-4 w-4 ml-auto" />
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Limited edition · Mainnet Launch
                      </p>
                    </div>
                  </>
                )}

                {/* ── Enter PIN ── */}
                {mintStep === "enter-pin" && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-border/60 bg-card/50 p-5 space-y-4">
                      <div>
                        <p className="font-semibold mb-1">Confirm with your wallet PIN</p>
                        <p className="text-sm text-muted-foreground">
                          Enter the PIN you set when creating your wallet. This authorises the free mint.
                        </p>
                      </div>

                      {/* Transaction summary */}
                      <div className="rounded-lg bg-muted/30 px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">NFT</span>
                        <span className="font-medium">Medialane Genesis</span>
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-medium text-emerald-400">Free</span>
                        <span className="text-muted-foreground">Network</span>
                        <span className="font-medium">Starknet</span>
                      </div>

                      <PinInput
                        value={mintPin}
                        onChange={(v) => { setMintPin(v); setMintPinError(null); }}
                        placeholder="Your wallet PIN"
                        error={mintPinError}
                        autoFocus
                      />

                      <div className="flex gap-2">
                        <Button
                          size="lg"
                          className="flex-1 rounded-xl h-11 font-bold gap-2 bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
                          onClick={handleMint}
                          disabled={mintPin.length < 6}
                        >
                          <Sparkles className="h-4 w-4" />
                          Mint now
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="rounded-xl h-11"
                          onClick={() => { setMintPin(""); setMintPinError(null); setMintStep("ready"); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Minting ── */}
                {mintStep === "minting" && (
                  <div className="rounded-2xl border border-border/60 bg-card/50 p-6">
                    <div className="flex items-center gap-4">
                      <div className="relative h-12 w-12 shrink-0">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">Minting your Genesis NFT…</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {mintStatusMsg || statusMessage || "Please wait…"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      {[
                        { label: "Upload metadata", done: status !== "idle" },
                        { label: "Submit transaction", done: status === "confirming" || status === "confirmed" },
                        { label: "Confirm on Starknet", done: status === "confirmed" },
                      ].map(({ label, done }) => (
                        <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
                          {done ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
                          )}
                          <span className={done ? "text-foreground" : ""}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Success ── */}
                {mintStep === "success" && (
                  <div className="space-y-5">
                    <div className="space-y-3">

                      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
                        You&apos;re{" "}
                        <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                          in!
                        </span>
                      </h1>
                    </div>

                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-bold text-emerald-300 text-lg">NFT claimed!</p>
                          <p className="text-sm text-muted-foreground">
                            You&apos;re part of the Medialane genesis community.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
                          <Droplets className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>Airdrop passport</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
                          <Shield className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>Immutable ownership</span>
                        </div>
                      </div>

                      {completedTxHash && (
                        <a
                          href={`${EXPLORER_URL}/tx/${completedTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                        >
                          <span className="tabular-nums">
                            {completedTxHash.slice(0, 12)}…{completedTxHash.slice(-8)}
                          </span>
                          <ExternalLink className="h-3 w-3 group-hover:text-primary transition-colors" />
                        </a>
                      )}
                    </div>

                    <div className="space-y-2">
                      <LaunchCountdown />
                    </div>
                  </div>
                )}

                {/* ── Error ── */}
                {mintStep === "error" && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-sm">Mint failed</p>
                          {(mintError || txError) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {mintError || txError}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2" onClick={handleRetry}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        Try again
                      </Button>
                    </div>
                    <PerksGrid />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
