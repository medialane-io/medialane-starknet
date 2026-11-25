"use client";

import { CoinCreate } from "@medialane/ui";
import { coinHref } from "@/lib/routes";
import { CreateAside } from "@medialane/ui/create-aside";

export default function CoinCreatePage() {
  return <CoinCreate aside={<CreateAside kind="coin" />} tradeHref={(address) => coinHref("STARKNET", address)} />;
}
