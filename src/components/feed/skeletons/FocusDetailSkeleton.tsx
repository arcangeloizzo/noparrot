import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for FocusDetailSheet content - shows while deepContent loads.
 * Maintains the same spacing as final content to prevent layout shift.
 */
export const FocusDetailSkeleton = () => {
  return (
    <div className="space-y-6 py-6">
      {/* Deep content section */}
      <div>
        <Skeleton className="h-4 w-32 mb-3" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for sources section in FocusDetailSheet.
 */
export const SourcesSkeleton = () => {
  return (
    <div className="py-4 border-t border-white/10">
      <Skeleton className="h-4 w-48 mb-3" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
};
