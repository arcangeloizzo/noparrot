import { useState, useLayoutEffect, useEffect, useRef, useCallback } from 'react';

export type CompressionStep = 'full' | 'clamped' | 'pill' | 'compact' | 'hidden';

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
  postId?: string;
  enabled?: boolean;
  cacheKeyExtra?: string;
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
  isCaptionTruncated: boolean;
  registerRef: (id: string) => (node: HTMLElement | null) => void;
  headerRef: React.RefObject<HTMLDivElement>;
  badgeRef: React.RefObject<HTMLDivElement>;
  midRef: React.RefObject<HTMLDivElement>;
  bottomRef: React.RefObject<HTMLDivElement>;
  layoutMode: 'filled' | 'hero' | 'poster';
  bodyLineClamp: number;
  showApprofondisci: boolean;
  titleRef: React.RefObject<HTMLHeadingElement>;
  bodyRef: React.RefObject<HTMLParagraphElement>;
  mediaRef: React.RefObject<HTMLDivElement>;
  slotBottomRef: React.RefObject<HTMLDivElement>;
  subBarRef: React.RefObject<HTMLDivElement>;
}

const PILL_HEIGHT = 36; // Altezza fissa di sistema per le pillole

interface CachedLayout {
  status: 'measured';
  layoutMode: 'filled' | 'hero' | 'poster';
  bodyLineClamp: number;
  showApprofondisci: boolean;
  essentialStates: Record<string, string>;
  flexiblesStatus: Record<string, FlexibleElementStatus>;
  showDrawerCta: boolean;
  emergencyScroll: boolean;
  isCaptionTruncated: boolean;
}

const layoutCache = new Map<string, CachedLayout>();

