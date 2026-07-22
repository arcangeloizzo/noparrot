import { useEffect, useMemo, useState } from "react";
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
import { useCognitiveDensity } from "@/hooks/useCognitiveDensity";
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
  const { user } = useAuth();
  const effectiveUserId = userId ?? user?.id ?? null;

  // Timeframe filter: 'all' | '30d' | '7d'
  type Timeframe = "all" | "30d" | "7d";
  const [timeframe, setTimeframe] = useState<Timeframe>("all");

  const { since, until, prevSince, prevUntil } = useMemo(() => {
    const now = new Date();
    if (timeframe === "all") {
      return { since: null, until: null, prevSince: null, prevUntil: null };
    }
    const days = timeframe === "7d" ? 7 : 30;
    const u = now;
    const s = new Date(now.getTime() - days * 24 * 3600 * 1000);
    const pu = s;
    const ps = new Date(s.getTime() - days * 24 * 3600 * 1000);
    return { since: s, until: u, prevSince: ps, prevUntil: pu };
  }, [timeframe]);

  // Live data for current timeframe (falls back to prop if all-time)
  const liveCurrent = useCognitiveDensity(effectiveUserId ?? undefined, {
    since,
    until,
  });
  const livePrev = useCognitiveDensity(effectiveUserId ?? undefined, {
    since: prevSince,
    until: prevUntil,
  });

  const activeData: CognitiveDensityData | Record<string, number> =
    timeframe === "all" ? cognitiveDensity : liveCurrent.data;

  const structured = isStructured(activeData) ? activeData : null;
  const sortedRows = structured
    ? [...structured.rows].filter((r) => r.density > 0).sort((a, b) => b.density - a.density)
    : [];

  const prevByMacro: Record<string, number> = livePrev.data.byMacroFlat ?? {};

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
        className="h-[85vh] px-4 pb-8 pt-3 overflow-y-auto border-0"
        hideClose
        style={{
          background: '#0E1522',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center mb-3 relative z-10">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Chiudi"
            className="p-1 -m-1"
          >
            <span
              aria-hidden
              style={{
                display: 'block',
                width: 40,
                height: 4,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.22)',
              }}
            />
          </button>
        </div>

        <SheetHeader className="mb-4 relative z-10 space-y-1 text-left">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle
              className="text-left"
              style={{
                fontFamily: 'var(--display)',
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.92)',
                lineHeight: 1.05,
              }}
            >
              Nebulosa Cognitiva
            </SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 -m-2 rounded-full hover:bg-white/10 transition-colors shrink-0"
              aria-label="Chiudi"
            >
              <ChevronDown className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.52)' }} />
            </button>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: 13,
              color: 'rgba(255,255,255,0.52)',
              lineHeight: 1.4,
            }}
          >
            La mappa dei tuoi percorsi di comprensione
          </p>
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: 13,
              color: 'rgba(255,255,255,0.32)',
              lineHeight: 1.4,
            }}
          >
            {zoomedMacro
              ? 'Tap fuori dal pianeta o su X per tornare indietro'
              : 'Tap su un pianeta per esplorare i sotto-temi'}
          </p>
        </SheetHeader>

        {/* Timeframe pills */}
        {!zoomedMacro && (
          <div className="relative z-10 flex items-center gap-2 mb-4">
            {([
              { id: "all", label: "TUTTO" },
              { id: "30d", label: "30 GIORNI" },
              { id: "7d", label: "7 GIORNI" },
            ] as { id: Timeframe; label: string }[]).map((p) => {
              const active = timeframe === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setTimeframe(p.id)}
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    padding: "6px 12px",
                    borderRadius: 999,
                    border: active
                      ? "1px solid rgba(255,255,255,0.28)"
                      : "1px solid rgba(255,255,255,0.10)",
                    background: active
                      ? "rgba(255,255,255,0.10)"
                      : "rgba(255,255,255,0.03)",
                    color: active
                      ? "rgba(255,255,255,0.92)"
                      : "rgba(255,255,255,0.52)",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

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
                    data={activeData}
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

          {!zoomedMacro && sortedRows.length === 0 && timeframe !== "all" && (
            <div
              style={{
                textAlign: "center",
                padding: "24px 16px",
                borderRadius: 18,
                border: "1px dashed rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <p
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.52)",
                  marginBottom: 6,
                }}
              >
                Nessuna attività
              </p>
              <p
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: 13,
                  color: "rgba(255,255,255,0.38)",
                }}
              >
                Non hai contribuito in questo periodo. Prova un intervallo più
                ampio.
              </p>
            </div>
          )}

          {!zoomedMacro && sortedRows.length > 0 && (
            <div className="space-y-2.5">
              {/* Eyebrow + hairline */}
              <div className="flex items-center gap-3">
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 10,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.52)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Dettaglio per area
                </span>
                <span
                  aria-hidden
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'rgba(255,255,255,0.08)',
                  }}
                />
              </div>

              {sortedRows.map((row) => {
                const color = CATEGORY_COLORS[row.macro_category] ?? '#888888';
                const prev = prevByMacro[row.macro_category] ?? 0;
                const delta = timeframe === "all" ? null : row.density - prev;
                return (
                  <div
                    key={row.macro_category}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleMacroClick(row.macro_category)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleMacroClick(row.macro_category);
                      }
                    }}
                    className="relative cursor-pointer transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.035)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 18,
                      padding: '12px 14px 12px 16px',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Costola di territorio */}
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        background: color,
                      }}
                    />
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: color,
                          }}
                        />
                        <span
                          style={{
                            fontFamily: 'var(--font-inter)',
                            fontSize: 15,
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.92)',
                          }}
                        >
                          {row.macro_category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {delta !== null && Math.abs(delta) >= 0.05 && (
                          <span
                            style={{
                              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                              fontSize: 10,
                              letterSpacing: '0.08em',
                              padding: '2px 6px',
                              borderRadius: 6,
                              background:
                                delta > 0
                                  ? 'rgba(20,184,166,0.14)'
                                  : 'rgba(255,255,255,0.06)',
                              color: delta > 0 ? '#5EEAD4' : 'rgba(255,255,255,0.5)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {delta > 0 ? '+' : ''}
                            {delta.toFixed(1)}
                          </span>
                        )}
                        <span
                          style={{
                            fontFamily: 'var(--font-inter)',
                            fontSize: 15,
                            fontWeight: 700,
                            color: 'rgba(255,255,255,0.92)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {row.density.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
                      {Object.entries(row.action_breakdown)
                        .sort(([, a], [, b]) => Number(b) - Number(a))
                        .map(([action, count]) => (
                          <div
                            key={action}
                            className="flex items-center justify-between gap-2"
                          >
                            <span
                              style={{
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontSize: 9.5,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: 'rgba(255,255,255,0.32)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ACTION_LABELS[action] ?? action}
                            </span>
                            <span
                              style={{
                                fontFamily: 'var(--font-inter)',
                                fontSize: 14,
                                fontWeight: 600,
                                color: 'rgba(255,255,255,0.92)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
