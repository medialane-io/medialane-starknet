"use client";

import { useState } from "react";
import { useAccountSession } from "@/components/wallet-session-sync";
import { getMedialaneClient } from "@/lib/medialane-client";
import { Button } from "@medialane/ui/button";
import { Badge } from "@medialane/ui/badge";
import { CheckCircle2 } from "lucide-react";
import type { ApiCollectionProfile } from "@medialane/sdk";

export function CollectionSlugClaimSection({
  contract,
  profile,
}: {
  contract: string;
  profile: ApiCollectionProfile | null;
}) {
  const { ensureSignedIn } = useAccountSession();
  const [slugInput, setSlugInput] = useState("");
  const [checkState, setCheckState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [checkReason, setCheckReason] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleCheck = async () => {
    const slug = slugInput.toLowerCase().trim();
    if (!slug) return;
    setCheckState("checking");
    setCheckReason(null);
    try {
      const result = await getMedialaneClient().api.collections.slugAvailability(slug);
      setCheckState(result.available ? "available" : "taken");
      if (!result.available) setCheckReason(result.reason ?? "That slug is not available.");
    } catch {
      setCheckState("invalid");
      setCheckReason("Unable to check availability. Try again.");
    }
  };

  const handleSubmit = async () => {
    const slug = slugInput.toLowerCase().trim();
    if (!slug || checkState !== "available") return;
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      await ensureSignedIn();
      await getMedialaneClient().api.collections.submitSlugClaim(contract, slug);
      setSubmitState("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit claim.";
      setSubmitError(msg);
      setSubmitState("error");
    }
  };

  if (profile?.slug) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-medium">Active URL</span>
          <Badge variant="outline" className="text-2xs h-4 px-1.5 text-emerald-600 border-emerald-500/30">
            Active
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          medialane.io/collection/{profile.slug}
        </p>
      </div>
    );
  }

  if (submitState === "done") {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-4 space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Claim submitted</span>
          <Badge variant="outline" className="text-2xs h-4 px-1.5 text-amber-600 border-amber-500/30">
            Pending review
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Your claim for{" "}
          <span className="tabular-nums text-foreground">medialane.io/collection/{slugInput}</span>{" "}
          is under review.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
            medialane.io/collection/
          </span>
          <input
            type="text"
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50 min-w-0"
            placeholder="your-name"
            value={slugInput}
            onChange={(e) => {
              setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
              setCheckState("idle");
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCheck(); }}
            maxLength={20}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={!slugInput.trim() || checkState === "checking"}
          className="shrink-0"
        >
          {checkState === "checking" ? "Checking…" : "Check"}
        </Button>
      </div>

      {checkState === "available" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-emerald-600 font-medium truncate">
            ✓ Available — <span className="tabular-nums">medialane.io/collection/{slugInput}</span>
          </p>
          <Button size="sm" onClick={handleSubmit} disabled={submitState === "submitting"} className="shrink-0">
            {submitState === "submitting" ? "Claiming…" : "Claim this URL"}
          </Button>
        </div>
      )}

      {(checkState === "taken" || checkState === "invalid") && (
        <p className="text-xs text-destructive">{checkReason ?? "That slug is not available."}</p>
      )}

      {submitState === "error" && (
        <p className="text-xs text-destructive">{submitError}</p>
      )}

      <p className="text-xs text-muted-foreground">
        3–20 characters, lowercase letters, numbers, underscores or hyphens. Claims are reviewed before going live.
      </p>
    </div>
  );
}
