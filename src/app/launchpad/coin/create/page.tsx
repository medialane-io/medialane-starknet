"use client";

import { CoinCreate } from "@medialane/ui";
import { coinHref } from "@/lib/routes";
import { CreateCoinAside } from "@/components/claim/create-coin-aside";

export default function CoinCreatePage() {
  return <CoinCreate aside={<CreateCoinAside />} tradeHref={(address) => coinHref("STARKNET", address)} />;
}
