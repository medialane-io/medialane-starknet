"use client";

import { Lock, ShieldCheck, Wallet, KeyRound, ArrowLeftRight } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function CreateCoinAside() {
  return (
    <ClaimRail
      included={[
        { icon: ShieldCheck, title: "Fixed supply forever", desc: "Minting is disabled the moment your coin is created." },
        { icon: Wallet, title: "Purchased at market price", desc: "Capped at 10% and bought from the pool at your own price." },
        { icon: KeyRound, title: "Ownership renounced", desc: "Renounced automatically at launch." },
        { icon: ArrowLeftRight, title: "You choose the pair", desc: "Pick any supported token." },
      ]}
      steps={[
        "Design your coin's face and story",
        "Set your coin's economics",
        "Launch your coin",
      ]}
      trustIcon={Lock}
      trustLead="Locked forever."
      trust="Liquidity is locked and fees stay collectible."
    />
  );
}
