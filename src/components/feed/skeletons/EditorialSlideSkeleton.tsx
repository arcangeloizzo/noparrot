import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for EditorialSlide (Il Punto) - matches the exact layout.
 * Maintains visual hierarchy and prevents layout shift during loading.
 */
export const EditorialSlideSkeleton = () => {
  return (
    <div className="h-[100dvh] w-full snap-start relative flex flex-col overflow-hidden">
      {/* Editorial Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F14] via-[#121A23] to-[#0A0F14] z-0" />
      
      {/* Content Layer */}
      <div className="relative z-10 w-full h-full flex flex-col pt-14 pb-24">
        <div className="flex-1 px-6 flex flex-col justify-center">
          {/* Header badge skeleton */}
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-4 w-36" />
          </div>

          {/* Source attribution skeleton */}
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>

          {/* Title skeleton */}
          <div className="space-y-2 mb-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>

          {/* Summary skeleton */}
          <div className="space-y-2 mb-6">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>

          {/* Sources button skeleton */}
          <Skeleton className="h-12 w-full rounded-xl mb-5" />

          {/* Action bar skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-32 rounded-2xl" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-10 w-28 rounded-2xl" />
            </div>
          </div>
        </div>

        {/* Pagination dots skeleton */}
        <div className="flex items-center justify-center gap-2 py-4">
          <Skeleton className="w-6 h-2 rounded-full" />
          <Skeleton className="w-2 h-2 rounded-full" />
          <Skeleton className="w-2 h-2 rounded-full" />
        </div>
      </div>
    </div>
  );
};
