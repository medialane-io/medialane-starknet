"use client";

import { useWallet } from "@/hooks/use-wallet";
import { ReceivedOffersTable } from "@/components/portfolio/received-offers-table";

export default function PortfolioReceivedPage() {
  const { address: walletAddress } = useWallet();
  return <ReceivedOffersTable address={walletAddress!} />;
}
