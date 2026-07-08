"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Zap, Palette, ShoppingBag, MessageSquare } from "lucide-react";
import { AddressDisplay } from "@/components/shared/address-display";
import { useLeaderboard } from "@/hooks/use-rewards";

const EARN_ACTIONS = [
  { icon: Zap, label: "Mint" },
  { icon: Palette, label: "Create" },
  { icon: ShoppingBag, label: "Trade" },
  { icon: MessageSquare, label: "Engage" },
];

const INFO_TILES = [
  { value: "50", label: "Levels" },
  { value: "XP", label: "Every action" },
  { value: "Fund", label: "Distribution" },
];

export function CommunityRewards() {
  const { data, isLoading } = useLeaderboard(1, 4);
  const members = data?.data ?? [];

  return (
    <section className="grid lg:grid-cols-2 gap-px bg-border/40 rounded-2xl overflow-hidden">

      {/* Left — info panel */}
      <div className="bg-card px-7 py-8 flex flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple text-white shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-base font-black">Community Rewards</h2>
        </div>

        <p className="text-sm font-semibold text-muted-foreground leading-snug">
          Earn XP. Share the Creator&apos;s Fund.
        </p>

        {/* Visual info tiles */}
        <div className="grid grid-cols-3 gap-2">
          {INFO_TILES.map(({ value, label }) => (
            <div
              key={label}
              className="rounded-xl border border-border/50 bg-muted/30 px-3 py-3.5 flex flex-col items-center text-center gap-1"
            >
              <span className="text-xl font-black">{value}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Earn action pills */}
        <div className="flex flex-wrap gap-2">
          {EARN_ACTIONS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              <Icon className="h-3 w-3" />
              {label}
            </div>
          ))}
        </div>

        <Link
          href="/rewards"
          className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-blue to-brand-purple px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          Start earning XP
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Right — member cards */}
      <div className="bg-card p-5">
        {!isLoading && members.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 h-full">
            {members.map((entry) => (
              <Link
                key={entry.address}
                href={`/creator/${entry.address}`}
                className="group relative rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 hover:border-border/70 overflow-hidden transition-all flex flex-col justify-between p-4"
              >
                {/* Brand gradient top rule */}
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-blue to-brand-purple" />

                {/* XP — hero number */}
                <div className="space-y-0.5 pt-1">
                  <p className="text-2xl font-black tabular-nums leading-none">
                    {entry.totalXp.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground">XP earned</p>
                </div>

                {/* Address */}
                <AddressDisplay
                  address={entry.address}
                  chars={4}
                  showCopy={false}
                  className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors"
                />
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 h-full">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-h-[100px] rounded-xl bg-muted/20 animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