export function useDynamicCardLayout({
  availableHeight,
  essentials,
  flexibles,
  compressionPriority,
  postId,
  enabled = true,
  cacheKeyExtra = ''
}: UseDynamicCardLayoutProps): CardLayoutResult {
  const cacheKey = postId ? `${postId}_${availableHeight}_${cacheKeyExtra}` : '';
  const cached = cacheKey ? layoutCache.get(cacheKey) : undefined;

  const [status, setStatus] = useState<'pending' | 'measured'>(cached ? 'measured' : 'pending');

  const headerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const slotBottomRef = useRef<HTMLDivElement>(null);
  const subBarRef = useRef<HTMLDivElement>(null);

  const [layoutMode, setLayoutMode] = useState<'filled' | 'hero' | 'poster'>(cached ? cached.layoutMode : 'filled');
  const [bodyLineClamp, setBodyLineClamp] = useState<number>(cached ? cached.bodyLineClamp : 3);
  const [showApprofondisci, setShowApprofondisci] = useState<boolean>(cached ? cached.showApprofondisci : false);

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
    isCaptionTruncated: boolean;
  }>(() => {
    if (cached) {
      return {
        essentialStates: cached.essentialStates,
        flexiblesStatus: cached.flexiblesStatus,
        showDrawerCta: cached.showDrawerCta,
        emergencyScroll: cached.emergencyScroll,
        isCaptionTruncated: cached.isCaptionTruncated
      };
    }
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
      emergencyScroll: false,
      isCaptionTruncated: false
    };
  });

  // Usiamo un ref mutable per conservare il layoutResult corrente ed evitare che computeLayout
  // debba dipendere da layoutResult (che innescherebbe loop di setState infiniti)
  const layoutResultRef = useRef(layoutResult);
  layoutResultRef.current = layoutResult;

  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !enabled) return;

    if (cacheKey && layoutCache.has(cacheKey)) {
      return;
    }

    const computeLayout = () => {
      let currentAvailableHeight = availableHeight;
      if (badgeRef.current) {
        currentAvailableHeight -= (badgeRef.current.offsetHeight + 12);
      } else {
        currentAvailableHeight -= 38;
      }
      if (currentAvailableHeight <= 0) return;

      if (import.meta.env.DEV) {
        if (essentials.length === 0 && flexibles.length === 0) {
          return;
        }
        const flexibleIds = new Set(flexibles.map(f => f.id));
        for (const priorityId of compressionPriority) {
          if (!flexibleIds.has(priorityId)) {
            console.warn(
              `[useDynamicCardLayout] ID '${priorityId}' presente in compressionPriority ` +
              `ma non corrispondente a nessun flessibile dichiarato in 'flexibles'.`
            );
          }
        }
      }

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

      if (import.meta.env.DEV) {
        for (const ess of essentials) {
          const isStatic = ess.staticHeight !== undefined;
          const hasStates = ess.states && ess.states.length > 0;
          if (!isStatic && !hasStates && !elementRefs.current[ess.id]) {
            console.warn(
              `[useDynamicCardLayout] Ref mancante per essenziale '${ess.id}'. ` +
              `Assicurati di aver chiamato registerRef('${ess.id}') sul nodo DOM corrispondente. ` +
              `Senza ref, l'altezza viene calcolata come 0 e il layout sarà errato.`
            );
          }
        }
      }

      // 2. Raccoglie le altezze naturali degli elementi flessibili
      const flexibleNaturalHeights: Record<string, number> = {};
      const currentFlexStatus: Record<string, FlexibleElementStatus> = {};

      for (const flex of flexibles) {
        let naturalHeight = flex.fallbackHeight;
        const node = elementRefs.current[flex.id];
        if (node) {
          const currentStep = layoutResultRef.current.flexiblesStatus[flex.id]?.step || 'full';
          if (currentStep === 'full') {
            naturalHeight = node.getBoundingClientRect().height || node.scrollHeight || flex.fallbackHeight;
            naturalHeightsRef.current[flex.id] = naturalHeight;
          } else {
            const sh = node.scrollHeight;
            if (sh > 0 && (currentStep === 'clamped' || currentStep === 'compact')) {
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
        const slotBottomHeight = slotBottomRef.current?.offsetHeight ?? 0;
        return total + slotBottomHeight;
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
              if ((nextStep === 'clamped' || nextStep === 'compact') && naturalHeight <= flexible.minReadabilityHeight) {
                const clampIndex = flexible.compressionSteps.indexOf(nextStep);
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
              } else if (nextStep === 'clamped' || nextStep === 'compact') {
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

      // FASE D: Spare Space Redistribution
      let spareSpace = currentAvailableHeight - H_tot;

      if (spareSpace > 0) {
        // === Fase D.1 — Promozione essenziali (round-robin REVERSE) ===
        while (spareSpace > 0) {
          let progressedThisRound = false;

          for (const ess of essentials) {
            if (!ess.states || ess.states.length <= 1) {
              continue; // essenziale puro o staticHeight, non promovibile
            }

            const currentStateId = currentEssentialStates[ess.id];
            const currentIndex = ess.states.findIndex(s => s.id === currentStateId);

            if (currentIndex <= 0) {
              continue; // già al più ricco
            }

            // Prova promozione di UN solo step (verso il più ricco)
            const nextRicherState = ess.states[currentIndex - 1];
            const costo = nextRicherState.height - ess.states[currentIndex].height;

            if (costo <= 0) {
              continue; // Evita loop infiniti se il costo è zero o negativo
            }

            if (costo <= spareSpace) {
              // Applica promozione
              currentEssentialStates[ess.id] = nextRicherState.id;
              essentialHeights[ess.id] = nextRicherState.height;
              spareSpace -= costo;
              H_tot += costo;
              progressedThisRound = true;
            }
          }

          if (!progressedThisRound) {
            break; // nessun essenziale promovibile o spare insufficiente
          }
        }

        // === Fase D.2 — Espansione flessibili clamped (REVERSE compressionPriority) ===
        const reversePriority = [...compressionPriority].reverse();
        while (spareSpace > 0) {
          let progressedThisRound = false;

          for (const flexId of reversePriority) {
            const flexStatus = currentFlexStatus[flexId];
            if (!flexStatus) continue;

            if (flexStatus.step !== 'clamped' && flexStatus.step !== 'compact') {
              continue; // solo flessibili in stato clamped o compact vengono espansi
            }

            const flexible = flexibles.find(f => f.id === flexId);
            if (!flexible) continue;

            const naturalHeight = flexibleNaturalHeights[flexId];
            const currentHeight = flexStatus.height;
            const maxIncrease = naturalHeight - currentHeight;

            if (maxIncrease <= 0) {
              continue; // già a naturalHeight o oltre, può tornare full
            }

            const increment = Math.min(spareSpace, maxIncrease);

            if (increment > 0) {
              flexStatus.height += increment;
              spareSpace -= increment;
              H_tot += increment;
              progressedThisRound = true;

              // Se raggiunge o supera la naturalHeight, torna a 'full'
              if (flexStatus.height >= naturalHeight) {
                flexStatus.step = 'full';
                flexStatus.height = naturalHeight;
              }
            }
          }

          if (!progressedThisRound) {
            break;
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

      // Essenziali a stati non al loro stato più ricco
      if (!showDrawerCta) {
        for (const ess of essentials) {
          if (ess.states && ess.states.length > 0) {
            const currentStateId = currentEssentialStates[ess.id];
            if (currentStateId !== ess.states[0].id) {
              showDrawerCta = true;
              break;
            }
          }
        }
      }

      // Calcola se la didascalia (flexible-text) è troncata
      const captionEl = elementRefs.current['flexible-text'];
      const isCaptionTruncated = captionEl
        ? captionEl.scrollHeight > captionEl.clientHeight + 4
        : false;

      // Evita aggiornamenti di stato se i valori sono identici a quelli correnti
      const prevResult = layoutResultRef.current;
      const isIdentical = 
        JSON.stringify(prevResult.essentialStates) === JSON.stringify(currentEssentialStates) &&
        JSON.stringify(prevResult.flexiblesStatus) === JSON.stringify(currentFlexStatus) &&
        prevResult.showDrawerCta === showDrawerCta &&
        prevResult.emergencyScroll === emergencyScroll &&
        prevResult.isCaptionTruncated === isCaptionTruncated;

      if (!isIdentical) {
        setLayoutResult({
          essentialStates: currentEssentialStates,
          flexiblesStatus: currentFlexStatus,
          showDrawerCta,
          emergencyScroll,
          isCaptionTruncated
        });
      }

      // 1. Calcola altezza disponibile per il body (zone-mid meno fratelli essenziali)
      const midClientHeight = midRef.current?.clientHeight ?? 0;
      const titleHeight     = titleRef.current?.offsetHeight ?? 0;
      const subBarHeight    = subBarRef.current?.offsetHeight ?? 0;
      const mediaHeight     = mediaRef.current?.offsetHeight ?? 0;
      const slotBottomHeight = slotBottomRef.current?.offsetHeight ?? 0;

      const GAPS_FIXED = 12 + 12 + 14 + 16;  // gap margins (§T2)
      const SAFETY = 16;                     // safety margin (§S7)

      const availableForBody = midClientHeight
        - titleHeight
        - subBarHeight
        - mediaHeight
        - slotBottomHeight
        - GAPS_FIXED
        - SAFETY;

      const bodyEl = bodyRef.current;
      // Costante statica del design system (fontSize 14px * lineHeight 1.55)
      // che corrisponde a text-[14px] e lineHeight: 1.55 inline in ImmersivePostCard.tsx
      const LINE_HEIGHT = 21.7;
      const computedLineClamp = Math.max(3, Math.floor(availableForBody / LINE_HEIGHT));
      setBodyLineClamp(prev => prev !== computedLineClamp ? computedLineClamp : prev);

      const bodyFullHeight = bodyEl?.scrollHeight ?? 0;
      const bodyClampedHeight = computedLineClamp * LINE_HEIGHT;
      const isBodyTruncated = bodyFullHeight > bodyClampedHeight + 4;
      setShowApprofondisci(prev => prev !== isBodyTruncated ? isBodyTruncated : prev);

      const hasSlotBottom = slotBottomHeight > 0;
      const hasMedia = mediaHeight > 0;
      const contentRatio = (titleHeight + subBarHeight + (bodyEl?.scrollHeight ?? 0) + mediaHeight) / (midClientHeight || 1);

      let mode: 'filled' | 'hero' | 'poster';
      if (hasSlotBottom || hasMedia) {
        mode = 'filled';
      } else if (contentRatio < 0.30) {
        mode = 'poster';
      } else if (contentRatio < 0.58) {
        mode = 'hero';
      } else {
        mode = 'filled';
      }
      setLayoutMode(prev => prev !== mode ? mode : prev);

      // Aggiorna la cache globale
      if (cacheKey) {
        layoutCache.set(cacheKey, {
          status: 'measured',
          layoutMode: mode,
          bodyLineClamp: computedLineClamp,
          showApprofondisci: isBodyTruncated,
          essentialStates: currentEssentialStates,
          flexiblesStatus: currentFlexStatus,
          showDrawerCta,
          emergencyScroll,
          isCaptionTruncated
        });
      }
    };

    // Esegue il calcolo iniziale in modo sincrono per evitare il flash del layout 'pending'
    computeLayout();
    setStatus('measured');
  }, [availableHeight, essentials, flexibles, compressionPriority, postId, enabled, cacheKey]);

  // Dev-only warning per ref mancanti o blocco in pending
  useEffect(() => {
    if (import.meta.env.DEV) {
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
    isCaptionTruncated: layoutResult.isCaptionTruncated,
    registerRef,
    headerRef,
    badgeRef,
    midRef,
    bottomRef,
    layoutMode,
    bodyLineClamp,
    showApprofondisci,
    titleRef,
    bodyRef,
    mediaRef,
    slotBottomRef,
    subBarRef
  };
}
