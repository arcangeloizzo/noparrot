import { Sparkles, X } from "lucide-react";
import { CATEGORY_COLORS } from "@/config/categories";
import type { TopicData } from "@/hooks/useUserTopicsByMacro";

interface ZoomedPlanetViewProps {
  macro: string;
  density?: number;
  topics: TopicData[];
  isLoading?: boolean;
  onClose: () => void;
  onFilterDiary: () => void;
}

/**
 * Phase 4.6b — vista zoom-in di un singolo pianeta della Nebulosa.
 * Mostra il pianeta protagonista al centro con i sub-dot dei topic-tag
 * disposti in cerchi concentrici (3 tier: hero / inner ring / outer ring).
 * I sub-dot sono STATICI (non clickable) — il filtro per topic_id arriverà in 4.6c.
 */

const PLANET_SIZE = 280;
const PLANET_RADIUS = PLANET_SIZE / 2;
const MAX_VISIBLE_LABELS = 5;

interface Tier {
  startIdx: number;
  endIdx: number;
  radiusRatio: number; // distanza dal centro come frazione del raggio del pianeta
  dotSize: number;
  opacity: number;
}

const TIERS: Tier[] = [
  { startIdx: 0, endIdx: 1, radiusRatio: 0, dotSize: 24, opacity: 1.0 },
  { startIdx: 1, endIdx: 7, radiusRatio: 0.45, dotSize: 16, opacity: 0.85 },
  // Tier 2 (idx >= 7): distribuito su 2 sub-anelli concentrici (vedi layoutDots)
  { startIdx: 7, endIdx: Infinity, radiusRatio: 0.85, dotSize: 8, opacity: 0.55 },
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

interface PositionedDot {
  topic: TopicData;
  x: number;
  y: number;
  size: number;
  opacity: number;
  showLabel: boolean;
  tierIdx: number;
  angle: number;
  /** Distanza del dot dal centro del pianeta (px). Usata per la label radiale. */
  dotRadius: number;
}

function layoutDots(topics: TopicData[]): PositionedDot[] {
  if (topics.length === 0) return [];

  // Pre-raggruppa indice → tier
  const dotsByTier: Record<number, TopicData[]> = { 0: [], 1: [], 2: [] };
  topics.forEach((topic, idx) => {
    const tierIdx = TIERS.findIndex((t) => idx >= t.startIdx && idx < t.endIdx);
    if (tierIdx >= 0) dotsByTier[tierIdx].push(topic);
  });

  const positioned: PositionedDot[] = [];

  Object.entries(dotsByTier).forEach(([tierIdxStr, tierTopics]) => {
    const tierIdx = Number(tierIdxStr);
    const tier = TIERS[tierIdx];
    if (!tier || tierTopics.length === 0) return;

    if (tierIdx === 0) {
      // Hero dot al centro
      tierTopics.forEach((topic) => {
        positioned.push({
          topic,
          x: 0,
          y: 0,
          size: tier.dotSize,
          opacity: tier.opacity,
          showLabel: true,
          tierIdx,
          angle: 0,
          dotRadius: 0,
        });
      });
    } else if (tierIdx === 1) {
      const radius = tier.radiusRatio * PLANET_RADIUS;
      const count = tierTopics.length;
      tierTopics.forEach((topic, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const globalIdx = topics.indexOf(topic);
        positioned.push({
          topic,
          x,
          y,
          size: tier.dotSize,
          opacity: tier.opacity,
          showLabel: globalIdx < MAX_VISIBLE_LABELS,
          tierIdx,
          angle,
          dotRadius: radius,
        });
      });
    } else {
      // Tier 2: distribuisci i puntini su 2 sub-anelli concentrici
      // (sub-anello A: 0.78R, sub-anello B: 0.92R, sfasati di 15°).
      const subRingARadius = 0.78 * PLANET_RADIUS;
      const subRingBRadius = 0.92 * PLANET_RADIUS;
      const halfA = Math.ceil(tierTopics.length / 2);
      const ringATopics = tierTopics.slice(0, halfA);
      const ringBTopics = tierTopics.slice(halfA);
      const offsetB = (15 * Math.PI) / 180;

      const placeRing = (
        ringTopics: TopicData[],
        ringRadius: number,
        angleOffset: number
      ) => {
        const count = ringTopics.length;
        ringTopics.forEach((topic, i) => {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + angleOffset;
          const x = Math.cos(angle) * ringRadius;
          const y = Math.sin(angle) * ringRadius;
          const globalIdx = topics.indexOf(topic);
          positioned.push({
            topic,
            x,
            y,
            size: tier.dotSize,
            opacity: tier.opacity,
            // I top 5 sono sempre nei tier 0-1, quindi nel tier 2 nessuna label leggibile.
            showLabel: globalIdx < MAX_VISIBLE_LABELS,
            tierIdx,
            angle,
            dotRadius: ringRadius,
          });
        });
      };

      placeRing(ringATopics, subRingARadius, 0);
      placeRing(ringBTopics, subRingBRadius, offsetB);
    }
  });

  return positioned;
}

/**
 * Calcola posizione assoluta della label rispetto al centro del pianeta.
 * - Hero dot (centrale): label sotto al dot.
 * - Tier 1 (ring intermedio): label radiale, sulla stessa angolazione ma più lontano.
 */
function computeLabelPosition(dot: PositionedDot): {
  left: number;
  top: number;
  align: "center" | "left" | "right";
} {
  // Hero centrale → label sotto, centrata.
  if (dot.tierIdx === 0) {
    return {
      left: PLANET_RADIUS,
      top: PLANET_RADIUS + dot.size / 2 + 12,
      align: "center",
    };
  }
  // Tier 1 → label radiale: stesso angolo del dot, distanza maggiore.
  const labelRadius = dot.dotRadius + dot.size / 2 + 14;
  const lx = PLANET_RADIUS + Math.cos(dot.angle) * labelRadius;
  const ly = PLANET_RADIUS + Math.sin(dot.angle) * labelRadius;
  // Allineamento orizzontale in base al quadrante (cos > 0 → label parte da sinistra).
  const align: "left" | "right" | "center" =
    Math.abs(Math.cos(dot.angle)) < 0.2
      ? "center"
      : Math.cos(dot.angle) > 0
        ? "left"
        : "right";
  return { left: lx, top: ly, align };
}

export const ZoomedPlanetView = ({
  macro,
  density,
  topics,
  isLoading,
  onClose,
  onFilterDiary,
}: ZoomedPlanetViewProps) => {
  const colorHex = CATEGORY_COLORS[macro] ?? "#888888";
  const rgb = hexToRgb(colorHex);
  const positioned = layoutDots(topics);

  // Click sullo sfondo (fuori dal pianeta) → onClose
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-planet="true"]') === null &&
        (e.target as HTMLElement).closest('[data-cta="true"]') === null) {
      onClose();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="relative w-full flex flex-col items-center"
    >
      {/* Header */}
      <div className="w-full flex items-start justify-between mb-4 px-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: colorHex, boxShadow: `0 0 12px ${colorHex}` }}
            />
            <h3 className="text-xl font-bold text-foreground">{macro}</h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-5 tabular-nums">
            {typeof density === "number" ? `${density.toFixed(1)} densità` : ""}
            {typeof density === "number" && topics.length > 0 ? " · " : ""}
            {topics.length > 0 ? `${topics.length} topic` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Chiudi vista zoom"
        >
          <X className="w-4 h-4 text-foreground" />
        </button>
      </div>

      {/* Planet area */}
      <div
        className="relative my-4 shrink-0"
        style={{
          width: PLANET_SIZE,
          height: PLANET_SIZE,
          aspectRatio: "1 / 1",
        }}
      >
        {/* Pianeta protagonista — cerchio perfetto con radial gradient circolare */}
        <div
          data-planet="true"
          className="absolute inset-0"
          style={{
            width: PLANET_SIZE,
            height: PLANET_SIZE,
            aspectRatio: "1 / 1",
            borderRadius: "50%",
            background: `radial-gradient(circle at center, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18) 55%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0) 100%)`,
            border: `2px solid rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`,
            boxShadow: `0 0 40px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`,
          }}
        />

        {/* Empty state */}
        {!isLoading && topics.length === 0 && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-8"
            data-planet="true"
          >
            <Sparkles
              className="w-8 h-8 mb-3 opacity-60"
              style={{ color: colorHex }}
            />
            <p className="text-sm text-foreground/80 leading-snug">
              Esplora contenuti per scoprire i tuoi sotto-temi in questa categoria.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center text-center"
            data-planet="true"
          >
            <p className="text-xs text-muted-foreground">Caricamento topic…</p>
          </div>
        )}

        {/* Sub-dot statici (puntini senza label) */}
        {!isLoading &&
          positioned.map((dot) => {
            const left = PLANET_RADIUS + dot.x - dot.size / 2;
            const top = PLANET_RADIUS + dot.y - dot.size / 2;
            return (
              <div
                key={`dot-${dot.topic.topic_id}`}
                data-planet="true"
                className="absolute pointer-events-none"
                style={{
                  left,
                  top,
                  width: dot.size,
                  height: dot.size,
                }}
              >
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    backgroundColor: colorHex,
                    opacity: dot.opacity,
                    boxShadow: `0 0 ${dot.size * 0.6}px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`,
                  }}
                />
              </div>
            );
          })}

        {/* Label dei top 5 — render separato sopra ai dot per evitare overlap */}
        {!isLoading &&
          positioned
            .filter((d) => d.showLabel)
            .map((dot) => {
              const labelPos = computeLabelPosition(dot);
              const transform =
                labelPos.align === "center"
                  ? "translate(-50%, 0)"
                  : labelPos.align === "left"
                    ? "translate(0, -50%)"
                    : "translate(-100%, -50%)";
              return (
                <div
                  key={`label-${dot.topic.topic_id}`}
                  data-planet="true"
                  className="absolute pointer-events-none whitespace-nowrap z-20"
                  style={{
                    left: labelPos.left,
                    top: labelPos.top,
                    transform,
                  }}
                >
                  <span
                    className="text-[10px] font-medium text-foreground/90 bg-black/55 backdrop-blur-sm px-1.5 py-0.5 rounded"
                    style={{
                      textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    }}
                  >
                    {dot.topic.topic_label}
                    <sub className="ml-0.5 text-foreground/60 tabular-nums">
                      {dot.topic.frequency}
                    </sub>
                  </span>
                </div>
              );
            })}
      </div>

      {/* CTA */}
      <button
        data-cta="true"
        type="button"
        onClick={onFilterDiary}
        className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-transform hover:scale-105"
        style={{
          backgroundColor: colorHex,
          color: "#0A0F14",
          boxShadow: `0 4px 24px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`,
        }}
      >
        Filtra il Diario per {macro}
      </button>
    </div>
  );
};