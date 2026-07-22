"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { Handshake, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LicenseTermsBuilder, EMPTY_SPONSORSHIP_TERMS, type SponsorshipTerms } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { getMedialaneClient } from "@/lib/medialane-client";
import { uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";
import { rewardToast } from "@/lib/reward-toast";
import { getTokenBySymbol, SUPPORTED_TOKENS } from "@medialane/sdk";
import { toast } from "sonner";

const LISTABLE_TOKENS = SUPPORTED_TOKENS.filter((t) => t.listable);
const TOKEN_SYMBOLS = LISTABLE_TOKENS.map((t) => t.symbol);

interface SponsorSolicitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nftContract: string;
  tokenId: string;
  tokenName?: string;
  onSuccess?: () => void;
}

export function SponsorSolicitDialog({
  open, onOpenChange, nftContract, tokenId, tokenName, onSuccess,
}: SponsorSolicitDialogProps) {
  const { account } = useAccount();
  const { wallet: szWalletRaw } = useStarkZapWallet();
  const { walletType } = useWallet();
  const szWallet = walletType === "cartridge" || walletType === "privy" ? szWalletRaw : null;
  const signer = (szWallet ?? account) as AccountInterface | undefined;
  const { getValidToken } = useSiwsToken();

  const [terms, setTerms] = useState<SponsorshipTerms>({ ...EMPTY_SPONSORSHIP_TERMS, paymentTokenSymbol: "USDC" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async () => {
    if (!signer) { toast.error("Connect a wallet first"); return; }
    if (!terms.amount || Number(terms.amount) <= 0) { toast.error("Enter a minimum bid"); return; }
    if (!terms.licenseText.trim()) { toast.error("Add license terms"); return; }
    const token = getTokenBySymbol(terms.paymentTokenSymbol);
    if (!token) { toast.error("Unsupported currency"); return; }
    const durationDays = Number(terms.durationDays);
    if (!durationDays || durationDays <= 0) { toast.error("Enter a license length"); return; }

    setIsSubmitting(true);
    try {
      const siwsToken = await getValidToken();
      if (!siwsToken) throw new Error("Sign in with your wallet to save the license terms.");
      const licenseTermsUri = await uploadJsonToIpfs(
        { terms: terms.licenseText, transferable: terms.transferable, royaltyPercent: Number(terms.royaltyPercent || "0") },
        siwsToken,
      );

      const amount = BigInt(Math.round(Number(terms.amount) * 10 ** token.decimals));
      const royaltyBps = BigInt(Math.round(Number(terms.royaltyPercent || "0") * 100));
      const client = getMedialaneClient();

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

      setDone(true);
      onSuccess?.();
    } catch (err) {
      const t = uploadFailureToast(err);
      toast.error(t.title, { description: t.description });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {done ? (
          <div className="text-center space-y-4 py-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-brand-rose/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-brand-rose" />
              </div>
            </div>
            <div className="space-y-1">
              <DialogTitle>Offer created</DialogTitle>
              <DialogDescription>{tokenName ?? "This asset"} is open for sponsorship bids.</DialogDescription>
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full">Close</Button>
          </div>
        ) : (
          <>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-4 w-4 text-brand-rose" />
              Open {tokenName ?? "this asset"} for sponsorship
            </DialogTitle>
            <DialogDescription>Sponsors can bid on these terms — you accept whichever bid you want.</DialogDescription>
            <div className="space-y-4">
              <LicenseTermsBuilder
                value={terms}
                onChange={setTerms}
                tokenOptions={TOKEN_SYMBOLS}
                amountLabel="Minimum accepted bid"
                disabled={isSubmitting}
              />
              <Button size="lg" className="w-full rounded-xl bg-brand-rose hover:brightness-110 text-white" disabled={isSubmitting} onClick={onSubmit}>
                {isSubmitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
                  : <><Handshake className="h-4 w-4 mr-2" />Create offer</>}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
