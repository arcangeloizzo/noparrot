import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton per ImmersivePostCard — riflette la struttura reale
 * (.card-shell → .zone-header → .zone-badge → .zone-mid → .zone-bottom).
 * Fondo pieno #0E1522 (var(--base)), nessun gradiente legacy.
 */
export const PostCardSkeleton = () => {
  return (
    <div
      className="h-[100dvh] w-full snap-start relative flex flex-col overflow-hidden"
      style={{ background: "#0E1522" }}
    >
      <div
        className="flex flex-col flex-1"
        style={{ padding: "0 18px 20px", paddingTop: 0 }}
      >
        {/* zone-header */}
        <div
          className="flex items-center gap-[10px]"
          style={{ minHeight: 44, paddingTop: 56 }}
        >
          <Skeleton className="rounded-full" style={{ width: 36, height: 36 }} />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 rounded" style={{ width: "45%" }} />
            <Skeleton className="h-3 rounded" style={{ width: "30%" }} />
          </div>
        </div>

        {/* zone-badge */}
        <div
          className="flex items-center gap-2"
          style={{ minHeight: 26, marginTop: 13 }}
        >
          <Skeleton className="rounded-full" style={{ width: 84, height: 22 }} />
          <Skeleton className="rounded-full" style={{ width: 64, height: 22 }} />
        </div>

        {/* zone-mid */}
        <div
          className="flex flex-col"
          style={{ marginTop: 12, paddingRight: 30, flex: "0 0 auto" }}
        >
          <div className="space-y-3">
            <Skeleton className="h-8 rounded" style={{ width: "95%" }} />
            <Skeleton className="h-8 rounded" style={{ width: "88%" }} />
            <Skeleton className="h-8 rounded" style={{ width: "72%" }} />
          </div>
          <div className="space-y-2" style={{ marginTop: 18 }}>
            <Skeleton className="h-3.5 rounded" style={{ width: "80%" }} />
            <Skeleton className="h-3.5 rounded" style={{ width: "60%" }} />
          </div>
        </div>

        {/* filler */}
        <div className="flex-1" />

        {/* zone-bottom (action bar) */}
        <div
          className="flex items-center justify-between"
          style={{ marginTop: 16 }}
        >
          <Skeleton className="rounded-full" style={{ height: 40, width: 140 }} />
          <div className="flex items-center gap-3">
            <Skeleton className="rounded-full" style={{ width: 40, height: 40 }} />
            <Skeleton className="rounded-full" style={{ width: 40, height: 40 }} />
            <Skeleton className="rounded-full" style={{ width: 40, height: 40 }} />
          </div>
        </div>
      </div>
    </div>
  );
};
