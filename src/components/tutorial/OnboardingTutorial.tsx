import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingTutorial, STEPS } from "@/hooks/useOnboardingTutorial";
import { SwipeGesture } from "./SwipeGesture";

const TUTORIAL_CONTENT = {
  "il-punto": {
    title: "Il Punto",
    description: "Ogni giorno l'IA sintetizza il tema più discusso aggregando fonti diverse e verificate. Leggi, approfondisci e comprendi prima di commentare.",
    position: "bottom" // Relative to target
  },
  "feed": {
    title: "Feed Immersivo",
    description: "Esplora contenuti senza distrazioni. Un tocco per aprire, scorri verso l'alto per passare al prossimo. Nessuna pubblicità, solo contenuti di valore.",
    position: "bottom"
  },
  "composer": {
    title: "Crea e Condividi",
    description: "Condividi un link o esprimi un'opinione. Su NoParrot, la qualità della discussione conta più dei like.",
    position: "top"
  },
  "profile-nav": {
    title: "Il tuo Profilo",
    description: "Qui trovi i tuoi contenuti, e soprattutto la tua Nebulosa Cognitiva.",
    position: "top"
  },
  "nebulosa": {
    title: "Nebulosa Cognitiva",
    description: "Ogni volta che superi un Comprehension Gate, un nuovo nodo si accende. È la mappa visiva della tua curiosità e comprensione. Più esplori, più si espande.",
    position: "bottom"
  },
  "final": {
    title: "Sei pronto.",
    description: "Esplora, comprendi, partecipa. Benvenuto su NoParrot.",
    position: "center"
  }
};

