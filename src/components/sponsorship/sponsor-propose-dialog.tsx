"use client";

import { useState } from "react";
import { useAccount } from "@starknet-react/core";
import { type AccountInterface } from "starknet";
import { Handshake, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LicenseTermsBuilder, EMPTY_SPONSORSHIP_TERMS, toLicenseMetadata, toDurationDays, type SponsorshipTerms } from "@medialane/ui";
import { useWallet } from "@/hooks/use-wallet";
import { useStarkZapWallet } from "@/contexts/starkzap-wallet-context";
import { useSiwsToken } from "@/hooks/use-siws-token";
import { getMedialaneClient } from "@/lib/medialane-client";
import { uploadJsonToIpfs } from "@/lib/ipfs-upload-client";
import { uploadFailureToast } from "@/lib/upload-error";
import { getTokenBySymbol, SUPPORTED_TOKENS } from "@medialane/sdk";
import { toast } from "sonner";

const LISTABLE_TOKENS = SUPPORTED_TOKENS.filter((t) => t.listable);
const TOKEN_SYMBOLS = LISTABLE_TOKENS.map((t) => t.symbol);

interface SponsorProposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nftContract: string;
  tokenId: string;
  tokenName?: string;
  onSuccess?: () => void;
}

export function SponsorProposeDialog({
  open, onOpenChange, nftContract, tokenId, tokenName, onSuccess,
}: SponsorProposeDialogProps) {
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
    if (!terms.amount || Number(terms.amount) <= 0) { toast.error("Add an amount before continuing"); return; }
    const token = getTokenBySymbol(terms.paymentTokenSymbol);
    if (!token) { toast.error("Pick a currency"); return; }
    const durationDays = toDurationDays(terms);
    if (!durationDays) { toast.error("How long should the license last?"); return; }

    setIsSubmitting(true);
    try {
      const siwsToken = await getValidToken();
      if (!siwsToken) throw new Error("Sign in with your wallet to save the license terms.");
      const licenseTermsUri = await uploadJsonToIpfs(toLicenseMetadata(terms), siwsToken);

      const amount = BigInt(Math.round(Number(terms.amount) * 10 ** token.decimals));
      const royaltyBps = BigInt(Math.round(Number(terms.royaltyPercent || "0") * 100));
      const client = getMedialaneClient();

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
              <DialogTitle>Proposal sent</DialogTitle>
              <DialogDescription>{tokenName ?? "The asset"}&apos;s owner can now accept or decline your proposal.</DialogDescription>
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full">Close</Button>
          </div>
        ) : (
          <>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-4 w-4 text-brand-rose" />
              Sponsor {tokenName ?? "this IP"}
            </DialogTitle>
            <DialogDescription>Tell the owner what you&apos;re offering. If they accept, you get your license the moment you pay — no escrow, no waiting.</DialogDescription>
            <div className="space-y-4">
              <LicenseTermsBuilder
                value={terms}
                onChange={setTerms}
                tokenOptions={TOKEN_SYMBOLS}
                amountLabel="Amount you'll pay"
                disabled={isSubmitting}
              />
              <div className="btn-border-animated p-[1px] rounded-2xl">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onSubmit}
                  className="w-full h-12 rounded-[15px] flex items-center justify-center gap-2 text-base font-semibold text-white bg-transparent transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                    : <><Handshake className="h-4 w-4" />Send proposal</>}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
