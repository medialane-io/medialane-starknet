"use client";

import { useWallet } from "@/hooks/use-wallet";
import { PortfolioActivity } from "@medialane/ui";

export default function PortfolioActivityPage() {
  const { address: walletAddress } = useWallet();
  return <PortfolioActivity address={walletAddress ?? null} />;
}
