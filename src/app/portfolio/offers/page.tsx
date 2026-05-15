"use client";

import { useWallet } from "@/hooks/use-wallet";
import { OffersTable } from "@/components/portfolio/offers-table";

export default function PortfolioOffersPage() {
  const { address: walletAddress } = useWallet();
  return <OffersTable address={walletAddress!} />;
}
