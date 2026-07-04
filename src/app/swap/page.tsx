import type { Metadata } from "next";
import { SwapContent } from "./swap-content";
import { canonical, buildSocialMetadata } from "@/lib/seo";

const title = "Swap";
const description = "Swap tokens instantly on Starknet. Trade ETH, STRK, USDC, USDT and more.";

export const metadata: Metadata = {
  title,
  description,
  alternates: canonical("/swap"),
  ...buildSocialMetadata({ title, description }),
};

export default function SwapPage() {
  return <SwapContent />;
}
