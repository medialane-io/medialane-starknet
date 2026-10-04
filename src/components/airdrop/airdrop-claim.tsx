"use client";

import { ConnectWallet } from "@/components/ConnectWallet";
import { GenesisMint } from "@/components/airdrop/genesis-mint";
import { useWallet } from "@/hooks/use-wallet";
import { MINT_CONTRACT, GENESIS_NFT_CID } from "@/lib/constants";

interface AirdropClaimProps {
  storageKey: string;
  locale?: "en" | "br";
}

export function AirdropClaim({ storageKey, locale = "en" }: AirdropClaimProps) {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return <ConnectWallet label="Connect wallet to claim" className="w-full" />;
  }

  return (
    <GenesisMint
      contract={MINT_CONTRACT}
      nftUri={GENESIS_NFT_CID}
      storageKey={storageKey}
      locale={locale}
    />
  );
}
