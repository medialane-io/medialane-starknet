"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { Handshake, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ConnectGate } from "@/components/connect-gate";
import { ClaimRouteShell } from "@/components/claim/claim-route-shell";
import { AssetPicker, AssetSearchPicker, LicenseTermsBuilder, EMPTY_SPONSORSHIP_TERMS, toLicenseMetadata, toDurationDays, type OwnedAsset, type SponsorshipTerms } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useTokensByOwner } from "@/hooks/use-tokens";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { usePendingProposalsForAsset } from "@/hooks/use-sponsorship";
import { getMedialaneClient } from "@/lib/medialane-client";
import { uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";
import { rewardToast } from "@/lib/reward-toast";
import { resolveTokenImage, shortenAddress } from "@/lib/utils";
import { getTokenBySymbol, SUPPORTED_TOKENS } from "@medialane/sdk";
import { MEDIALANE_BACKEND_URL, MEDIALANE_API_KEY } from "@/lib/constants";
import { toast } from "sonner";
import { FadeIn } from "@/components/ui/motion-primitives";

const LISTABLE_TOKENS = SUPPORTED_TOKENS.filter((t) => t.listable);
const TOKEN_SYMBOLS = LISTABLE_TOKENS.map((t) => t.symbol);

type Mode = "offer" | "propose";

/** Pending proposals on a specific owned asset, with accept/reject actions. */
function PendingProposalsPanel({ nftContract, signer }: { nftContract: string; signer: AccountInterface | undefined }) {
  const { proposals, isLoading, mutate } = usePendingProposalsForAsset(nftContract);
  const [activeId, setActiveId] = useState<string | null>(null);

  const respond = async (proposalId: string, action: "acceptProposal" | "rejectProposal") => {
    if (!signer) { toast.error("Connect a wallet first"); return; }
    setActiveId(proposalId);
    try {
      const client = getMedialaneClient();
      await client.services.sponsorship[action](signer, { proposalId });
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to respond to proposal");
    } finally {
      setActiveId(null);
    }
  };

  if (isLoading || proposals.length === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border border-border/40 p-3">
      <p className="text-xs font-semibold text-muted-foreground">Pending proposals on this asset</p>
      {proposals.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted-foreground">{shortenAddress(p.proposer)} — {p.amount}</span>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" disabled={activeId !== null} onClick={() => respond(p.proposalId, "rejectProposal")}>
              {activeId === p.proposalId ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </Button>
            <Button size="sm" className="bg-brand-rose hover:brightness-110 text-white" disabled={activeId !== null} onClick={() => respond(p.proposalId, "acceptProposal")}>
              {activeId === p.proposalId ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Pins the deal's terms as a small JSON document — the contract only ever
 *  sees the resulting ipfs:// URI, never the terms themselves. */
async function pinLicenseTerms(terms: SponsorshipTerms, siwsToken: string): Promise<string> {
  return uploadJsonToIpfs(toLicenseMetadata(terms), siwsToken);
}

export default function CreateSponsorshipPage() {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, address: activeAddress } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;
  const { getValidToken } = useSiwsToken();

  const [mode, setMode] = useState<Mode>("propose");
  const [selectedAsset, setSelectedAsset] = useState<OwnedAsset | null>(null);
  const [proposeAsset, setProposeAsset] = useState<OwnedAsset | null>(null);
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

  // search callback — this app's backend fetch has no shared apiFetch wrapper
  // (see use-sponsorship.ts's own backendFetch), so build the request directly
  const searchAssets = async (query: string): Promise<OwnedAsset[]> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (MEDIALANE_API_KEY) headers["x-api-key"] = MEDIALANE_API_KEY;
    const res = await fetch(`${MEDIALANE_BACKEND_URL.replace(/\/$/, "")}/v1/search?q=${encodeURIComponent(query)}&limit=16`, { headers });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const json: { data: { tokens: { contractAddress: string; tokenId: string; name: string | null; image: string | null }[] } } = await res.json();
    return json.data.tokens.map((t) => ({
      contractAddress: t.contractAddress,
      tokenId: t.tokenId,
      name: t.name ?? `Token #${t.tokenId}`,
      image: t.image ? resolveTokenImage(t.image) : null,
    }));
  };

  const nftContract = mode === "offer" ? selectedAsset?.contractAddress : proposeAsset?.contractAddress;
  const tokenId = mode === "offer" ? selectedAsset?.tokenId : proposeAsset?.tokenId;

  const onSubmit = async () => {
    if (!signer || !activeAddress) { toast.error("Connect a wallet first"); return; }
    if (!nftContract || !tokenId) { toast.error(mode === "offer" ? "Choose which asset you're offering" : "Search for the asset you want to sponsor and pick it"); return; }
    if (!terms.amount || Number(terms.amount) <= 0) { toast.error("Add an amount before continuing"); return; }
    if (!terms.paymentTokenSymbol) { toast.error("Pick a currency"); return; }
    const token = getTokenBySymbol(terms.paymentTokenSymbol);
    if (!token) { toast.error("Pick a currency"); return; }
    const durationDays = toDurationDays(terms);
    if (!durationDays) { toast.error("How long should the license last?"); return; }

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

  return (
    <ConnectGate title="Connect your wallet" subtitle="Connect your Starknet wallet to set up a sponsorship.">
      <ClaimRouteShell
        gated={false}
        icon={<Handshake className="h-4 w-4 text-white" />}
        title="Set up a sponsorship"
        subtitle="Found IP you'd like to back? Propose terms directly to its owner. Own something worth sponsoring? Post it and let sponsors bid."
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
                  emptyStateHref="/launchpad/single-editions"
                  emptyStateLabel="Create one"
                />
                {selectedAsset ? <PendingProposalsPanel nftContract={selectedAsset.contractAddress} signer={signer} /> : null}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Which asset do you want to sponsor?</p>
                <AssetSearchPicker
                  search={searchAssets}
                  selected={proposeAsset}
                  onSelect={setProposeAsset}
                  placeholder="Search by asset name or creator"
                />
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

            <div className="btn-border-animated p-[1px] rounded-2xl">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onSubmit}
                className="w-full h-12 rounded-[15px] flex items-center justify-center gap-2 text-base font-semibold text-white bg-transparent transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" />{mode === "offer" ? "Creating…" : "Sending…"}</>
                  : <><Handshake className="h-4 w-4" />{mode === "offer" ? "Create offer" : "Send proposal"}</>}
              </button>
            </div>
          </div>
        </FadeIn>
      </ClaimRouteShell>

      <Dialog open={isSubmitting || done} onOpenChange={(open) => { if (!open) setDone(false); }}>
        <DialogContent className="max-w-md">
          {isSubmitting ? (
            <div className="text-center space-y-4 py-4">
              <Loader2 className="h-10 w-10 animate-spin text-brand-rose mx-auto" />
              <div className="space-y-1">
                <DialogTitle>{mode === "offer" ? "Creating your sponsorship offer…" : "Sending your proposal…"}</DialogTitle>
                <DialogDescription>Confirm in your wallet, then hang tight — this settles onchain.</DialogDescription>
              </div>
            </div>
          ) : done ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-brand-rose/10 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-brand-rose" />
                </div>
              </div>
              <div className="space-y-1">
                <DialogTitle>{mode === "offer" ? "Offer created" : "Proposal sent"}</DialogTitle>
                <DialogDescription>
                  {mode === "offer"
                    ? "Sponsors can now bid on this asset. It will appear in the launchpad within a minute once indexed."
                    : "The asset's owner can now accept or decline your proposal."}
                </DialogDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/launchpad/sponsorship">Back to Sponsorship</Link>
                </Button>
                <Button
                  className="flex-1 bg-brand-rose hover:brightness-110 text-white"
                  onClick={() => {
                    setDone(false);
                    setSelectedAsset(null);
                    setProposeAsset(null);
                    setTerms({ ...EMPTY_SPONSORSHIP_TERMS, paymentTokenSymbol: "USDC" });
                  }}
                >
                  Create another
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </ConnectGate>
  );
}
