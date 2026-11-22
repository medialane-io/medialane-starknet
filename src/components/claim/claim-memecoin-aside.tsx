"use client";

import { Coins, UserCircle, TrendingUp } from "lucide-react";
import { ClaimRail } from "@medialane/ui";

export function ClaimMemecoinAside() {
  return (
    <ClaimRail
      included={[
        { icon: Coins, title: "Listed on the Coins page", desc: "Where people discover and trade coins on Medialane." },
        { icon: UserCircle, title: "On your profile", desc: "It appears alongside the rest of your work." },
        { icon: TrendingUp, title: "Discoverable & tradable", desc: "Anyone can find your coin and trade it." },
      ]}
      steps={[
        "Paste your coin's contract address",
        "We check on-chain that you own it",
        "Live once confirmed",
      ]}
      trustLead="Stays in your wallet."
      trust="Claiming only links the coin to the account."
    />
  );
}
