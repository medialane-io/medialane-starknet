"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Handshake, Loader2, X } from "lucide-react";
import { Button } from "@medialane/ui/button";
import { Skeleton } from "@medialane/ui/skeleton";
import { AddressDisplay } from "@medialane/ui/address-display";
import { useWallet } from "@/hooks/use-wallet";
import { useVenueSigner } from "@/lib/use-venue-signer";
import { useMedialaneClient } from "@/hooks/use-medialane-client";
import { executeIntent } from "@medialane/sdk/starknet";
import {
  useSponsorshipProposals, useSponsorshipOffers, useSponsorshipBids, useSponsorshipLicenses,
  type SponsorshipOffer,
} from "@/hooks/use-sponsorship";
import { assetHref } from "@/lib/routes";

function OfferBidsRow({ offer }: { offer: SponsorshipOffer }) {
  const { bids, isLoading, mutate } = useSponsorshipBids(offer.offerId);
  const { address: walletAddress } = useWallet();
  const signer = useVenueSigner();
  const client = useMedialaneClient();
  const [activeSponsor, setActiveSponsor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const acceptBid = async (sponsor: string) => {
    if (!signer || !walletAddress) { setActionError("Connect your wallet to continue."); return; }
    setActiveSponsor(sponsor);
    try {
      const intentRes = await client.api.acceptSponsorshipBidIntent({ author: walletAddress, offerId: offer.offerId, sponsor });
      if (intentRes.data.requiresSignature) throw new Error("Expected a prebuilt sponsorship-bid-accept intent");
      await executeIntent(signer, client, intentRes.data);
      await mutate();
    } catch (err) {
      console.error("accept bid failed", err);
      setActionError("That bid could not be accepted. Please try again.");
    } finally {
      setActiveSponsor(null);
    }
  };

  if (isLoading || bids.length === 0) return null;

  return (
    <div className="space-y-1.5 rounded-lg bg-muted/30 p-3">
      <p className="text-xs font-semibold text-muted-foreground">
        Bids on <Link href={assetHref("STARKNET", offer.nftContract, offer.tokenId)} className="underline underline-offset-2">View asset</Link>
      </p>
      {bids.map((bid) => (
        <div key={bid.id} className="flex items-center justify-between gap-2 text-xs">
          <AddressDisplay address={bid.sponsor} chars={4} showCopy={false} className="text-muted-foreground" />
          <Button size="sm" className="bg-brand-rose hover:brightness-110 text-white h-7 px-2.5" disabled={activeSponsor !== null} onClick={() => acceptBid(bid.sponsor)}>
            {activeSponsor === bid.sponsor ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
          </Button>
        </div>
      ))}
      {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
    </div>
  );
}

function ReceivedProposalsSection({ walletAddress }: { walletAddress: string }) {
  const { proposals, isLoading, mutate } = useSponsorshipProposals({ owner: walletAddress, open: true });
  const signer = useVenueSigner();
  const client = useMedialaneClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const respond = async (proposalId: string, decision: "accept" | "reject") => {
    if (!signer) { setActionError("Connect your wallet to continue."); return; }
    setActiveId(proposalId);
    try {
      const intentRes = decision === "accept"
        ? await client.api.acceptSponsorshipProposalIntent({ owner: walletAddress, proposalId })
        : await client.api.rejectSponsorshipProposalIntent({ owner: walletAddress, proposalId });
      if (intentRes.data.requiresSignature) throw new Error("Expected a prebuilt sponsorship-proposal response intent");
      await executeIntent(signer, client, intentRes.data);
      await mutate();
    } catch (err) {
      console.error("respond to proposal failed", err);
      setActionError("That response could not be completed. Please try again.");
    } finally {
      setActiveId(null);
    }
  };

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (proposals.length === 0) return <p className="text-sm text-muted-foreground">No proposals awaiting your decision.</p>;

  return (
    <div className="space-y-2">
      {proposals.map((p) => (
        <div key={p.id} className="bento-cell p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              <Link href={assetHref("STARKNET", p.nftContract, p.tokenId)} className="hover:underline">View asset</Link>
            </p>
            <p className="text-xs text-muted-foreground">
              <AddressDisplay address={p.proposer} chars={4} showCopy={false} /> proposed {p.amount}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" disabled={activeId !== null} onClick={() => respond(p.proposalId, "reject")}>
              {activeId === p.proposalId ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </Button>
            <Button size="sm" className="bg-brand-rose hover:brightness-110 text-white" disabled={activeId !== null} onClick={() => respond(p.proposalId, "accept")}>
              {activeId === p.proposalId ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      ))}
      {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
    </div>
  );
}

function SentProposalsSection({ walletAddress }: { walletAddress: string }) {
  const { proposals, isLoading, mutate } = useSponsorshipProposals({ proposer: walletAddress, open: true });
  const signer = useVenueSigner();
  const client = useMedialaneClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const withdraw = async (proposalId: string) => {
    if (!signer) { setActionError("Connect your wallet to continue."); return; }
    setActiveId(proposalId);
    try {
      const intentRes = await client.api.withdrawSponsorshipProposalIntent({ proposer: walletAddress, proposalId });
      if (intentRes.data.requiresSignature) throw new Error("Expected a prebuilt sponsorship-proposal-withdraw intent");
      await executeIntent(signer, client, intentRes.data);
      await mutate();
    } catch (err) {
      console.error("withdraw proposal failed", err);
      setActionError("That proposal could not be withdrawn. Please try again.");
    } finally {
      setActiveId(null);
    }
  };

  if (isLoading) return <Skeleton className="h-20 w-full rounded-xl" />;
  if (proposals.length === 0) return <p className="text-sm text-muted-foreground">No pending proposals sent.</p>;

  return (
    <div className="space-y-2">
      {proposals.map((p) => (
        <div key={p.id} className="bento-cell p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              <Link href={assetHref("STARKNET", p.nftContract, p.tokenId)} className="hover:underline">View asset</Link>
            </p>
            <p className="text-xs text-muted-foreground">You proposed {p.amount}</p>
          </div>
          <Button size="sm" variant="outline" disabled={activeId !== null} onClick={() => withdraw(p.proposalId)}>
            {activeId === p.proposalId ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
            Withdraw
          </Button>
        </div>
      ))}
      {actionError && <p role="alert" className="text-xs text-destructive">{actionError}</p>}
    </div>
  );
}

export default function PortfolioSponsorshipsPage() {
  const { address: walletAddress } = useWallet();
  const { offers } = useSponsorshipOffers(walletAddress ? { author: walletAddress, open: true } : undefined);
  const { licenses: held, isLoading: heldLoading } = useSponsorshipLicenses(walletAddress ? { holder: walletAddress } : undefined);
  const { licenses: issued, isLoading: issuedLoading } = useSponsorshipLicenses(walletAddress ? { author: walletAddress } : undefined);

  if (!walletAddress) return null;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2"><Handshake className="h-4 w-4 text-brand-rose" />Proposals awaiting your decision</h2>
        <ReceivedProposalsSection walletAddress={walletAddress} />
      </section>

      {offers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold">Bids on your offers</h2>
          <div className="space-y-2">
            {offers.map((o) => <OfferBidsRow key={o.id} offer={o} />)}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Proposals you&apos;ve sent</h2>
        <SentProposalsSection walletAddress={walletAddress} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Licenses you hold</h2>
        {heldLoading ? <Skeleton className="h-16 w-full rounded-xl" /> : held.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sponsorship licenses yet.</p>
        ) : (
          <div className="space-y-2">
            {held.map((l) => (
              <div key={l.id} className="bento-cell p-4">
                <p className="text-sm font-semibold">
                  <Link href={assetHref("STARKNET", l.assetContract, l.assetTokenId)} className="hover:underline">License on this asset</Link>
                </p>
                <p className="text-xs text-muted-foreground">from <AddressDisplay address={l.author} chars={4} showCopy={false} /></p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold">Licenses issued on your work</h2>
        {issuedLoading ? <Skeleton className="h-16 w-full rounded-xl" /> : issued.length === 0 ? (
          <p className="text-sm text-muted-foreground">No licenses issued yet.</p>
        ) : (
          <div className="space-y-2">
            {issued.map((l) => (
              <div key={l.id} className="bento-cell p-4">
                <p className="text-sm font-semibold">
                  <Link href={assetHref("STARKNET", l.assetContract, l.assetTokenId)} className="hover:underline">License on this asset</Link>
                </p>
                <p className="text-xs text-muted-foreground">held by <AddressDisplay address={l.currentHolder ?? l.recipient} chars={4} showCopy={false} /></p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
