"use client";

import { Lock, Loader2, Unlock, Sparkles, ShoppingBag } from "lucide-react";
import type { GatedContentState } from "@/hooks/use-gated-content";
import { GATED_CONTENT_TYPES, GATED_CONTENT_TYPE_FALLBACK } from "@medialane/ui";

interface GatedContentPanelProps {
  state: GatedContentState;
  onBrowseListings?: () => void;
}

export function GatedContentPanel({ state, onBrowseListings }: GatedContentPanelProps) {
  if (state.status === "not_connected") {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-center max-w-sm mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-base font-semibold">Connect wallet to unlock</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            This collection has exclusive content for holders. Connect your wallet so we can verify.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="py-16 flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">Verifying your holdings…</p>
      </div>
    );
  }

  if (state.status === "not_holder") {
    return (
      <div className="py-16 flex flex-col items-center gap-5 text-center max-w-sm mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-base font-semibold">Holders only</p>
          <p className="text-sm text-muted-foreground mt-1">
            You need at least one token from this collection to access exclusive content.
          </p>
        </div>
        <button
          onClick={onBrowseListings}
          className="inline-flex items-center gap-2 bg-foreground text-background hover:opacity-90 font-semibold px-5 py-2.5 rounded-xl transition-all text-sm"
        >
          <ShoppingBag className="h-4 w-4" />
          Browse listings
        </button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="py-16 flex flex-col items-center gap-3 text-center max-w-sm mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Lock className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium">Couldn&apos;t verify your holdings</p>
        <p className="text-xs text-muted-foreground">Try refreshing the page.</p>
      </div>
    );
  }

  const { content } = state;
  const { icon: Icon, cta } = content.type
    ? (GATED_CONTENT_TYPES[content.type] ?? GATED_CONTENT_TYPE_FALLBACK)
    : GATED_CONTENT_TYPE_FALLBACK;

  return (
    <div className="py-8 flex flex-col items-center gap-6 text-center max-w-md mx-auto">
      <div className="relative">
        <div className="h-20 w-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
          <Unlock className="h-10 w-10" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xl font-bold">You&apos;re in</p>
        {content.title && (
          <p className="text-sm text-muted-foreground">{content.title}</p>
        )}
      </div>

      <a
        href={content.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm active:scale-[0.98]"
      >
        <Icon className="h-5 w-5" />
        {cta}
      </a>

      <p className="text-xs text-muted-foreground/60">
        This link is exclusive to holders of this collection.
      </p>
    </div>
  );
}
