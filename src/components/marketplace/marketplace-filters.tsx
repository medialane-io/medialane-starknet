"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Input } from "@medialane/ui/input";
import { Button } from "@medialane/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@medialane/ui/dialog";
import { CurrencyIcon } from "@medialane/ui/currency-icon";
import { HelpIcon } from "@medialane/ui/help-icon";
import { IP_TYPES } from "@medialane/ui/data/ip";
import { getTokenBySymbol, parseAmount, SUPPORTED_TOKENS } from "@medialane/sdk";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { label: "Recent", value: "recent" },
  { label: "Price ↑", value: "price_asc" },
  { label: "Price ↓", value: "price_desc" },
];

const TYPE_OPTIONS = [
  { label: "All", value: "" },
  { label: "Listings", value: "listings" },
  { label: "Offers", value: "offers" },
];

const CURRENCY_OPTIONS = SUPPORTED_TOKENS.map((t) => ({
  label: t.symbol,
  value: t.symbol,
  icon: <CurrencyIcon symbol={t.symbol} size={13} />,
}));

function toRawAmount(value: string, decimals: number): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return parseAmount(trimmed, decimals);
  } catch {
    return undefined;
  }
}

export function useMarketplaceFilters() {
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState("recent");
  const [currency, setCurrency] = useState("");
  const [orderType, setOrderType] = useState("");
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const debouncedMin = useDebouncedValue(minInput, 400);
  const debouncedMax = useDebouncedValue(maxInput, 400);

  const decimals = getTokenBySymbol(currency)?.decimals ?? 18;
  const minPrice = minInput ? toRawAmount(debouncedMin, decimals) : undefined;
  const maxPrice = maxInput ? toRawAmount(debouncedMax, decimals) : undefined;

  const clearPrice = () => {
    setMinInput("");
    setMaxInput("");
  };

  const selectCurrency = (symbol: string) => {
    setCurrency(currency === symbol ? "" : symbol);
    clearPrice();
  };

  const reset = () => {
    setSort("recent");
    setCurrency("");
    setOrderType("");
    clearPrice();
  };

  const count = [sort !== "recent", currency, orderType, minPrice || maxPrice].filter(Boolean).length;

  return {
    open, setOpen,
    sort, setSort,
    currency, selectCurrency,
    orderType, setOrderType,
    minInput, setMinInput,
    maxInput, setMaxInput,
    minPrice, maxPrice,
    clearPrice, reset, count,
  };
}

export type MarketplaceFilters = ReturnType<typeof useMarketplaceFilters>;

const chipClass = (active: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap",
    active
      ? "border-primary bg-primary/10 text-primary font-medium"
      : "border-border text-muted-foreground hover:border-primary/50"
  );

function ChipGroup({ title, options, value, onSelect }: {
  title: string;
  options: { label: string; value: string; icon?: ReactNode }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-2xs font-semibold text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button key={opt.value} onClick={() => onSelect(opt.value)} className={chipClass(value === opt.value)}>
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function IpTypeChip({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={cn(
        "text-xs px-3 py-1 rounded-full border transition-colors whitespace-nowrap",
        pathname === href
          ? "border-primary bg-primary/10 text-primary font-medium"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

function ActiveChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary">
      {children}
      <button onClick={onClear} className="ml-0.5 hover:text-primary/60">×</button>
    </span>
  );
}

export function FiltersButton({ filters }: { filters: MarketplaceFilters }) {
  return (
    <button
      onClick={() => filters.setOpen(true)}
      className={cn(
        "relative flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors shrink-0",
        filters.count > 0
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      Filters
      {filters.count > 0 && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-2xs font-bold text-primary-foreground">
          {filters.count}
        </span>
      )}
    </button>
  );
}

export function ActiveFilters({ filters }: { filters: MarketplaceFilters }) {
  const { sort, setSort, orderType, setOrderType, currency, selectCurrency, minPrice, maxPrice, minInput, maxInput, clearPrice, count } = filters;
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {sort !== "recent" && (
        <ActiveChip onClear={() => setSort("recent")}>{SORT_OPTIONS.find((o) => o.value === sort)?.label}</ActiveChip>
      )}
      {orderType && (
        <ActiveChip onClear={() => setOrderType("")}>{TYPE_OPTIONS.find((o) => o.value === orderType)?.label}</ActiveChip>
      )}
      {currency && (
        <ActiveChip onClear={() => selectCurrency(currency)}>
          <CurrencyIcon symbol={currency} size={12} />
          {currency}
        </ActiveChip>
      )}
      {(minPrice || maxPrice) && (
        <ActiveChip onClear={clearPrice}>{minInput || "0"} – {maxInput || "∞"}</ActiveChip>
      )}
    </div>
  );
}

export function FiltersDialog({ filters }: { filters: MarketplaceFilters }) {
  const { open, setOpen, sort, setSort, orderType, setOrderType, currency, selectCurrency, minInput, setMinInput, maxInput, setMaxInput, reset, count } = filters;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="w-full max-w-sm sm:max-w-md p-0 overflow-hidden gap-0 flex flex-col max-h-[85svh]">

        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 pr-12">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Filters
          </DialogTitle>
          {count > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={reset}>
              Clear all
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <ChipGroup title="Sort" options={SORT_OPTIONS} value={sort} onSelect={setSort} />
          <ChipGroup title="Order type" options={TYPE_OPTIONS} value={orderType} onSelect={setOrderType} />
          <ChipGroup title="Currency" options={CURRENCY_OPTIONS} value={currency} onSelect={selectCurrency} />

          <div className="space-y-2">
            <p className="text-2xs font-semibold text-muted-foreground">Price range</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Min"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                className="h-9 text-sm"
                type="number"
                min="0"
              />
              <span className="text-sm text-muted-foreground shrink-0">–</span>
              <Input
                placeholder="Max"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                className="h-9 text-sm"
                type="number"
                min="0"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1 border-t border-border/60">
            <p className="flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
              IP Type
              <HelpIcon content="Filter by intellectual property category — Art, Audio, Video, Software, and more" side="right" />
            </p>
            <div className="flex flex-wrap gap-1.5">
              <IpTypeChip href="/marketplace" label="All" />
              {IP_TYPES.map((type) => (
                <IpTypeChip key={type} href={`/${type.toLowerCase()}`} label={type} />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/60">
          <Button className="w-full" onClick={() => setOpen(false)}>
            Apply filters
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
