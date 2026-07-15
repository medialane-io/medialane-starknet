"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { getMedialaneClient } from "@/lib/medialane-client";

interface SponsorshipAcceptButtonProps {
  offerId: string;
  sponsor: string;
  licenseTermsUri: string;
  onAccepted?: () => void;
}

/**
 * Author-only. Settles the sponsor's payment (allowance pull inside
 * accept_bid, no escrow) and mints a non-authoritative receipt NFT to the
 * sponsor via the dedicated sponsorship-license instance — never the
 * genesis-mint instance. `is_license_valid()` on IPSponsorship stays the
 * sole authority for gating; the receipt is a wallet-visible courtesy only.
 */
export function SponsorshipAcceptButton({ offerId, sponsor, licenseTermsUri, onAccepted }: SponsorshipAcceptButtonProps) {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType, isConnected } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!signer) { toast.error("Connect a wallet first"); return; }
    setIsSubmitting(true);
    try {
      const client = getMedialaneClient();
      await client.services.sponsorship.acceptBid(signer, { offerId, sponsor, licenseTermsUri });
      toast.success("Bid accepted — license sent to sponsor");
      onAccepted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept bid");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={handleAccept} disabled={!isConnected || isSubmitting}>
      {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      Accept
    </Button>
  );
}
