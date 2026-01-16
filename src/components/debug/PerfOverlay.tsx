import { usePerfStore } from "@/lib/perfStore";

/**
 * Performance monitoring overlay for DEV mode.
 * Shows render counts, last action, and delta renders.
 * Hidden when perfStore is disabled.
 */
export const PerfOverlay = () => {
  const { enabled, counts, lastAction, delta } = usePerfStore();

  if (!enabled) return null;

  return (
    <div 
      className="fixed top-16 left-2 z-[9999] bg-black/90 border border-white/20 rounded-lg p-3 text-xs font-mono text-white shadow-xl pointer-events-none select-none"
      style={{ maxWidth: '180px' }}
    >
      <div className="text-[10px] text-primary font-bold mb-2 uppercase tracking-wider">
        ⚡ Perf Monitor
      </div>
      
      {/* Current render counts */}
      <div className="space-y-1 mb-2">
        <div className="flex justify-between">
          <span className="text-white/60">PostCard:</span>
          <span className="text-green-400 font-bold">{counts.postCard}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Editorial:</span>
          <span className="text-blue-400 font-bold">{counts.editorialSlide}</span>
        </div>
      </div>
      
      {/* Last action */}
      <div className="border-t border-white/10 pt-2 mb-2">
        <div className="flex justify-between">
          <span className="text-white/60">Action:</span>
          <span className={`font-bold ${
            lastAction === 'scroll' ? 'text-yellow-400' : 
            lastAction === 'like' ? 'text-red-400' : 
            'text-white/40'
          }`}>
            {lastAction.toUpperCase()}
          </span>
        </div>
      </div>
      
      {/* Delta renders after action */}
      {delta && (
        <div className="border-t border-white/10 pt-2">
          <div className="text-[9px] text-white/40 mb-1">DELTA AFTER {lastAction.toUpperCase()}</div>
          <div className="flex justify-between">
            <span className="text-white/60">PostCard:</span>
            <span className={`font-bold ${delta.postCard > 5 ? 'text-red-400' : delta.postCard > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
              +{delta.postCard}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Editorial:</span>
            <span className={`font-bold ${delta.editorialSlide > 3 ? 'text-red-400' : delta.editorialSlide > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
              +{delta.editorialSlide}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
