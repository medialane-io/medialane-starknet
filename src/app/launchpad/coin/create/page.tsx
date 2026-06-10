"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Coins, Loader2 } from "lucide-react";
import { getTokenBySymbol, formatAmount } from "@medialane/sdk";
import { PageContainer } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useLaunchCoin, type LaunchCoinInput } from "@/hooks/use-launch-coin";
import {
  validateName, validateSymbol, validateSupply,
  toRaw, teamCoinsRaw, buybackQuoteRaw, fdvHuman,
} from "@/lib/coin-launch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectWallet } from "@/components/ConnectWallet";
import { FadeIn } from "@/components/ui/motion-primitives";
import { toast } from "sonner";

const QUOTE_OPTIONS = ["STRK", "ETH"] as const;
type Quote = (typeof QUOTE_OPTIONS)[number];

export default function CoinCreatePage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { launch, status, error } = useLaunchCoin();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("");
  const [quote, setQuote] = useState<Quote>("STRK");
  const [teamPct, setTeamPct] = useState(5);

  const quoteToken = getTokenBySymbol(quote)!;
  const { raw: quoteBalanceRaw } = useTokenBalance(quote, isConnected ? (address ?? undefined) : undefined);

  const nameErr = name ? validateName(name) : null;
  const symErr = symbol ? validateSymbol(symbol) : null;
  const supplyErr = supply ? validateSupply(supply) : null;
  const inputsValid = !validateName(name) && !validateSymbol(symbol) && !validateSupply(supply);

  const preview = useMemo(() => {
    if (validateSupply(supply)) return null;
    const supplyHuman = Number(supply);
    const supplyRaw = toRaw(BigInt(supply));
    const teamRaw = teamCoinsRaw(supplyRaw, teamPct);
    const buybackRaw = buybackQuoteRaw(teamRaw, quoteToken.decimals);
    return {
      fdv: fdvHuman(supplyHuman),
      teamCoins: supplyHuman * (teamPct / 100),
      buybackRaw,
      buybackHuman: formatAmount(buybackRaw.toString(), quoteToken.decimals),
    };
  }, [supply, teamPct, quoteToken.decimals]);

  const insufficient =
    preview != null && quoteBalanceRaw != null && quoteBalanceRaw < preview.buybackRaw;

  const busy = status === "deploying" || status === "launching" || status === "indexing";
  const canLaunch = isConnected && inputsValid && preview != null && !insufficient && !busy;

  async function handleLaunch() {
    try {
      const input: LaunchCoinInput = { name, symbol, supplyHuman: supply, quoteSymbol: quote, teamPct };
      const { coinAddress } = await launch(input);
      toast.success("Creator Coin launched");
      router.push(`/collections/${coinAddress}`);
    } catch (e) {
      // Read the message off the exception — the `error` state set inside
      // launch() isn't visible to this closure until the next render.
      toast.error(e instanceof Error ? e.message : "Launch failed");
    }
  }

  const statusLabel =
    status === "deploying" ? "Deploying coin…" :
    status === "launching" ? "Launching on Ekubo…" :
    status === "indexing" ? "Indexing…" : null;

  return (
    <PageContainer className="box-border max-w-2xl pt-20 pb-8 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Coins className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Creator Coin</span>
        </div>
        <h1 className="text-3xl font-bold">Launch a Creator Coin</h1>
        <p className="text-muted-foreground">
          Deploy a fixed-supply social token with permanently-locked Ekubo liquidity. Launch
          price is fixed at 0.01 {quote}/coin — your supply sets the market cap.
        </p>
      </div>

      <FadeIn>
        <div className="space-y-6 rounded-2xl border border-border/40 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Coin" disabled={busy} />
              {nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="symbol">Symbol</Label>
              <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="COIN" disabled={busy} />
              {symErr && <p className="text-xs text-destructive">{symErr}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="supply">Total supply</Label>
            <Input id="supply" inputMode="numeric" value={supply} onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ""))} placeholder="1000000" disabled={busy} />
            {supplyErr && <p className="text-xs text-destructive">{supplyErr}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Quote token</Label>
            <div className="flex gap-2">
              {QUOTE_OPTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuote(q)}
                  disabled={busy}
                  className={`rounded-lg border px-4 py-1.5 text-sm font-medium ${quote === q ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="alloc">Team allocation: {teamPct}%</Label>
            <input
              id="alloc" type="range" min={0} max={10} step={1}
              value={teamPct} onChange={(e) => setTeamPct(Number(e.target.value))}
              disabled={busy} className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Up to 10% goes to your wallet, bought out of the pool at launch (you fund the quote).
            </p>
          </div>

          {preview && (
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-4 text-sm">
              <div><p className="text-[10px] uppercase text-muted-foreground">FDV</p><p className="font-semibold">{preview.fdv.toLocaleString()} {quote}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Your coins</p><p className="font-semibold">{preview.teamCoins.toLocaleString()}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">You fund</p><p className="font-semibold">{preview.buybackHuman} {quote}</p></div>
            </div>
          )}
          {insufficient && (
            <p className="text-xs text-destructive">
              Insufficient {quote} balance for the buyback ({preview?.buybackHuman} {quote} needed).
            </p>
          )}

          {!isConnected ? (
            <ConnectWallet label="Connect wallet to launch" />
          ) : (
            <Button onClick={handleLaunch} disabled={!canLaunch} className="w-full">
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{statusLabel}</> : "Launch Creator Coin"}
            </Button>
          )}
          {status === "error" && error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </FadeIn>
    </PageContainer>
  );
}
