"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Palette, ShoppingBag, Zap, MessageSquare } from "lucide-react";
import { AddressDisplay } from "@/components/shared/address-display";
import { useLeaderboard } from "@/hooks/use-rewards";

const EARN_ACTIONS = [
  { icon: Zap, label: "Mint" },
  { icon: Palette, label: "Create" },
  { icon: ShoppingBag, label: "Trade" },
  { icon: MessageSquare, label: "Engage" },
];

export function TopCreators() {
  const { data, isLoading } = useLeaderboard(1, 4);
  const members = data?.data ?? [];

  return (
    <section className="grid lg:grid-cols-2 gap-px bg-border/30 rounded-2xl overflow-hidden">

      {/* Left — program pitch */}
      <div className="bg-card px-7 py-8 flex flex-col gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple text-white shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-base font-black">Community Rewards</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
            Every action you take earns XP. Active community members receive
            allocations from the Creator&apos;s Fund — the more you participate,
            the more you earn.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {EARN_ACTIONS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-full bg-muted/50 border border-border/50 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              <Icon className="h-3 w-3" />
              {label}
            </div>
          ))}
        </div>

        <Link
          href="/rewards"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:opacity-80 transition-opacity mt-auto"
        >
          Explore rewards program
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Right — active member spotlights (no rank numbers) */}
      <div className="bg-card px-7 py-8 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Active members
          </p>
          <Link
            href="/rewards"
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>

        {!isLoading && members.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {members.map((entry) => (
              <Link
                key={entry.address}
                href={`/creator/${entry.address}`}
                className="group rounded-xl p-3.5 bg-muted/30 hover:bg-muted/50 border border-border/40 hover:border-border/70 transition-all flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-black text-white"
                    style={{ backgroundColor: entry.badgeColor }}
                  >
                    {entry.currentLevel}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {entry.currentLevelName}
                  </span>
                </div>
                <AddressDisplay
                  address={entry.address}
                  chars={4}
                  showCopy={false}
                  className="text-xs font-semibold group-hover:text-primary transition-colors"
                />
                <p className="text-sm font-black tabular-nums">
                  {entry.totalXp.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">XP</span>
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/20 animate-pulse h-24" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
