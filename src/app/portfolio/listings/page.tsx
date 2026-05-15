"use client";

import { useWallet } from "@/hooks/use-wallet";
import { ListingsTable } from "@/components/portfolio/listings-table";

export default function PortfolioListingsPage() {
  const { address: walletAddress } = useWallet();
  return <ListingsTable address={walletAddress!} />;
}
