import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for ImmersivePostCard - matches the exact layout to prevent layout shift.
 * Uses min-height matching the actual card for stable snap scrolling.
 */
export const PostCardSkeleton = () => {
  return (
    <div className="h-[100dvh] w-full snap-start relative flex flex-col overflow-hidden bg-gradient-to-b from-[#1F3347] via-[#172635] to-[#0E1A24]">
      {/* Header skeleton */}
      <div className="absolute top-16 left-4 right-4 z-10 flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col justify-center px-6 pt-32 pb-40">
        {/* Text content skeleton */}
        <div className="space-y-3 mb-6">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-4/5" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        
        {/* Image placeholder skeleton */}
        <div className="aspect-video w-full rounded-2xl overflow-hidden">
          <Skeleton className="w-full h-full" />
        </div>
      </div>

      {/* Action bar skeleton */}
      <div className="absolute bottom-24 left-4 right-4 flex items-center justify-between">
        <Skeleton className="h-10 w-32 rounded-2xl" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      </div>
    </div>
  );
};
