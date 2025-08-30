// Comprehension Gate™ – SDK minimo (client-side) per integrazione rapida in Lovable.dev
// -------------------------------------------------------------
// ✅ Cosa fa questo file
// - Fornisce un <CGProvider> con policy di gating (tempo + scroll)
// - Espone l'hook useComprehensionGate() per tracciare lettura/scroll
// - Mostra un QuizModal con 3 domande (mock locale) e calcolo esito
// - Espone <GateButton> che avvolge i bottoni "Condividi", "Commenta", ecc.
// - Ha un layer di API mock sostituibile con vere endpoint quando pronte

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// -------------------------------------------------------------
// TIPI
type GatingPolicy = {
  minReadSeconds?: number; // tempo minimo di lettura
  minScrollRatio?: number; // percentuale di scroll richiesta (0..1)
  passingRule?: "all_correct" | ">=2_of_3";
};

type CGContextValue = {
  policy: Required<GatingPolicy>;
  startTracking: (opts?: { container?: HTMLElement | null }) => void;
  stopTracking: () => void;
  getProgress: () => { seconds: number; scrollRatio: number };
  openQuiz: (content: ContentDescriptor) => Promise<QuizResult>;
};

// -------------------------------------------------------------
// MOCK API (sostituibile) – QUIZ GENERATOR & SUBMIT

type ContentDescriptor = { id: string; title?: string; text?: string };

type QuizChoice = { id: string; text: string };

type QuizQuestion = {
  id: string;
  stem: string;
  choices: QuizChoice[];
  correctId: string; // in mock lo conosciamo; in prod non inviare al client
};

type QuizPayload = {
  id: string;
  questions: QuizQuestion[];
};

type QuizResult = {
  passed: boolean;
  score: number;
  attestation?: string; // JWT in produzione
};

async function apiCreateOrGetQuiz(content: ContentDescriptor): Promise<QuizPayload> {
  // MOCK deterministico: genera 3 domande basate sul titolo/testo.
  const base = (content.title || content.text || "Contenuto NOPARROT").slice(0, 80);
  const q1: QuizQuestion = {
    id: "q1",
    stem: `Qual è il tema principale del contenuto: "${base}"?`,
    choices: [
      { id: "a", text: "Il tema principale descritto nel testo" },
      { id: "b", text: "Un argomento secondario non centrale" },
      { id: "c", text: "Un elemento non menzionato" },
    ],
    correctId: "a",
  };
  const q2: QuizQuestion = {
    id: "q2",
    stem: "Quale evidenza supporta l'idea principale?",
    choices: [
      { id: "a", text: "Un esempio o dato citato nel contenuto" },
      { id: "b", text: "Un'opinione esterna non presente" },
      { id: "c", text: "Una congettura senza base" },
    ],
    correctId: "a",
  };
  const q3: QuizQuestion = {
    id: "q3",
    stem: "Quale dettaglio specifico viene menzionato?",
    choices: [
      { id: "a", text: "Il dettaglio citato nel testo" },
      { id: "b", text: "Un dettaglio inventato" },
      { id: "c", text: "Un dettaglio irrilevante" },
    ],
    correctId: "a",
  };
  return { id: `qz_${content.id}`, questions: [q1, q2, q3] };
}

async function apiSubmitAnswers(quizId: string, answers: Record<string, string>, rule: GatingPolicy["passingRule"]): Promise<QuizResult> {
  // MOCK: confronta con correctId se presente nel payload cache locale
  const payload = quizCache.get(quizId);
  if (!payload) return { passed: false, score: 0 };
  const score = payload.questions.reduce((acc, q) => (answers[q.id] === q.correctId ? acc + 1 : acc), 0);
  const passed = rule === "all_correct" ? score === payload.questions.length : score >= 2;
  return {
    passed,
    score,
    attestation: passed ? `mock-attestation-${quizId}-${Date.now()}` : undefined,
  };
}

const quizCache = new Map<string, QuizPayload>();

// -------------------------------------------------------------
// CONTEXT
const CGContext = createContext<CGContextValue | null>(null);

export const CGProvider: React.FC<{
  children: React.ReactNode;
  policy?: GatingPolicy;
}> = ({ children, policy }) => {
  const [seconds, setSeconds] = useState(0);
  const [scrollRatio, setScrollRatio] = useState(0);
  const tickRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const effectivePolicy: Required<GatingPolicy> = useMemo(
    () => ({
      minReadSeconds: policy?.minReadSeconds ?? 10,
      minScrollRatio: policy?.minScrollRatio ?? 0.8,
      passingRule: policy?.passingRule ?? ">=2_of_3",
    }),
    [policy]
  );

  const handleScroll = useCallback(() => {
    const el = containerRef.current || document.documentElement;
    // Se container specifico: usa clientHeight/scrollHeight del container
    const scrollTop = el.scrollTop || window.scrollY || 0;
    const viewport = (el === document.documentElement ? window.innerHeight : (el as HTMLElement).clientHeight) || 1;
    const total = el.scrollHeight || document.body.scrollHeight || 1;
    const ratio = Math.min(1, Math.max(0, (scrollTop + viewport) / total));
    setScrollRatio(ratio);
  }, []);

  const startTracking = useCallback((opts?: { container?: HTMLElement | null }) => {
    containerRef.current = opts?.container ?? null;
    setSeconds(0);
    setScrollRatio(0);
    // Timer
    tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000) as unknown as number;
    // Scroll listener
    (opts?.container ?? window).addEventListener("scroll", handleScroll, { passive: true } as any);
    // Primo calcolo
    handleScroll();
  }, [handleScroll]);

  const stopTracking = useCallback(() => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    (containerRef.current ?? window).removeEventListener("scroll", handleScroll as any);
  }, [handleScroll]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const openQuiz = useCallback(async (content: ContentDescriptor) => {
    // In un mondo reale potresti creare sessione → ottenere quiz_id → fetch quiz
    const payload = await apiCreateOrGetQuiz(content);
    quizCache.set(payload.id, payload);
    const answers = await QuizModal.open(payload);
    const res = await apiSubmitAnswers(payload.id, answers, effectivePolicy.passingRule);
    return res;
  }, [effectivePolicy.passingRule]);

  const value: CGContextValue = useMemo(() => ({
    policy: effectivePolicy,
    startTracking,
    stopTracking,
    getProgress: () => ({ seconds, scrollRatio }),
    openQuiz,
  }), [effectivePolicy, startTracking, stopTracking, seconds, scrollRatio, openQuiz]);

  return <CGContext.Provider value={value}>{children}</CGContext.Provider>;
};

