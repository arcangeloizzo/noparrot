import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for SourcesDrawer list items.
 * Displays while sources are loading.
 */
export const SourcesDrawerSkeleton = () => {
  return (
    <div className="space-y-3 px-6 py-4">
      {Array.from({ length: 4 }).map((_, idx) => (
        <div 
          key={idx}
          className="p-4 rounded-2xl bg-white/[0.03] border border-white/5"
        >
          <div className="flex items-center gap-4">
            <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="w-4 h-4 flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
};
