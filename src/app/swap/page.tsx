import type { Metadata } from "next";
import { SwapContent } from "./swap-content";

export const metadata: Metadata = {
  title: "Swap | Medialane",
  description: "Swap tokens instantly on Starknet. Trade ETH, STRK, USDC, USDT and more.",
};

export default function SwapPage() {
  return <SwapContent />;
}
