import { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';

export type CompressionStep = 'full' | 'clamped' | 'pill' | 'hidden';

export interface EssentialElementState {
  id: string;
  height: number;
}

export interface EssentialElementConfig {
  id: string;
  staticHeight?: number;
  states?: EssentialElementState[];
}

export interface FlexibleElementConfig {
  id: string;
  compressionSteps: CompressionStep[];
  minReadabilityHeight: number;
  fallbackHeight: number;
}

export interface UseDynamicCardLayoutProps {
  availableHeight: number;
  essentials: EssentialElementConfig[];
  flexibles: FlexibleElementConfig[];
  compressionPriority: string[];
}

export interface FlexibleElementStatus {
  id: string;
  step: CompressionStep;
  height: number;
}

export interface CardLayoutResult {
  status: 'pending' | 'measured';
  essentialStates: Record<string, string>;
  flexiblesStatus: Record<string, FlexibleElementStatus>;
  showDrawerCta: boolean;
  emergencyScroll: boolean;
  registerRef: (id: string) => (node: HTMLElement | null) => void;
}

const PILL_HEIGHT = 36; // Altezza fissa di sistema per le pillole

export function useDynamicCardLayout({
  availableHeight,
  essentials,
  flexibles,
  compressionPriority
}: UseDynamicCardLayoutProps): CardLayoutResult {
  const [status, setStatus] = useState<'pending' | 'measured'>('pending');

  const elementRefs = useRef<Record<string, HTMLElement | null>>({});
  const naturalHeightsRef = useRef<Record<string, number>>({});
  const prevHeightsRef = useRef<Record<string, number>>({});
  const observerRef = useRef<ResizeObserver | null>(null);

  // Callback per registrare i ref del DOM
  const registerRef = useCallback((id: string) => (node: HTMLElement | null) => {
    elementRefs.current[id] = node;
  }, []);

  const [layoutResult, setLayoutResult] = useState<{
    essentialStates: Record<string, string>;
    flexiblesStatus: Record<string, FlexibleElementStatus>;
    showDrawerCta: boolean;
    emergencyScroll: boolean;
  }>(() => {
    // Configurazione iniziale di fallback per il primo frame ('pending')
    const initialFlexStatus: Record<string, FlexibleElementStatus> = {};
    for (const flex of flexibles) {
      initialFlexStatus[flex.id] = {
        id: flex.id,
        step: flex.compressionSteps[0] || 'full',
        height: flex.fallbackHeight
      };
    }
    const initialEssentialStates: Record<string, string> = {};
    for (const ess of essentials) {
      if (ess.states && ess.states.length > 0) {
        initialEssentialStates[ess.id] = ess.states[0].id;
      }
    }
    return {
      essentialStates: initialEssentialStates,
      flexiblesStatus: initialFlexStatus,
      showDrawerCta: false,
      emergencyScroll: false
    };
  });

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const computeLayout = () => {
      const currentAvailableHeight = availableHeight;
      if (currentAvailableHeight <= 0) return;

      // 1. Raccoglie le altezze degli elementi essenziali
      const essentialHeights: Record<string, number> = {};
      const currentEssentialStates: Record<string, string> = {};

      for (const ess of essentials) {
        if (ess.staticHeight !== undefined) {
          essentialHeights[ess.id] = ess.staticHeight;
        } else if (ess.states && ess.states.length > 0) {
          // Si parte dallo stato più ricco (indice 0)
          const chosenState = ess.states[0];
          essentialHeights[ess.id] = chosenState.height;
          currentEssentialStates[ess.id] = chosenState.id;
        } else {
          // Misurazione runtime reale
          const node = elementRefs.current[ess.id];
          essentialHeights[ess.id] = node ? node.getBoundingClientRect().height : 0;
        }
      }

      // 2. Raccoglie le altezze naturali degli elementi flessibili
      const flexibleNaturalHeights: Record<string, number> = {};
      const currentFlexStatus: Record<string, FlexibleElementStatus> = {};

      for (const flex of flexibles) {
        let naturalHeight = flex.fallbackHeight;
        const node = elementRefs.current[flex.id];
        if (node) {
          const currentStep = layoutResult.flexiblesStatus[flex.id]?.step || 'full';
          if (currentStep === 'full') {
            naturalHeight = node.getBoundingClientRect().height || node.scrollHeight || flex.fallbackHeight;
            naturalHeightsRef.current[flex.id] = naturalHeight;
          } else {
            const sh = node.scrollHeight;
            if (sh > 0 && currentStep === 'clamped') {
              naturalHeight = sh;
            } else {
              naturalHeight = naturalHeightsRef.current[flex.id] || sh || flex.fallbackHeight;
            }
          }
        }
        flexibleNaturalHeights[flex.id] = naturalHeight;

        // Inizializza ciascun flessibile a 'full'
        currentFlexStatus[flex.id] = {
          id: flex.id,
          step: 'full',
          height: naturalHeight
        };
      }

      // Calcola l'altezza totale complessiva della card
      const calculateTotalHeight = (
        essHeights: Record<string, number>,
        flexStatuses: Record<string, FlexibleElementStatus>
      ) => {
        let total = 0;
        for (const id in essHeights) {
          total += essHeights[id];
        }
        for (const id in flexStatuses) {
          total += flexStatuses[id].height;
        }
        return total;
      };

      let H_tot = calculateTotalHeight(essentialHeights, currentFlexStatus);

      // FASE A: Declassamento degli elementi essenziali a stati multipli
      if (H_tot > currentAvailableHeight) {
        for (const ess of essentials) {
          if (ess.states && ess.states.length > 1) {
            for (let i = 1; i < ess.states.length; i++) {
              const nextState = ess.states[i];
              essentialHeights[ess.id] = nextState.height;
              currentEssentialStates[ess.id] = nextState.id;

              H_tot = calculateTotalHeight(essentialHeights, currentFlexStatus);
              if (H_tot <= currentAvailableHeight) {
                break;
              }
            }
          }
          if (H_tot <= currentAvailableHeight) {
            break;
          }
        }
      }

      // FASE B: Compressione Round-Robin Prioritizzata Step-by-Step
      if (H_tot > currentAvailableHeight) {
        let trovatoQualcosaDaComprimere = true;
        while (H_tot > currentAvailableHeight && trovatoQualcosaDaComprimere) {
          trovatoQualcosaDaComprimere = false;

          for (const elementId of compressionPriority) {
            const flexible = flexibles.find(f => f.id === elementId);
            if (!flexible) continue;

            const currentStatus = currentFlexStatus[elementId];
            const currentIndex = flexible.compressionSteps.indexOf(currentStatus.step);

            if (currentIndex !== -1 && currentIndex < flexible.compressionSteps.length - 1) {
              let nextStep = flexible.compressionSteps[currentIndex + 1];

              // Edge Case: naturalHeight <= minReadabilityHeight.
              // Se l'altezza naturale del flessibile è già inferiore o uguale alla soglia
              // minima di leggibilità, il clamp non ha senso. Salta direttamente allo step successivo.
              const naturalHeight = flexibleNaturalHeights[elementId];
              if (nextStep === 'clamped' && naturalHeight <= flexible.minReadabilityHeight) {
                const clampIndex = flexible.compressionSteps.indexOf('clamped');
                if (clampIndex !== -1 && clampIndex < flexible.compressionSteps.length - 1) {
                  nextStep = flexible.compressionSteps[clampIndex + 1];
                } else {
                  continue;
                }
              }

              let calculatedHeight = 0;
              if (nextStep === 'pill') {
                calculatedHeight = PILL_HEIGHT;
              } else if (nextStep === 'hidden') {
                calculatedHeight = 0;
              } else if (nextStep === 'clamped') {
                calculatedHeight = flexible.minReadabilityHeight;
              } else {
                calculatedHeight = naturalHeight;
              }

              currentStatus.step = nextStep;
              currentStatus.height = calculatedHeight;
              trovatoQualcosaDaComprimere = true;

              H_tot = calculateTotalHeight(essentialHeights, currentFlexStatus);
              if (H_tot <= currentAvailableHeight) {
                // NOTA: Questo break esce dal ciclo for interno dei flessibili.
                // La condizione del while esterno (H_tot > availableHeight) risulterà falsa,
                // completando l'algoritmo col minor sacrificio possibile ("minimum compression to fit").
                break;
              }
            }
          }
        }
      }

      // FASE C: Emergency Scroll
      const emergencyScroll = H_tot > currentAvailableHeight;

      // Determina se mostrare la CTA "Approfondisci"
      let showDrawerCta = false;
      for (const flexId in currentFlexStatus) {
        if (currentFlexStatus[flexId].step !== 'full') {
          showDrawerCta = true;
          break;
        }
      }

      setLayoutResult({
        essentialStates: currentEssentialStates,
        flexiblesStatus: currentFlexStatus,
        showDrawerCta,
        emergencyScroll
      });
    };

    const handleResize = () => {
      computeLayout();
      setStatus('measured');
    };

    // Throttle utility
    let timeoutId: number | null = null;
    const throttledResize = () => {
      if (timeoutId === null) {
        timeoutId = window.setTimeout(() => {
          handleResize();
          timeoutId = null;
        }, 16);
      }
    };

    const observer = new ResizeObserver((entries) => {
      let shouldUpdate = false;
      for (const entry of entries) {
        const targetId = Object.keys(elementRefs.current).find(
          key => elementRefs.current[key] === entry.target
        );
        if (!targetId) continue;

        const { height } = entry.contentRect;
        const prevHeight = prevHeightsRef.current[targetId] || 0;
        if (Math.abs(height - prevHeight) > 2) {
          shouldUpdate = true;
          prevHeightsRef.current[targetId] = height;
        }
      }

      if (shouldUpdate) {
        throttledResize();
      }
    });

    observerRef.current = observer;

    // Monitora il contenitore principale della card
    const containerNode = elementRefs.current['card-container'];
    if (containerNode) {
      observer.observe(containerNode);
    }

    // Monitora gli essenziali stabili misurati runtime
    for (const ess of essentials) {
      if (ess.staticHeight === undefined && (!ess.states || ess.states.length === 0)) {
        const node = elementRefs.current[ess.id];
        if (node) {
          observer.observe(node);
        }
      }
    }

    // Esegue il primo calcolo sincrono
    handleResize();

    return () => {
      observer.disconnect();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [availableHeight, essentials, flexibles, compressionPriority]);

  // Dev-only warning per ref mancanti o blocco in pending
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const timeout = setTimeout(() => {
        if (status === 'pending') {
          console.warn(
            `[useDynamicCardLayout Warning]: L'hook è bloccato in stato 'pending' nella card.` +
            ` Assicurati di aver registrato correttamente i ref per 'card-container' e tutti gli elementi essenziali.`
          );
        }
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [status]);

  return {
    status,
    essentialStates: layoutResult.essentialStates,
    flexiblesStatus: layoutResult.flexiblesStatus,
    showDrawerCta: layoutResult.showDrawerCta,
    emergencyScroll: layoutResult.emergencyScroll,
    registerRef
  };
}
