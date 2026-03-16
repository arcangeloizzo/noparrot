import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingTutorial, STEPS } from "@/hooks/useOnboardingTutorial";

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

  if (!isTutorialActive || !activeStep) return null;

  const content = TUTORIAL_CONTENT[activeStep];
  const isFinal = activeStep === "final";

  // Calculate spotlight style
  let spotlightStyle: React.CSSProperties = {
    clipPath: "none",
  };

  let tooltipStyle: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };

  if (!isFinal && targetRect) {
    const padding = 8;
    const top = targetRect.top - padding;
    const left = targetRect.left - padding;
    const right = targetRect.right + padding;
    const bottom = targetRect.bottom + padding;

    // Create a hole in the overlay using clip-path polygon
    spotlightStyle = {
      clipPath: `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
        ${left}px ${top}px, ${left}px ${bottom}px, ${right}px ${bottom}px, ${right}px ${top}px, ${left}px ${top}px
      )`,
    };

    // Calculate tooltip position based on content preference and screen bounds
    const tooltipWidth = 320; // max-w-sm roughly
    const tooltipHeight = 200; // estimated
    let tooltipTop = 0;
    
    if (content.position === "bottom") {
      tooltipTop = bottom + 16;
      // If goes off screen bottom, put it above
      if (tooltipTop + tooltipHeight > window.innerHeight) {
        tooltipTop = top - tooltipHeight - 16;
      }
    } else if (content.position === "top") {
      tooltipTop = top - tooltipHeight - 32;
      // If goes off screen top, put it below
      if (tooltipTop < 0) {
        tooltipTop = bottom + 16;
      }
    }

    tooltipStyle = {
      top: `${tooltipTop}px`,
      left: "50%",
      transform: "translateX(-50%)",
      position: "absolute",
    };
  }

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-auto">
      {/* Dynamic Backdrop with Spotlight cutout */}
      {!isFinal ? (
        <div 
          className="absolute inset-0 bg-black/80 backdrop-blur-[2px] transition-all duration-300 pointer-events-auto"
          style={spotlightStyle}
          onClick={(e) => {
            // Optional: Dismiss on overlay click or just prevent clicks from passing
            e.stopPropagation();
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#0D1B2A]/90 backdrop-blur-md pointer-events-auto" />
      )}

      {/* Target Highlight Ring (Animates into place) */}
      {!isFinal && targetRect && (
        <motion.div
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute rounded-xl border-2 border-[hsl(var(--cognitive-glow-blue))]/60 pointer-events-none"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: "0 0 20px 4px rgba(10, 122, 255, 0.2)",
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
          className={`absolute w-full max-w-sm px-4 ${isFinal ? '' : ''}`}
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
