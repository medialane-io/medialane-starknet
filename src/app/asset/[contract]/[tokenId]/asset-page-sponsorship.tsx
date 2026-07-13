"use client";

/**
 * Sponsorship affordance for an asset page — NOT yet wired into
 * asset-page-standard.tsx/asset-page-edition.tsx (see the 2026-07-02
 * Launchpad plan: deferred to avoid touching a file in the direct blast
 * radius of feat/asset-page-redesign, which is actively rewriting
 * AssetMarketplacePanel). Self-contained and ready to render once wired.
 *
 * Per the approved design, this only ever renders for Medialane-native
 * assets (mip-erc721/ip-erc721/mip-erc1155) — callers must gate on
 * collection.service before rendering this component; it does not gate
 * itself.
 */

import { useState } from "react";
import { rewardToast } from "@/lib/reward-toast";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { Handshake, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useSponsorshipOffers } from "@/hooks/use-sponsorship";
import { getMedialaneClient } from "@/lib/medialane-client";
import { getTokenBySymbol } from "@medialane/sdk";
import { toast } from "sonner";

export interface AssetPageSponsorshipProps {
  nftContract: string;
  tokenId: string;
  /** True when the connected wallet currently owns this asset. */
  isOwner: boolean;
}

export function AssetPageSponsorship({ nftContract, tokenId, isOwner }: AssetPageSponsorshipProps) {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, isConnected } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;

  const { offers, isLoading, mutate } = useSponsorshipOffers(nftContract);
  const tokenOffers = offers.filter((o) => o.tokenId === tokenId && o.open);

  const [minAmount, setMinAmount] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [paymentToken, setPaymentToken] = useState("USDC");
  const [licenseTermsUri, setLicenseTermsUri] = useState("");
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onCreateOffer = async () => {
    if (!signer) { toast.error("Connect a wallet first"); return; }
    const token = getTokenBySymbol(paymentToken);
    if (!token) { toast.error("Unsupported payment token"); return; }
    setIsSubmitting(true);
    try {
      const client = getMedialaneClient();
      await client.services.sponsorship.createOffer(signer, {
        nftContract,
        tokenId: BigInt(tokenId),
        minAmount: BigInt(Math.round(Number(minAmount) * 10 ** token.decimals)),
        duration: Number(durationDays) * 86400,
        paymentToken: token.address,
        licenseTermsUri,
        transferable: true,
      });
      toast.success("Sponsorship offer created");
      rewardToast("create_sponsorship_offer");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create offer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPlaceBid = async (offer: (typeof tokenOffers)[number]) => {
    if (!signer) { toast.error("Connect a wallet first"); return; }
    const amount = bidAmounts[offer.offerId];
    if (!amount) { toast.error("Enter a bid amount"); return; }
    setIsSubmitting(true);
    try {
      const client = getMedialaneClient();
      await client.services.sponsorship.placeBid(signer, {
        offerId: offer.offerId,
        amount: BigInt(Math.round(Number(amount) * 1e6)), // assumes USDC-class 6-decimal token; refine once a real offer's paymentToken decimals are resolved
        paymentToken: offer.paymentToken,
      });
      toast.success("Bid placed");
      rewardToast("place_sponsorship_bid");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to place bid");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/40 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Handshake className="h-4 w-4 text-brand-rose" />
        <p className="font-semibold text-sm">Sponsorship</p>
      </div>

      {isOwner ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Create a sponsorship offer for this asset — sponsors bid, you accept, they receive a license.
          </p>
          <div className="flex gap-2">
            <Input type="number" min={0} step="0.01" placeholder="Min amount" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
            <Input className="w-24" placeholder="Token" value={paymentToken} onChange={(e) => setPaymentToken(e.target.value.toUpperCase())} />
          </div>
          <div className="flex gap-2">
            <Input type="number" min={1} placeholder="Duration (days)" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
          </div>
          <Input placeholder="License terms URI (ipfs://…)" value={licenseTermsUri} onChange={(e) => setLicenseTermsUri(e.target.value)} />
          <Button size="sm" className="w-full" disabled={isSubmitting || !isConnected} onClick={onCreateOffer}>
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Create Offer
          </Button>
        </div>
      ) : isLoading ? (
        <p className="text-xs text-muted-foreground">Loading offers…</p>
      ) : tokenOffers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No open sponsorship offers on this asset yet.</p>
      ) : (
        <div className="space-y-3">
          {tokenOffers.map((offer) => (
            <div key={offer.offerId} className="rounded-xl border border-border/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">Min: {offer.minAmount} · {offer.duration}s license</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Your bid"
                  value={bidAmounts[offer.offerId] ?? ""}
                  onChange={(e) => setBidAmounts((prev) => ({ ...prev, [offer.offerId]: e.target.value }))}
                />
                <Button size="sm" disabled={isSubmitting || !isConnected} onClick={() => onPlaceBid(offer)}>
                  Place Bid
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
