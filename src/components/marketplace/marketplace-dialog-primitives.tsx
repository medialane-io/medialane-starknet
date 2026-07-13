"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CurrencyIcon } from "@/components/shared/currency-icon";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceTxLink
// ─────────────────────────────────────────────────────────────────────────────

interface MarketplaceTxLinkProps {
  txHash: string;
  explorerUrl: string;
  className?: string;
}

export function MarketplaceTxLink({ txHash, explorerUrl, className }: MarketplaceTxLinkProps) {
  return (
    <a
      href={`${explorerUrl}/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      <span className="tabular-nums">{txHash.slice(0, 10)}…{txHash.slice(-8)}</span>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceProcessingState
// ─────────────────────────────────────────────────────────────────────────────

interface MarketplaceProcessingStateProps {
  title: string;
  description?: string;
  imageUrl?: string | null;
  imageAlt?: string;
  txHash?: string | null;
  explorerUrl?: string;
}

export function MarketplaceProcessingState({
  title,
  description = "Please wait, do not close this window.",
  imageUrl,
  imageAlt = "Token preview",
  txHash,
  explorerUrl,
}: MarketplaceProcessingStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 p-6 py-8">
      {imageUrl ? (
        <div className="relative h-20 w-20 rounded-2xl overflow-hidden border border-border shadow-md">
          <Image src={imageUrl} alt={imageAlt} width={80} height={80} className="h-full w-full object-cover" unoptimized />
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        </div>
      ) : (
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      )}
      <div className="text-center space-y-1">
        <p className="font-semibold">{title}</p>
        {txHash && explorerUrl ? (
          <MarketplaceTxLink txHash={txHash} explorerUrl={explorerUrl} className="mt-1" />
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceSuccessState
// ─────────────────────────────────────────────────────────────────────────────

interface MarketplaceSuccessStateProps {
  tokenImage?: string | null;
  name: string;
  title: string;
  description: ReactNode;
  txHash?: string | null;
  explorerUrl: string;
  onDone: () => void;
  footer?: ReactNode;
}

export function MarketplaceSuccessState({
  tokenImage,
  name,
  title,
  description,
  txHash,
  explorerUrl,
  onDone,
  footer,
}: MarketplaceSuccessStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 p-6 py-8">
      {tokenImage ? (
        <div className="relative">
          <div className="h-32 w-32 rounded-2xl overflow-hidden border border-border shadow-lg">
            <Image src={tokenImage} alt={name} width={128} height={128} className="h-full w-full object-cover" unoptimized />
          </div>
          <div className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-background">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-yellow-400" />
        </div>
      ) : (
        <div className="relative">
          <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
            <CheckCircle2 className="h-9 w-9 text-emerald-500" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-yellow-400" />
        </div>
      )}
      <div className="text-center space-y-1">
        <p className="font-bold text-xl">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {txHash && <MarketplaceTxLink txHash={txHash} explorerUrl={explorerUrl} />}
      <Button className="w-full h-11" onClick={onDone}>Done</Button>
      {footer}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceErrorState
// ─────────────────────────────────────────────────────────────────────────────

interface MarketplaceErrorStateProps {
  tokenImage?: string | null;
  name: string;
  title: string;
  description: ReactNode;
  error?: string | null;
  txHash?: string | null;
  explorerUrl: string;
  onRetry?: () => void;
  onDone: () => void;
  doneLabel?: string;
}

export function MarketplaceErrorState({
  tokenImage,
  name,
  title,
  description,
  error,
  txHash,
  explorerUrl,
  onRetry,
  onDone,
  doneLabel = "Done",
}: MarketplaceErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-5 p-6 py-8">
      {tokenImage ? (
        <div className="relative">
          <div className="h-32 w-32 rounded-2xl overflow-hidden border border-border shadow-lg">
            <Image src={tokenImage} alt={name} width={128} height={128} className="h-full w-full object-cover" unoptimized />
          </div>
          <div className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-destructive flex items-center justify-center shadow-lg border-2 border-background">
            <AlertCircle className="h-5 w-5 text-white" />
          </div>
        </div>
      ) : (
        <div className="h-16 w-16 rounded-full bg-destructive/15 flex items-center justify-center">
          <AlertCircle className="h-9 w-9 text-destructive" />
        </div>
      )}
      <div className="text-center space-y-1">
        <p className="font-bold text-xl">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {error ? (
        <Alert variant="destructive" className="text-left">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {txHash ? <MarketplaceTxLink txHash={txHash} explorerUrl={explorerUrl} /> : null}
      <div className="flex w-full gap-2">
        {onRetry ? (
          <Button variant="outline" className="flex-1 h-11" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        <Button className="flex-1 h-11" onClick={onDone}>{doneLabel}</Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MarketplaceDialogHero
// ─────────────────────────────────────────────────────────────────────────────

interface MarketplaceDialogHeroProps {
  tokenImage?: string | null;
  tokenName?: string;
  tokenId: string;
  fallbackIcon: ReactNode;
  badge?: ReactNode;
}

export function MarketplaceDialogHero({
  tokenImage,
  tokenName,
  tokenId,
  fallbackIcon,
  badge,
}: MarketplaceDialogHeroProps) {
  const name = tokenName || `Token #${tokenId}`;

  return (
    <div className="relative h-32 w-full bg-muted overflow-hidden shrink-0">
      {tokenImage ? (
        <Image src={tokenImage} alt={name} fill sizes="384px" className="h-full w-full object-cover" unoptimized />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-brand-blue/20 via-brand-purple/10 to-transparent flex items-center justify-center">
          {fallbackIcon}
        </div>
      )}
      {badge}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CurrencyPicker
// ─────────────────────────────────────────────────────────────────────────────

interface CurrencyPickerProps {
  currencies: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CurrencyPicker({ currencies, value, onChange, disabled }: CurrencyPickerProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {currencies.map((c) => (
        <Button
          key={c}
          type="button"
          variant={value === c ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(c)}
          disabled={disabled}
          className="gap-1 px-2 text-xs w-full"
        >
          <CurrencyIcon symbol={c} size={13} className="shrink-0" />
          <span className="truncate">{c}</span>
        </Button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DurationPicker
// ─────────────────────────────────────────────────────────────────────────────

interface DurationPickerProps {
  options: ReadonlyArray<{ label: string; seconds: number }>;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  cols?: 3 | 4;
}

export function DurationPicker({ options, value, onChange, disabled, cols = 3 }: DurationPickerProps) {
  return (
    <div className={cols === 4 ? "grid grid-cols-4 gap-2" : "grid grid-cols-3 gap-2"}>
      {options.map((opt) => (
        <Button
          key={opt.label}
          type="button"
          variant={value === opt.seconds ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(opt.seconds)}
          disabled={disabled}
          className="text-xs"
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
