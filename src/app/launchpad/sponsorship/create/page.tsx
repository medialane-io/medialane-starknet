"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { Handshake, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { AssetPicker, LicenseTermsBuilder, EMPTY_SPONSORSHIP_TERMS, type OwnedAsset, type SponsorshipTerms } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useTokensByOwner } from "@/hooks/use-tokens";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { getMedialaneClient } from "@/lib/medialane-client";
import { uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";
import { rewardToast } from "@/lib/reward-toast";
import { resolveTokenImage } from "@/lib/utils";
import { getTokenBySymbol, SUPPORTED_TOKENS } from "@medialane/sdk";
import { toast } from "sonner";
import { FadeIn } from "@/components/ui/motion-primitives";

const LISTABLE_TOKENS = SUPPORTED_TOKENS.filter((t) => t.listable);
const TOKEN_SYMBOLS = LISTABLE_TOKENS.map((t) => t.symbol);

type Mode = "offer" | "propose";

/** Pins the deal's plain-text terms as a small JSON document — the contract
 *  only ever sees the resulting ipfs:// URI, never the terms themselves. */
async function pinLicenseTerms(terms: SponsorshipTerms, siwsToken: string): Promise<string> {
  return uploadJsonToIpfs(
    {
      terms: terms.licenseText,
      transferable: terms.transferable,
      royaltyPercent: Number(terms.royaltyPercent || "0"),
    },
    siwsToken,
  );
}

export default function CreateSponsorshipPage() {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, address: activeAddress } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;
  const { getValidToken } = useSiwsToken();

  const [mode, setMode] = useState<Mode>("offer");
  const [selectedAsset, setSelectedAsset] = useState<OwnedAsset | null>(null);
  const [proposeContract, setProposeContract] = useState("");
  const [proposeTokenId, setProposeTokenId] = useState("");
  const [terms, setTerms] = useState<SponsorshipTerms>({ ...EMPTY_SPONSORSHIP_TERMS, paymentTokenSymbol: "USDC" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { tokens: ownedTokens, isLoading: assetsLoading } = useTokensByOwner(activeAddress ?? null, 1, 100);
  const ownedAssets: OwnedAsset[] = ownedTokens.map((t) => ({
    contractAddress: t.contractAddress,
    tokenId: t.tokenId,
    name: t.metadata?.name ?? `Token #${t.tokenId}`,
    image: resolveTokenImage(t.metadata?.image),
  }));

  const nftContract = mode === "offer" ? selectedAsset?.contractAddress : proposeContract.trim();
  const tokenId = mode === "offer" ? selectedAsset?.tokenId : proposeTokenId.trim();

  const onSubmit = async () => {
    if (!signer || !activeAddress) { toast.error("Connect a wallet first"); return; }
    if (!nftContract || !tokenId) { toast.error(mode === "offer" ? "Pick an asset first" : "Enter the asset's contract and token id"); return; }
    if (!terms.amount || Number(terms.amount) <= 0) { toast.error("Enter an amount"); return; }
    if (!terms.paymentTokenSymbol) { toast.error("Pick a currency"); return; }
    if (!terms.licenseText.trim()) { toast.error("Add license terms"); return; }
    const token = getTokenBySymbol(terms.paymentTokenSymbol);
    if (!token) { toast.error("Unsupported currency"); return; }
    const durationDays = Number(terms.durationDays);
    if (!durationDays || durationDays <= 0) { toast.error("Enter a license length"); return; }

    setIsSubmitting(true);
    try {
      const siwsToken = await getValidToken();
      if (!siwsToken) throw new Error("Sign in with your wallet to save the license terms.");
      const licenseTermsUri = await pinLicenseTerms(terms, siwsToken);

      const amount = BigInt(Math.round(Number(terms.amount) * 10 ** token.decimals));
      const royaltyBps = BigInt(Math.round(Number(terms.royaltyPercent || "0") * 100));
      const client = getMedialaneClient();

      if (mode === "offer") {
        await client.services.sponsorship.createOffer(signer, {
          nftContract,
          tokenId: BigInt(tokenId),
          minAmount: amount,
          duration: durationDays * 86400,
          paymentToken: token.address,
          licenseTermsUri,
          transferable: terms.transferable,
          royaltyBps,
        });
        rewardToast("create_sponsorship_offer");
      } else {
        await client.services.sponsorship.proposeSponsorship(signer, {
          nftContract,
          tokenId: BigInt(tokenId),
          amount,
          duration: durationDays * 86400,
          paymentToken: token.address,
          licenseTermsUri,
          transferable: terms.transferable,
          royaltyBps,
        });
      }

      setDone(true);
    } catch (err) {
      const t = uploadFailureToast(err);
      toast.error(t.title, { description: t.description });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-24 pb-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-brand-rose/10 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-brand-rose" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{mode === "offer" ? "Offer created" : "Proposal sent"}</h1>
          <p className="text-muted-foreground">
            {mode === "offer"
              ? "Sponsors can now bid on this asset. It will appear in the launchpad within a minute once indexed."
              : "The asset's owner can now accept or decline your proposal."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link href="/launchpad/sponsorship">Back to Sponsorship</Link>
          </Button>
          <Button
            onClick={() => {
              setDone(false);
              setSelectedAsset(null);
              setProposeContract("");
              setProposeTokenId("");
              setTerms({ ...EMPTY_SPONSORSHIP_TERMS, paymentTokenSymbol: "USDC" });
            }}
            className="bg-brand-rose hover:brightness-110 text-white"
          >
            Create another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ConnectGate title="Connect your wallet" subtitle="Connect your Starknet wallet to set up a sponsorship.">
      <ClaimRouteShell
        gated={false}
        icon={<Handshake className="h-4 w-4 text-white" />}
        title="Set up a sponsorship"
        subtitle="Either side can start the deal — offer your own asset for sponsors to bid on, or propose terms directly on one you'd like to sponsor."
      >
        <FadeIn>
          <div className="space-y-6">
            <div className="inline-flex rounded-full border border-border p-1 bg-card">
              {(["offer", "propose"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={
                    mode === m
                      ? "px-4 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-brand-purple to-brand-blue text-white"
                      : "px-4 py-1.5 rounded-full text-sm font-semibold text-muted-foreground"
                  }
                >
                  {m === "offer" ? "Offer my asset" : "Propose to sponsor"}
                </button>
              ))}
            </div>

            {mode === "offer" ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Pick an asset you own</p>
                <AssetPicker
                  assets={ownedAssets}
                  isLoading={assetsLoading}
                  selected={selectedAsset}
                  onSelect={setSelectedAsset}
                  emptyStateHref="/create/asset"
                  emptyStateLabel="Create one"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Which asset do you want to sponsor?</p>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    placeholder="Asset contract address (0x…)"
                    value={proposeContract}
                    onChange={(e) => setProposeContract(e.target.value)}
                  />
                  <Input
                    className="w-28"
                    placeholder="Token ID"
                    value={proposeTokenId}
                    onChange={(e) => setProposeTokenId(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Find these on the asset&apos;s page — copy the URL&apos;s contract address and token id.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-border/30">
              <LicenseTermsBuilder
                value={terms}
                onChange={setTerms}
                tokenOptions={TOKEN_SYMBOLS}
                amountLabel={mode === "offer" ? "Minimum accepted bid" : "Amount you'll pay"}
                disabled={isSubmitting}
              />
            </div>

            <Button
              size="lg"
              className="w-full rounded-xl bg-brand-rose hover:brightness-110 text-white"
              disabled={isSubmitting}
              onClick={onSubmit}
            >
              {isSubmitting
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{mode === "offer" ? "Creating…" : "Sending…"}</>
                : <><Handshake className="h-4 w-4 mr-2" />{mode === "offer" ? "Create offer" : "Send proposal"}</>}
            </Button>
          </div>
        </FadeIn>
      </ClaimRouteShell>
    </ConnectGate>
  );
}
