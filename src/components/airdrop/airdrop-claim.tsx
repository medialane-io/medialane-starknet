"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { ConnectWallet } from "@/components/ConnectWallet";
import { GenesisMint } from "@/components/airdrop/genesis-mint";
import type { PrivyInlineLocale } from "@/components/airdrop/privy-inline-login";

// Lazy-loaded: the static import pulled the whole @privy-io/react-auth bundle
// (~350 kB gz) into the first load of /mint and /airdrop. The hero paints
// immediately; the email login streams in behind it.
const PrivyInlineLogin = dynamic(
  () => import("@/components/airdrop/privy-inline-login").then((m) => m.PrivyInlineLogin),
  {
    ssr: false,
    loading: () => (
      <div className="h-40 w-full max-w-md animate-pulse rounded-2xl border border-border/40 bg-card/30" aria-hidden />
    ),
  },
);
import { useWallet } from "@/hooks/use-wallet";
import { MINT_CONTRACT, GENESIS_NFT_URI } from "@/lib/constants";

interface AirdropClaimProps {
  storageKey: string;
  locale?: PrivyInlineLocale;
}

/**
 * Shared CTA used on /mint and /airdrop. Shows the Privy email login when
 * disconnected, or the GenesisMint claim button once a wallet is connected.
 * Mounts a hidden ConnectWallet so the "Other ways to sign in" link can
 * programmatically open the wallet picker.
 */
export function AirdropClaim({ storageKey, locale = "en" }: AirdropClaimProps) {
  const { isConnected } = useWallet();
  const hiddenConnectRef = useRef<HTMLDivElement | null>(null);

  const openWalletPicker = () => {
    const btn = hiddenConnectRef.current?.querySelector("button");
    btn?.click();
  };

  return (
    <>
      {isConnected ? (
        <GenesisMint
          contract={MINT_CONTRACT}
          nftUri={GENESIS_NFT_URI}
          storageKey={storageKey}
          locale={locale}
        />
      ) : (
        <PrivyInlineLogin onOpenWalletPicker={openWalletPicker} locale={locale} />
      )}

      {/* Hidden ConnectWallet — programmatically triggered by the
          "Other ways to sign in" link in PrivyInlineLogin. */}
      <div ref={hiddenConnectRef} className="hidden">
        <ConnectWallet />
      </div>
    </>
  );
}
