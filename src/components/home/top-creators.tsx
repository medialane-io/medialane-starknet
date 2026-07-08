"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { AddressDisplay } from "@/components/shared/address-display";
import { useLeaderboard } from "@/hooks/use-rewards";

export function TopCreators() {
  const { data, isLoading } = useLeaderboard(1, 5);
  if (isLoading || !data || data.data.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-purple text-white shrink-0">
            <Trophy className="h-4 w-4" />
          </div>
          <h2 className="text-base font-black">Community Rewards</h2>
        </div>
        <Link
          href="/rewards"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          View all →
        </Link>
      </div>

      <ol className="divide-y divide-border/50">
        {data.data.map((entry, index) => (
          <li key={entry.address} className="flex items-center gap-3 px-5 py-3">
            <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground tabular-nums">
              {index + 1}
            </span>
            <div
              className="h-8 w-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-black text-white"
              style={{ backgroundColor: entry.badgeColor }}
            >
              {entry.currentLevel}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/creator/${entry.address}`}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                <AddressDisplay address={entry.address} chars={5} showCopy={false} />
              </Link>
              <p className="text-xs text-muted-foreground">{entry.currentLevelName}</p>
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
              {entry.totalXp.toLocaleString()}
              <span className="ml-0.5 text-xs font-normal text-muted-foreground"> XP</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
