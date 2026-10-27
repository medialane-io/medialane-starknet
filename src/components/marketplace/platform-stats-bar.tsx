"use client";

import { usePlatformStats } from "@medialane/ui";

export function PlatformStatsBar() {
  const { stats } = usePlatformStats();

  const items = [
    { label: "Collections", value: stats?.collections },
    { label: "Assets", value: stats?.tokens },
    { label: "Sales", value: stats?.sales },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 pt-0.5">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm"
        >
          <span className="font-bold text-foreground">
            {value !== undefined ? value.toLocaleString() : "—"}
          </span>
          <span className="text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}
