"use client";

import { useWallet } from "@/hooks/use-wallet";
import { CounterOffersTable } from "@/components/portfolio/counter-offers-table";

export default function PortfolioCounterOffersPage() {
  const { address: walletAddress } = useWallet();
  return <CounterOffersTable address={walletAddress!} />;
}
