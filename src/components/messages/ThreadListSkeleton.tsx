import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton per la lista conversazioni — mostra 8 righe che rispecchiano
 * la struttura `.row` (avatar 50px + due barre di testo + timestamp compatto).
 */
export const ThreadListSkeleton = () => {
  const rows = Array.from({ length: 8 });
  const nameWidths = ["70%", "55%", "62%", "48%", "68%", "58%", "72%", "50%"];
  const previewWidths = ["85%", "60%", "78%", "45%", "70%", "82%", "55%", "66%"];

  return (
    <div className="flex flex-col" style={{ paddingTop: 4 }}>
      {rows.map((_, i) => (
        <div key={i} className="row" style={{ pointerEvents: "none" }}>
          <Skeleton
            className="rounded-full flex-shrink-0"
            style={{ width: 50, height: 50 }}
          />
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
            <Skeleton className="h-4 rounded" style={{ width: nameWidths[i] }} />
            <Skeleton className="h-3 rounded" style={{ width: previewWidths[i] }} />
          </div>
          <Skeleton
            className="h-3 rounded flex-shrink-0"
            style={{ width: 28 }}
          />
        </div>
      ))}
    </div>
  );
};

export default ThreadListSkeleton;