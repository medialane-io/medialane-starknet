"use client";

/**
 * Creator Coin Launch Studio (dapp) — wallet-signed variant of the io studio.
 * The creator designs their coin (image, description: platform-layer profile)
 * with a live preview, sets the economics in plain language, then launches
 * through the existing two-transaction flow (AVNU paymaster / wallet signing).
 *
 * Spec: medialane-core/docs/specs/2026-06-11-coin-launch-studio-design.md
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Coins, TrendingUp, ArrowRight, ArrowLeft, Lock, Sparkles, ImagePlus, X, Loader2 } from "lucide-react";
import {
  getTokenBySymbol, formatAmount,
  validateCoinName as validateName,
  validateCoinSymbol as validateSymbol,
  validateCoinSupply as validateSupply,
  coinToRaw as toRaw,
  teamCoinsRaw, buybackQuoteRaw, fdvHuman,
} from "@medialane/sdk";
import { PageContainer } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useLaunchCoin, type LaunchCoinInput } from "@/hooks/use-launch-coin";
import { useLaunchpadImageUpload } from "@/hooks/use-launchpad-image-upload";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { suggestCoinSymbol } from "@/lib/coin-symbol";
import { getMedialaneClient } from "@/lib/medialane-client";
import { CoinLaunchPreview, type CoinPreviewData } from "@/components/coin/coin-launch-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConnectGate } from "@/components/connect-gate";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const QUOTE_OPTIONS = ["STRK", "ETH"] as const;
type Quote = (typeof QUOTE_OPTIONS)[number];

const SUPPLY_PRESETS = [
  { label: "1M", value: "1000000" },
  { label: "100M", value: "100000000" },
  { label: "1B", value: "1000000000" },
];

type StudioStep = 1 | 2 | 3;
type ProfileStatus = "idle" | "saving" | "saved" | "failed";

export default function CoinCreatePage() {
  const router = useRouter();
  const { address, isConnected } = useWallet();
  const { launch, status, error } = useLaunchCoin();
  const { token: siwsToken, signIn: siwsSignIn } = useSiwsToken();

  const [step, setStep] = useState<StudioStep>(1);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [autoSymbol, setAutoSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [supply, setSupply] = useState("");
  const [quote, setQuote] = useState<Quote>("STRK");
  const [teamPct, setTeamPct] = useState(5);
  const [coinAddress, setCoinAddress] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");

  const {
    imagePreview, imageUri, imageUploading, uploadError, uploadSuccess,
    fileInputRef, handleImageSelect, clearImage,
  } = useLaunchpadImageUpload({
    allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"],
    successMessage: "Image ready",
  });

  const quoteToken = getTokenBySymbol(quote)!;
  const { raw: quoteBalanceRaw } = useTokenBalance(quote, isConnected ? (address ?? undefined) : undefined);

  const nameErr = name ? validateName(name) : null;
  const symErr = symbol ? validateSymbol(symbol) : null;
  const supplyErr = supply ? validateSupply(supply) : null;
  const identityValid = !validateName(name) && !validateSymbol(symbol);
  const economicsValid = !validateSupply(supply);

  const handleNameChange = (v: string) => {
    setName(v);
    const suggested = suggestCoinSymbol(v);
    if (suggested && (!symbol || symbol === autoSymbol)) {
      setSymbol(suggested);
      setAutoSymbol(suggested);
    }
  };

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

  const insufficient = preview != null && quoteBalanceRaw != null && quoteBalanceRaw < preview.buybackRaw;
  const busy = status === "deploying" || status === "launching" || status === "indexing";
  const canLaunch = isConnected && identityValid && economicsValid && preview != null && !insufficient && !imageUploading && !busy;

  const previewData: CoinPreviewData = {
    name,
    symbol,
    description,
    imageUrl: imagePreview,
    supplyHuman: economicsValid && supply ? Number(supply) : null,
    quoteSymbol: quote,
    teamPct,
  };

  /** Platform-layer identity → the coin's CollectionProfile. Auth is SIWS on
   *  the dapp; claimedBy lands when the factory event indexes — retry briefly. */
  const saveCoinProfile = async (contract: string) => {
    if (!imageUri && !description) return;
    setProfileStatus("saving");
    let token = siwsToken;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 10_000));
        token = token ?? (await siwsSignIn());
        if (!token) throw new Error("no session");
        await getMedialaneClient().api.updateCollectionProfile(contract, {
          displayName: name,
          ...(description ? { description } : {}),
          ...(imageUri ? { image: imageUri } : {}),
        }, token);
        setProfileStatus("saved");
        return;
      } catch {
        // claimedBy may not be indexed yet — retry
      }
    }
    setProfileStatus("failed");
  };

  async function handleLaunch() {
    if (!canLaunch) return;
    try {
      const input: LaunchCoinInput = { name, symbol, supplyHuman: supply, quoteSymbol: quote, teamPct };
      const { coinAddress: addr } = await launch(input);
      setCoinAddress(addr);
      void saveCoinProfile(addr);
      toast.success("Creator Coin launched");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Launch failed");
    }
  }

  const handleReset = () => {
    setCoinAddress(null);
    setProfileStatus("idle");
    setStep(1);
    setName(""); setSymbol(""); setAutoSymbol(""); setDescription("");
    setSupply(""); setTeamPct(5);
    clearImage();
  };

  const statusLabel =
    status === "deploying" ? "Deploying your coin…" :
    status === "launching" ? "Opening the market…" :
    status === "indexing" ? "Almost there…" : null;

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === "done" && coinAddress) {
    return (
      <PageContainer className="box-border max-w-2xl pt-24 pb-8 space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{name} is live</h1>
          <p className="text-muted-foreground">
            Deployed and launched with permanently-locked liquidity. Trading is open.
          </p>
        </div>
        <div className="max-w-sm mx-auto space-y-4 text-left">
          <CoinLaunchPreview data={previewData} />
          {profileStatus === "saving" && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving your coin&apos;s image &amp; description…
            </p>
          )}
          {profileStatus === "saved" && (
            <p className="text-xs text-emerald-500 text-center">✓ Image &amp; description saved to your coin&apos;s page</p>
          )}
          {profileStatus === "failed" && (
            <p className="text-xs text-muted-foreground text-center">
              Couldn&apos;t save the image &amp; description right now — add them anytime from your collection settings.
            </p>
          )}
          <p className="font-mono text-xs text-muted-foreground break-all text-center">{coinAddress}</p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleReset}>Launch another</Button>
            <Button className="flex-1 bg-brand-rose hover:bg-brand-rose/90" onClick={() => router.push(`/coins/${coinAddress}`)}>
              View &amp; trade <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const stepTitle = step === 1 ? "Your coin" : step === 2 ? "Economics" : "Review & launch";

  return (
    <ConnectGate
      title="Connect wallet to launch a coin"
      subtitle="Connect your Starknet wallet to create a creator coin."
    >
    <PageContainer className="box-border max-w-5xl pt-24 pb-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-brand-rose">
          <Coins className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">Creator Coin</span>
        </div>
        <h1 className="text-3xl font-bold">Design your Creator Coin</h1>
        <p className="text-muted-foreground">
          Give it a face, set the numbers, and launch — with liquidity locked forever.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mt-6 mb-6">
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { if (s < step || (s === 2 && identityValid) || (s === 3 && identityValid && economicsValid)) setStep(s); }}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-semibold transition-colors",
              s === step ? "bg-brand-rose/15 text-brand-rose" : "bg-muted/30 text-muted-foreground",
            )}
          >
            {s}. {s === 1 ? "Your coin" : s === 2 ? "Economics" : "Launch"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="lg:hidden">
          <CoinLaunchPreview data={previewData} />
        </div>

        <div className="space-y-6 rounded-2xl border border-border/40 p-5 sm:p-6">
          <h2 className="text-lg font-bold">{stepTitle}</h2>

          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Coin image</Label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative h-20 w-20 shrink-0 rounded-full overflow-hidden border border-dashed border-border bg-muted/20 flex items-center justify-center"
                  >
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="Coin" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-6 w-6 text-muted-foreground" />
                    )}
                    {imageUploading && (
                      <span className="absolute inset-0 bg-background/70 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      </span>
                    )}
                  </button>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>JPG, PNG, GIF, SVG or WebP · max 10 MB</p>
                    <p>This becomes your coin&apos;s face across Medialane.</p>
                    {imagePreview && (
                      <button type="button" onClick={clearImage} className="inline-flex items-center gap-1 text-muted-foreground active:text-foreground">
                        <X className="h-3 w-3" /> Remove
                      </button>
                    )}
                    {uploadError && <p className="text-destructive">{uploadError}</p>}
                    {uploadSuccess && <p className="text-emerald-500">✓ {uploadSuccess}</p>}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImageSelect(f); }}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="My Coin" disabled={busy} />
                  {nameErr && <p className="text-xs text-destructive">{nameErr}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="symbol">Symbol</Label>
                  <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="COIN" disabled={busy} />
                  {symErr && <p className="text-xs text-destructive">{symErr}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                  placeholder="Tell your community what this coin is about…"
                  rows={3}
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">Shown on your coin&apos;s page. You can edit it anytime.</p>
              </div>

              <Button onClick={() => setStep(2)} disabled={!identityValid || imageUploading} className="w-full">
                Next: Economics <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="supply">Total supply</Label>
                <div className="flex gap-2 mb-1">
                  {SUPPLY_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSupply(p.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        supply === p.value ? "border-brand-rose/50 bg-brand-rose/10 text-brand-rose" : "border-border text-muted-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <Input
                  id="supply" inputMode="numeric" value={supply}
                  onChange={(e) => setSupply(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="1000000" disabled={busy}
                />
                {supplyErr && <p className="text-xs text-destructive">{supplyErr}</p>}
                {preview && (
                  <p className="text-xs text-muted-foreground">
                    Your coin starts at a <span className="font-semibold text-foreground">{preview.fdv.toLocaleString()} {quote}</span> market cap
                    (price is fixed at 0.01 {quote}/coin — supply sets the cap).
                  </p>
                )}
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
                      className={cn(
                        "rounded-lg border px-4 py-1.5 text-sm font-medium",
                        quote === q ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                      )}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">The currency your coin trades against.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="alloc">Your allocation: {teamPct}%</Label>
                <input
                  id="alloc" type="range" min={0} max={10} step={1}
                  value={teamPct} onChange={(e) => setTeamPct(Number(e.target.value))}
                  disabled={busy} className="w-full accent-[hsl(var(--brand-rose))]"
                />
                <p className="text-xs text-muted-foreground">
                  Up to 10% goes straight to your wallet at launch — you fund it
                  {preview ? <> (<span className="font-semibold text-foreground">{preview.buybackHuman} {quote}</span>)</> : null}.
                  The rest belongs to the market.
                </p>
                {insufficient && (
                  <p className="text-xs text-destructive">
                    You need {preview?.buybackHuman} {quote} in your wallet for this allocation — lower it or top up.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!economicsValid || insufficient} className="flex-1">
                  Next: Review <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-start gap-2">
                  <Lock className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span><span className="font-semibold">Liquidity locked forever.</span> Nobody can pull it — not even us.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span><span className="font-semibold">Two transactions.</span> Your wallet confirms each step.</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                  <span><span className="font-semibold">Tradable immediately.</span> Your coin opens on the market the moment it launches.</span>
                </li>
              </ul>

              <div className="rounded-xl bg-muted/30 p-4 text-sm space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Coin</span><span className="font-semibold">{name} (${symbol})</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Supply</span><span className="font-semibold">{Number(supply).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Market cap</span><span className="font-semibold">{preview?.fdv.toLocaleString()} {quote}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Your share</span><span className="font-semibold">{teamPct}% {preview && teamPct > 0 ? `(you fund ${preview.buybackHuman} ${quote})` : ""}</span></div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} disabled={busy}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                </Button>
                <Button onClick={handleLaunch} disabled={!canLaunch} className="flex-1 bg-brand-rose hover:bg-brand-rose/90">
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{statusLabel}</> : <>Launch <ArrowRight className="h-4 w-4 ml-1.5" /></>}
                </Button>
              </div>
              {status === "error" && error && <p className="text-xs text-destructive">{error}</p>}
            </>
          )}
        </div>

        <div className="hidden lg:block sticky top-24">
          <CoinLaunchPreview data={previewData} />
        </div>
      </div>
    </PageContainer>
    </ConnectGate>
  );
}
