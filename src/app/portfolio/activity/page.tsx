"use client";

import { useWallet } from "@/hooks/use-wallet";
import { PortfolioActivity } from "@/components/portfolio/portfolio-activity";

export default function PortfolioActivityPage() {
  const { address: walletAddress } = useWallet();
  return <PortfolioActivity address={walletAddress ?? null} />;
}
