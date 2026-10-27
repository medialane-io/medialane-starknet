"use client";

import { AtSign, Loader2 } from "lucide-react";
import { Button } from "@medialane/ui/button";
import { Input } from "@medialane/ui/input";
import type { UsernameClaimForm } from "@/hooks/use-username-claim-form";

export function UsernameInput({ form, disabled }: { form: UsernameClaimForm; disabled: boolean }) {
  const { input, setInput, claiming, checkState, checkReason, check, claim } = form;
  const isAvailable = checkState === "available";
  const isChecking = checkState === "checking";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <AtSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-7 tabular-nums"
            placeholder="yourname"
            value={input}
            onChange={(e) => setInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            maxLength={20}
            disabled={claiming || isChecking}
            onKeyDown={(e) => e.key === "Enter" && !claiming && !isChecking && (isAvailable ? claim() : check())}
          />
        </div>
        {isAvailable ? (
          <Button
            onClick={claim}
            disabled={claiming || disabled}
            className="bg-green-600 hover:bg-green-700 text-white shrink-0"
          >
            {claiming ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Submitting…</> : `Claim @${input}`}
          </Button>
        ) : (
          <Button
            onClick={check}
            disabled={isChecking || disabled || input.length < 3}
            variant="outline"
            className="shrink-0"
          >
            {isChecking ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Checking…</> : "Check"}
          </Button>
        )}
      </div>
      {checkState === "taken" && (
        <p className="text-xs text-destructive">{checkReason ?? "That username is not available."}</p>
      )}
      {checkState === "available" && (
        <p className="text-xs text-green-600 dark:text-green-500 font-medium">@{input} is available!</p>
      )}
    </div>
  );
}
