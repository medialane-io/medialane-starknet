import { Skeleton } from "@/components/ui/skeleton";

export default function AssetLoading() {
  return (
    <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 pb-8 space-y-8">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-48" />

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-10 gap-6 items-start">
        {/* Image */}
        <Skeleton className="aspect-square w-full rounded-3xl" />

        {/* Right column — mirrors the live layout */}
        <div className="space-y-5">
          {/* Collection bar */}
          <div className="rounded-2xl bg-muted/40 p-3 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
            <Skeleton className="h-4 w-40" />
          </div>

          {/* Title block */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <div className="space-y-1.5 pt-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>

          {/* Owner row */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Marketplace panel */}
          <div className="rounded-2xl border border-border/40 p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-2xl" />
              ))}
            </div>
          </div>

          {/* Traits */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-14" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-24 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
