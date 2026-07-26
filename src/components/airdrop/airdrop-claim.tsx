"use client";

import { ConnectWallet } from "@/components/ConnectWallet";
import { GenesisMint } from "@/components/airdrop/genesis-mint";
import { useWallet } from "@/hooks/use-wallet";
import { MINT_CONTRACT, GENESIS_NFT_URI } from "@/lib/constants";

interface AirdropClaimProps {
  storageKey: string;
  locale?: "en" | "br";
}

/**
 * Shared CTA used on /mint and /airdrop. Shows the wallet-connect CTA when
 * disconnected, or the GenesisMint claim button once a wallet is connected.
 */
export function AirdropClaim({ storageKey, locale = "en" }: AirdropClaimProps) {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return <ConnectWallet label="Connect wallet to claim" className="w-full" />;
  }

  return (
    <GenesisMint
      contract={MINT_CONTRACT}
      nftUri={GENESIS_NFT_URI}
      storageKey={storageKey}
      locale={locale}
    />
  );
}
