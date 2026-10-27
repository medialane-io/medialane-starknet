"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useMedialaneClient } from "@medialane/ui";
import { Input } from "@medialane/ui/input";
import type { ApiSearchResult } from "@medialane/sdk";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { resolveImage } from "@/lib/utils";
import { assetHref, collectionHref } from "@/lib/routes";

export function SearchInput({ value, onClear, ...props }: ComponentProps<typeof Input> & { value: string; onClear: () => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={value} className="pl-9 pr-9" {...props} />
      {value && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={onClear}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export function MarketplaceSearch() {
  const client = useMedialaneClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ApiSearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults(null);
      setOpen(false);
      return;
    }
    let current = true;
    client.api
      .search(debouncedQuery, 8)
      .then((res) => {
        if (!current) return;
        setResults(res.data);
        setOpen(true);
      })
      .catch(() => {
        if (current) setResults(null);
      });
    return () => {
      current = false;
    };
  }, [debouncedQuery, client]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const hasResults =
    results && ((results.tokens?.length ?? 0) > 0 || (results.collections?.length ?? 0) > 0);

  return (
    <div className="relative w-full sm:max-w-sm">
      <SearchInput
        placeholder="Search creative works"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => hasResults && setOpen(true)}
        onBlur={() => setOpen(false)}
        onClear={() => { setQuery(""); setResults(null); setOpen(false); }}
      />

      {open && hasResults && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {(results.tokens?.length ?? 0) > 0 && (
            <div>
              <div className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground bg-muted/30">
                Tokens
              </div>
              {results.tokens!.map((t) => {
                const img = resolveImage(t.image);
                return (
                  <Link
                    key={`${t.contractAddress}-${t.tokenId}`}
                    href={assetHref("STARKNET", t.contractAddress, t.tokenId)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="relative h-8 w-8 rounded-lg bg-muted shrink-0 overflow-hidden">
                      {img && <Image src={img} alt="" fill className="object-cover" unoptimized />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.name ?? `Token #${t.tokenId}`}</p>
                      <p className="text-xs text-muted-foreground tabular-nums truncate">{t.contractAddress.slice(0, 14)}…</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          {(results.collections?.length ?? 0) > 0 && (
            <div>
              <div className="px-3 py-1.5 text-2xs font-semibold text-muted-foreground bg-muted/30">
                Collections
              </div>
              {results.collections!.map((c) => {
                const imgUrl = resolveImage(c.image);
                return (
                  <Link
                    key={c.contractAddress}
                    href={collectionHref("STARKNET", c.contractAddress)}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-brand-purple/20 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                      {imgUrl ? (
                        <Image src={imgUrl} alt="" fill className="object-cover" unoptimized />
                      ) : (
                        <span>{c.name?.charAt(0) ?? "?"}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums truncate">{c.contractAddress.slice(0, 14)}…</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