export const OnboardingTutorial = () => {
  const { 
    activeStep, 
    targetRect, 
    nextStep, 
    dismissTutorial, 
    isTutorialActive,
    stepIndex,
    totalSteps
  } = useOnboardingTutorial();

  // Prevent scrolling when tutorial is active (unless on specific steps where we might need it, but generally lock it)
  useEffect(() => {
    if (isTutorialActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isTutorialActive]);

  // Specific step behaviors (e.g. scroll the feed to show dynamics)
  useEffect(() => {
    if (activeStep === "feed") {
      const feedEl = document.querySelector('[data-tutorial="feed"]') as HTMLElement | null;
      if (feedEl) {
        // Scroll down one full viewport height after a short delay to demonstrate the feed
        setTimeout(() => {
          feedEl.scrollTo({ top: feedEl.clientHeight, behavior: "smooth" });
        }, 800);
      }
    }
  }, [activeStep]);

  if (!isTutorialActive || !activeStep) return null;

  const content = TUTORIAL_CONTENT[activeStep];
  const isFinal = activeStep === "final";
  
  // Feed is a full-screen scroll concept and Il Punto uses the badge target, but both involve swiping
  const expectsSpotlight = !["feed"].includes(activeStep) && !isFinal;
  const effectiveTargetRect = expectsSpotlight ? targetRect : null;

  let spotlightStyle: React.CSSProperties = {
    // Hidden until target is found
    opacity: 0,
  };

  let tooltipStyle: React.CSSProperties = {
    top: "calc(50% - 110px)", // 110px is half the tooltip height
    left: 0,
    right: 0,
    margin: "0 auto",
    position: "absolute",
    zIndex: 100,
    width: "calc(100vw - 32px)",
    maxWidth: "320px",
    pointerEvents: "auto",
  };

  if (effectiveTargetRect) {
    const padding = 8;
    const top = effectiveTargetRect.top - padding;
    const left = effectiveTargetRect.left - padding;
    const bottom = effectiveTargetRect.bottom + padding;
    const width = effectiveTargetRect.width + padding * 2;
    const height = effectiveTargetRect.height + padding * 2;

    // The ultra-reliable box-shadow spotlight
    spotlightStyle = {
      position: "absolute",
      top: top,
      left: left,
      width: width,
      height: height,
      borderRadius: "12px",
      boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.85)",
      pointerEvents: "none", // Let clicks pass through this hole layer
      transition: "all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)",
    };

    // --- Simplified Positioning Logic ---
    const tooltipHeight = 220;
    const tooltipPadding = 16;
    
    // Vertical positioning
    let tooltipTop = 0;
    if (content.position === "bottom") {
      tooltipTop = bottom + tooltipPadding;
      if (tooltipTop + tooltipHeight > window.innerHeight) {
        tooltipTop = top - tooltipHeight - tooltipPadding;
      }
    } else if (content.position === "top") {
      tooltipTop = top - tooltipHeight - tooltipPadding;
      if (tooltipTop < 0) {
        tooltipTop = bottom + tooltipPadding;
      }
    }

    if (tooltipTop < tooltipPadding) tooltipTop = tooltipPadding;
    if (tooltipTop > window.innerHeight - tooltipHeight - tooltipPadding) tooltipTop = window.innerHeight - tooltipHeight - tooltipPadding;

    // Use absolute positioning with left/right 0 and margin auto to force centering
    // while adhering to a safe max-width. This ensures it NEVER horizontal overflows.
    tooltipStyle = {
      top: `${tooltipTop}px`,
      left: 0,
      right: 0,
      margin: "0 auto",
      position: "absolute",
      zIndex: 100,
      width: `calc(100vw - ${tooltipPadding * 2}px)`,
      maxWidth: "320px",
      pointerEvents: "auto",
    };
  }

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-auto">
      {/* Background click catcher */}
      <div 
        className="absolute inset-0 z-0" 
        onClick={() => dismissTutorial(true)} 
      />

      {/* Dynamic Backdrop with Spotlight cutout (Box-Shadow Trick) */}
      {effectiveTargetRect && (
        <div style={spotlightStyle} />
      )}
      
      {/* Fallback dark overlay if waiting for target or no target expected */}
      {!effectiveTargetRect && !isFinal && (
        <div className="absolute inset-0 bg-black/85 transition-opacity duration-300 pointer-events-none" />
      )}

      {isFinal && (
        <div 
          className="absolute inset-0 bg-[#0D1B2A]/90 backdrop-blur-md pointer-events-auto" 
          onClick={() => dismissTutorial(true)}
        />
      )}

      {/* Swipe Gesture Hints */}
      {activeStep === "il-punto" && (
        <SwipeGesture direction="left" text="Scorri per le notizie" />
      )}
      
      {activeStep === "feed" && (
        <SwipeGesture direction="up" text="Scorri per esplorare" />
      )}

      {/* Target Highlight Ring (Animates into place) */}
      {effectiveTargetRect && (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0 }}
          className="absolute rounded-xl border-2 border-[hsl(var(--cognitive-glow-blue))]/60 pointer-events-none z-10"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: "0 0 20px 4px rgba(10, 122, 255, 0.2)",
            transition: "all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          style={tooltipStyle}
        >
          {isFinal ? (
            // FINAL SCREEN
            <div className="bg-[#111] border border-white/10 rounded-2xl p-8 shadow-2xl flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-[#0A7AFF]/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8 text-[#0A7AFF]" />
              </div>
              <h3 className="text-2xl font-bold mb-3">{content.title}</h3>
              <p className="text-gray-400 mb-8">{content.description}</p>
              
              <Button 
                onClick={() => dismissTutorial(true)}
                className="w-full bg-[#0A7AFF] hover:bg-[#0A7AFF]/90 text-white rounded-xl h-12 font-medium"
              >
                Inizia ora
              </Button>
            </div>
          ) : (
            // STEP TOOLTIP
            <div className="bg-[#111] border border-white/10 rounded-2xl p-5 shadow-2xl">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white">{content.title}</h3>
                <button 
                  onClick={() => dismissTutorial(true)}
                  className="p-1 -mr-1 -mt-1 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-gray-400 leading-relaxed mb-6">
                {content.description}
              </p>
              
              <div className="flex items-center justify-between">
                {/* Dots indicator */}
                <div className="flex gap-1.5">
                  {STEPS.slice(0, totalSteps - 1).map((s, idx) => (
                    <div 
                      key={s} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === stepIndex 
                          ? "w-4 bg-[#0A7AFF]" 
                          : idx < stepIndex
                            ? "w-1.5 bg-white/40"
                            : "w-1.5 bg-white/10"
                      }`} 
                    />
                  ))}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => dismissTutorial(true)}
                    className="text-xs text-gray-500 hover:text-white px-2 py-1"
                  >
                    Salta tutto
                  </button>
                  <Button 
                    onClick={nextStep}
                    size="sm"
                    className="bg-white text-black hover:bg-gray-200 rounded-lg text-sm px-4"
                  >
                    Avanti <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
