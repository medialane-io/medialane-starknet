"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  useCollectionFilters, CollectionFiltersTrigger, CollectionFiltersBody,
} from "@medialane/ui";
import type { ApiToken, CollectionTokensSort } from "@medialane/sdk";

interface CollectionFiltersProps {
  tokens: ApiToken[];
  selected: Record<string, string[]>;
  onChange: (filters: Record<string, string[]>) => void;
  sort: CollectionTokensSort;
  onSortChange: (sort: CollectionTokensSort) => void;
}

export function CollectionFilters({
  tokens,
  selected,
  onChange,
  sort,
  onSortChange,
}: CollectionFiltersProps) {
  const [open, setOpen] = useState(false);
  const { traitSections, activeEntries, totalActiveCount, sortIsDefault, toggleValue, clearAll, removeFilter } =
    useCollectionFilters(tokens, selected, onChange, sort, onSortChange);

  return (
    <>
      <CollectionFiltersTrigger
        totalActiveCount={totalActiveCount}
        sortIsDefault={sortIsDefault}
        sort={sort}
        activeEntries={activeEntries}
        onOpen={() => setOpen(true)}
        onSortReset={() => onSortChange("recent")}
        onRemoveFilter={removeFilter}
        onClearAll={clearAll}
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 p-0 flex flex-col">
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-semibold">
                Filters
                {totalActiveCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[11px] font-medium">
                    {totalActiveCount} active
                  </Badge>
                )}
              </SheetTitle>
              {totalActiveCount > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </SheetHeader>

          <CollectionFiltersBody
            sort={sort}
            onSortChange={onSortChange}
            traitSections={traitSections}
            selected={selected}
            onToggleValue={toggleValue}
          />

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border shrink-0">
            <Button
              className="w-full"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {totalActiveCount > 0
                ? `Show results (${totalActiveCount} filter${totalActiveCount > 1 ? "s" : ""})`
                : "Close"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
