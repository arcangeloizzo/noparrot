import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CognitiveNebulaCanvas } from "./CognitiveNebulaCanvas";
import { ZoomedPlanetView } from "./ZoomedPlanetView";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CognitiveDensityData } from "@/hooks/useCognitiveDensity";
import { CATEGORY_COLORS } from "@/config/categories";
import { useUserTopicsByMacro } from "@/hooks/useUserTopicsByMacro";
import type { TopicData } from "@/hooks/useUserTopicsByMacro";
import { useAuth } from "@/contexts/AuthContext";

interface NebulaExpandedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accetta sia il nuovo formato strutturato sia il vecchio Record per back-compat */
  cognitiveDensity: CognitiveDensityData | Record<string, number>;
  /** Phase 4.5: macro selezionata per highlight */
  selectedMacro?: string | null;
  /** Phase 4.5: callback al tap su pianeta — il parent gestisce filter + scroll */
  onMacroClick?: (macro: string) => void;
  /** Phase 4.6c: callback al tap su un sub-dot → filtro per topic_id specifico */
  onTopicSelect?: (topic: { id: string; label: string; macro: string }) => void;
  /** Phase 4.6b: id dell'utente di cui mostrare i topic (default = utente loggato) */
  userId?: string;
}

const ACTION_LABELS: Record<string, string> = {
  post_original: "Post originali",
  voice_post: "Voice post",
  challenge_started: "Challenge avviate",
  reshare_with_comment: "Reshare con commento",
  reshare_simple: "Reshare semplici",
  gate_passed_only: "Gate superati",
  comment_with_gate: "Commenti consapevoli",
  challenge_response: "Risposte a Challenge",
  challenge_vote: "Voti Challenge",
  reaction_unique: "Reazioni",
  bookmark: "Bookmark",
};

function isStructured(
  d: CognitiveDensityData | Record<string, number> | undefined | null
): d is CognitiveDensityData {
  return !!d && typeof d === "object" && "byMacroFlat" in (d as object);
}

export const NebulaExpandedSheet = ({
  open,
  onOpenChange,
  cognitiveDensity,
  selectedMacro,
  onMacroClick,
  onTopicSelect,
  userId,
}: NebulaExpandedSheetProps) => {
  const structured = isStructured(cognitiveDensity) ? cognitiveDensity : null;
  const sortedRows = structured
    ? [...structured.rows].filter((r) => r.density > 0).sort((a, b) => b.density - a.density)
    : [];

  const { user } = useAuth();
  const effectiveUserId = userId ?? user?.id ?? null;

  // Phase 4.6b — state zoom-in
  const [zoomedMacro, setZoomedMacro] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setZoomedMacro(null);
  }, [open]);

  const { data: zoomedTopics = [], isLoading: topicsLoading } = useUserTopicsByMacro(
    effectiveUserId,
    zoomedMacro
  );

  const zoomedDensity = zoomedMacro
    ? sortedRows.find((r) => r.macro_category === zoomedMacro)?.density
    : undefined;

  // Tap su un pianeta in overview → zoom-in/out (toggle).
  // Il filtro Diario diventa azione SECONDARIA (CTA dentro la vista zoomata).
  const handlePlanetTap = (macro: string) => {
    setZoomedMacro((curr) => (curr === macro ? null : macro));
  };

  // Filtro Diario chiamato dalla CTA dentro la vista zoomata o dalle row "Dettaglio per area".
  const handleMacroClick = (macro: string) => {
    onMacroClick?.(macro);
    onOpenChange(false);
    // Auto-scroll al Diario dopo che lo Sheet si è chiuso (animazione ~300ms)
    setTimeout(() => {
      const diario = document.querySelector('[data-section="diario"]');
      if (diario) {
        diario.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 320);
  };

  // Phase 4.6c — tap su sub-dot nello ZoomedPlanetView.
  // Imposta entrambi i filtri (macro + topic), chiude lo Sheet e scrolla al Diario.
  const handleTopicClick = (topic: TopicData) => {
    if (!zoomedMacro) return;
    onMacroClick?.(zoomedMacro);
    onTopicSelect?.({
      id: topic.topic_id,
      label: topic.topic_label,
      macro: zoomedMacro,
    });
    onOpenChange(false);
    setTimeout(() => {
      const diario = document.querySelector('[data-section="diario"]');
      if (diario) {
        diario.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 320);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="bg-[#0A0F14] border-t border-white/10 rounded-t-3xl h-[85vh] px-4 pb-8 pt-4 overflow-y-auto"
        hideClose
      >
        {/* Urban texture background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.06] rounded-t-3xl"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: '150px 150px',
          }}
        />

        <SheetHeader className="mb-4 relative z-10">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground text-lg font-semibold">Nebulosa Cognitiva</SheetTitle>
            <button 
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground text-left">
            La mappa dei tuoi percorsi di comprensione
          </p>
          <p className="text-xs text-muted-foreground/70 text-left mt-1">
            {zoomedMacro
              ? "Tap fuori dal pianeta o su X per tornare indietro"
              : "Tap su un pianeta per esplorare i sotto-temi"}
          </p>
        </SheetHeader>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="min-h-[400px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {!zoomedMacro ? (
                <motion.div
                  key="overview"
                  className="w-full h-[400px] flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.4 }}
                >
                  <CognitiveNebulaCanvas
                    data={cognitiveDensity}
                    showCounts
                    selectedMacro={selectedMacro}
                    onMacroClick={handlePlanetTap}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={`zoomed-${zoomedMacro}`}
                  className="w-full"
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.3 }}
                  transition={{ duration: 0.4 }}
                >
                  <ZoomedPlanetView
                    macro={zoomedMacro}
                    density={zoomedDensity}
                    topics={zoomedTopics}
                    isLoading={topicsLoading}
                    onClose={() => setZoomedMacro(null)}
                    onFilterDiary={() => handleMacroClick(zoomedMacro)}
                    onTopicClick={handleTopicClick}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {!zoomedMacro && sortedRows.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider">
                Dettaglio per area
              </h4>
              {sortedRows.map((row) => (
                <div
                  key={row.macro_category}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 cursor-pointer hover:bg-white/[0.06] transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMacroClick(row.macro_category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleMacroClick(row.macro_category);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[row.macro_category] }}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {row.macro_category}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {row.density.toFixed(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {Object.entries(row.action_breakdown)
                      .sort(([, a], [, b]) => Number(b) - Number(a))
                      .map(([action, count]) => (
                        <div
                          key={action}
                          className="flex items-center justify-between text-xs text-muted-foreground"
                        >
                          <span className="truncate">
                            {ACTION_LABELS[action] ?? action}
                          </span>
                          <span className="tabular-nums text-foreground/70 ml-2">
                            {count}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
