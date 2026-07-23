import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CardWelcome } from "./cards/CardWelcome";
import { CardGate } from "./cards/CardGate";
import { CardDiary } from "./cards/CardDiary";
import { CardTry } from "./cards/CardTry";

interface OnboardingFeedProps {
  onComplete: () => void;
  onSkip: () => void;
  onStartDemo: () => void;
}

const TOTAL = 4;

/**
 * "L'onboarding è il feed." 4 card immersive con snap verticale, stessa
 * grammatica shell (fondo #0E1522, Anton, mono, glass). Rail 4 segmenti a
 * destra, hint "SCORRI" con chevron animato, "SALTA →" sempre visibile.
 */
export const OnboardingFeed = ({
  onComplete: _onComplete,
  onSkip,
  onStartDemo,
}: OnboardingFeedProps) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const children = Array.from(scroller.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = children.indexOf(e.target as HTMLElement);
            if (idx >= 0) setActiveIndex(idx);
          }
        });
      },
      { root: scroller, threshold: [0.6, 0.9] }
    );
    children.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  const isLast = activeIndex >= TOTAL - 1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0E1522",
        color: "#FFFFFF",
        overflow: "hidden",
        zIndex: 100,
      }}
    >
      {/* SALTA */}
      <button
        onClick={onSkip}
        style={{
          position: "fixed",
          top: "max(env(safe-area-inset-top, 0px), 14px)",
          right: 20,
          zIndex: 3,
          background: "transparent",
          border: "none",
          color: "rgba(255,255,255,0.55)",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          padding: "8px 6px",
          cursor: "pointer",
        }}
      >
        Salta →
      </button>

      {/* Rail avanzamento */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 3,
        }}
      >
        {Array.from({ length: TOTAL }).map((_, i) => {
          const active = i === activeIndex;
          return (
            <span
              key={i}
              style={{
                display: "block",
                width: 3,
                height: 26,
                borderRadius: 2,
                background: active ? "#0A7AFF" : "rgba(255,255,255,0.14)",
                boxShadow: active ? "0 0 10px rgba(10,122,255,0.6)" : "none",
                transition: "background 200ms ease, box-shadow 200ms ease",
              }}
            />
          );
        })}
      </div>

      {/* Hint SCORRI */}
      {!isLast && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: "max(env(safe-area-inset-bottom, 0px), 18px)",
            display: "flex",
            justifyContent: "center",
            zIndex: 3,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              color: "rgba(255,255,255,0.55)",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              animation: "np-onb-bounce 1.6s ease-in-out infinite",
            }}
          >
            Scorri
            <ChevronDown size={14} strokeWidth={2} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes np-onb-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(4px); opacity: 1; }
        }
      `}</style>

      {/* Snap scroller */}
      <div
        ref={scrollerRef}
        style={{
          height: "100dvh",
          width: "100%",
          overflowY: "auto",
          overscrollBehavior: "contain",
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
        }}
        className="np-hide-scrollbar"
      >
        <CardWelcome />
        <CardGate />
        <CardDiary />
        <CardTry onStartDemo={onStartDemo} onSkip={onSkip} />
      </div>
    </div>
  );
};

export default OnboardingFeed;