export function useComprehensionGate() {
  const ctx = useContext(CGContext);
  if (!ctx) throw new Error("useComprehensionGate must be used inside <CGProvider>");
  return ctx;
}

// -------------------------------------------------------------
// QUIZ MODAL (styled with NOPARROT design system)
const QuizModal = {
  open(payload: QuizPayload): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      const root = document.createElement("div");
      root.id = `cg-modal-${payload.id}`;
      document.body.appendChild(root);
      const reactRoot = createRoot(root);

      const Modal: React.FC = () => {
        const [answers, setAnswers] = useState<Record<string, string>>({});
        const [error, setError] = useState<string | null>(null);

        const allAnswered = payload.questions.every((q) => answers[q.id]);

        const onClose = () => {
          reactRoot.unmount();
          document.body.removeChild(root);
        };

        const onSubmit = () => {
          if (!allAnswered) {
            setError("Rispondi a tutte le domande");
            return;
          }
          onClose();
          resolve(answers);
        };

        return (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-2xl w-[90vw] max-w-md mx-4 border border-gray-700">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white">
                  Test di Comprensione
                </h2>
                <button
                  onClick={onClose}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white flex items-center justify-center rounded-md hover:bg-gray-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Questions */}
              <div className="p-4 space-y-5 max-h-[60vh] overflow-auto">
                {payload.questions.map((q, idx) => (
                  <div key={q.id} className="space-y-3">
                    <p className="font-medium text-white text-sm">
                      {idx + 1}. {q.stem}
                    </p>
                    <div className="space-y-2">
                      {q.choices.map((c) => (
                        <label key={c.id} className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name={q.id}
                            value={c.id}
                            checked={answers[q.id] === c.id}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                            className="mt-1 h-4 w-4 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                          />
                          <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                            {c.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="px-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Footer */}
              <div className="p-4 flex items-center justify-end gap-3 border-t border-gray-700">
                <button 
                  onClick={onClose} 
                  className="px-4 py-2 rounded-xl border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Annulla
                </button>
                <button 
                  onClick={onSubmit}
                  disabled={!allAnswered}
                  className={cn(
                    "px-4 py-2 rounded-xl font-medium transition-colors",
                    allAnswered
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  )}
                >
                  Conferma
                </button>
              </div>
            </div>
          </div>
        );
      };

      reactRoot.render(<Modal />);
    });
  },
};

// -------------------------------------------------------------
// GateButton – wrapper pronto per i tuoi pulsanti azione
export const GateButton: React.FC<{
  content: ContentDescriptor;             // id + titolo/testo
  children: React.ReactNode;               // il tuo bottone
  onPassed: (res: QuizResult) => void;    // cosa succede se supera il gate (es. apri share)
  containerRef?: React.RefObject<HTMLElement>; // (opz) per tracking scroll in un div specifico
}> = ({ content, children, onPassed, containerRef }) => {
  const { policy, startTracking, getProgress, openQuiz } = useComprehensionGate();
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!started) {
      startTracking({ container: containerRef?.current ?? null });
      setStarted(true);
    }
    const id = window.setInterval(() => {
      const p = getProgress();
      const isReady = p.seconds >= policy.minReadSeconds && p.scrollRatio >= policy.minScrollRatio;
      setReady(isReady);
    }, 300);
    return () => window.clearInterval(id);
  }, [started, startTracking, getProgress, policy, containerRef]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    const p = getProgress();
    const isReady = p.seconds >= policy.minReadSeconds && p.scrollRatio >= policy.minScrollRatio;
    if (!isReady) {
      alert(`Completa la lettura per sbloccare il test (tempo ≥ ${policy.minReadSeconds}s e scroll ≥ ${Math.round(policy.minScrollRatio * 100)}%)`);
      return;
    }
    const result = await openQuiz(content);
    if (!result.passed) {
      alert("Risposte non sufficienti. Riprova.");
      return;
    }
    onPassed(result);
  };

  return (
    <span onClick={handleClick} style={{ display: "inline-block", opacity: ready ? 1 : 0.8 }}>
      {children}
    </span>
  );
};