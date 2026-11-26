"use client";

import { CoinCreate } from "@medialane/ui";
import { coinHref } from "@/lib/routes";
import { PageAside } from "@medialane/ui/page-aside";

export default function CoinCreatePage() {
  return <CoinCreate aside={<PageAside kind="coin" />} tradeHref={(address) => coinHref("STARKNET", address)} />;
}
