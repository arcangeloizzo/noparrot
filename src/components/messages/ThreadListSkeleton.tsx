import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton per la lista conversazioni.
 * Mostrato quando isLoading è true e non c'è ancora nessun dato in cache.
 */
export const ThreadListSkeleton = () => {
  const rows = Array.from({ length: 8 });
  // Larghezze variabili per dare naturalezza allo shimmer
  const nameWidths = ["70%", "55%", "62%", "48%", "68%", "58%", "72%", "50%"];
  const previewWidths = ["85%", "60%", "78%", "45%", "70%", "82%", "55%", "66%"];

  return (
    <div className="divide-y divide-border/50">
      {rows.map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="w-[50px] h-[50px] rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 rounded" style={{ width: nameWidths[i] }} />
            <Skeleton className="h-3 rounded" style={{ width: previewWidths[i] }} />
          </div>
          <Skeleton className="h-3 w-8 rounded flex-shrink-0" />
        </div>
      ))}
    </div>
  );
};

export default ThreadListSkeleton;