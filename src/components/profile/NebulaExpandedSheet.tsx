import { ChevronDown } from "lucide-react";
import { CognitiveNebulaCanvas } from "./CognitiveNebulaCanvas";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CognitiveDensityData } from "@/hooks/useCognitiveDensity";
import { CATEGORY_COLORS } from "@/config/categories";

interface NebulaExpandedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accetta sia il nuovo formato strutturato sia il vecchio Record per back-compat */
  cognitiveDensity: CognitiveDensityData | Record<string, number>;
  /** Phase 4.5: macro selezionata per highlight */
  selectedMacro?: string | null;
  /** Phase 4.5: callback al tap su pianeta — il parent gestisce filter + scroll */
  onMacroClick?: (macro: string) => void;
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
}: NebulaExpandedSheetProps) => {
  const structured = isStructured(cognitiveDensity) ? cognitiveDensity : null;
  const sortedRows = structured
    ? [...structured.rows].filter((r) => r.density > 0).sort((a, b) => b.density - a.density)
    : [];

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
        </SheetHeader>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="h-[400px] flex items-center justify-center">
            <CognitiveNebulaCanvas
              data={cognitiveDensity}
              showCounts
              selectedMacro={selectedMacro}
              onMacroClick={handleMacroClick}
            />
          </div>

          {sortedRows.length > 0 && (
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
