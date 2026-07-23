import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LogoVertical } from "@/components/ui/LogoVertical";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
type DemoStep = "content" | "gate" | "result";
type ContentChoice = "article" | "song";

export interface DemoGateFlowProps {
  initialChoice: ContentChoice;
  onComplete: () => void;
  onSkip: () => void;
}

// ------------------------------------------------------------------
// Data — verbatim from previous version
// ------------------------------------------------------------------
const ARTICLE_CONTENT = `Ogni giorno milioni di persone condividono articoli senza leggerli. Commentano video senza guardarli. Reagiscono a titoli senza aprire il link. Il risultato è un ecosistema digitale dove il rumore ha sostituito il significato e la velocità ha ucciso la comprensione.

NoParrot nasce da una domanda semplice: e se prima di commentare dovessi dimostrare di aver capito?

Non è un quiz scolastico. È quello che chiamiamo Comprehension Gate — un momento di messa a fuoco. Quando trovi un contenuto interessante su NoParrot, prima di entrare nella discussione ti vengono poste tre domande generate dall'intelligenza artificiale. Non servono risposte perfette: serve attenzione. Il Gate non giudica la tua intelligenza, verifica la tua intenzione.

Chi supera il Gate ottiene un badge visibile sui propri commenti. È un segnale per tutti gli altri: questa persona ha letto, ha capito, ha qualcosa da dire. Il risultato è una discussione dove ogni voce ha peso, ogni commento ha contesto, ogni interazione ha senso.

Ma NoParrot non si ferma al Gate. La piattaforma costruisce la tua Nebulosa Cognitiva — una mappa visiva e interattiva dei temi che hai esplorato e compreso. Ogni Gate superato illumina un nodo nella tua mappa.

Comprendi. Discuti. Cresci. Questo è NoParrot.`;

const ARTICLE_QUESTIONS = [
  {
    id: "q1",
    stem: "Cosa verifica il Comprehension Gate?",
    choices: [
      { id: "c1a", text: "La cultura generale dell'utente" },
      { id: "c1b", text: "L'attenzione e la comprensione del contenuto" },
      { id: "c1c", text: "La velocità di lettura" },
    ],
    correctId: "c1b",
  },
  {
    id: "q2",
    stem: "Cos'è la Nebulosa Cognitiva?",
    choices: [
      { id: "c2a", text: "Un algoritmo che seleziona i contenuti" },
      { id: "c2b", text: "Una mappa visiva dei temi esplorati e compresi" },
      { id: "c2c", text: "Un sistema di notifiche personalizzate" },
    ],
    correctId: "c2b",
  },
  {
    id: "q3",
    stem: "Qual è l'approccio di NoParrot alle fonti?",
    choices: [
      { id: "c3a", text: "Seleziona una sola fonte autorevole per notizia" },
      { id: "c3b", text: "Sintetizza fonti multiple, verifica affidabilità della fonte" },
      { id: "c3c", text: "Blocca le fonti con bassa reputazione" },
    ],
    correctId: "c3b",
  },
];

const SONG_QUESTIONS = [
  {
    id: "qs1",
    stem: "Contro cosa si rivolgono le parole della canzone?",
    choices: [
      { id: "cs1a", text: "Contro il sistema politico" },
      { id: "cs1b", text: "Contro un sistema educativo oppressivo che soffoca l'individualità" },
      { id: "cs1c", text: "Contro la società dei consumi" },
    ],
    correctId: "cs1b",
  },
  {
    id: "qs2",
    stem: "Cosa rappresenta il 'muro' nella canzone?",
    choices: [
      { id: "cs2a", text: "Un muro fisico tra due paesi" },
      { id: "cs2b", text: "La barriera emotiva e psicologica costruita dalle esperienze negative" },
      { id: "cs2c", text: "Il confine tra infanzia e età adulta" },
    ],
    correctId: "cs2b",
  },
  {
    id: "qs3",
    stem: "Qual è il messaggio centrale del brano?",
    choices: [
      { id: "cs3a", text: "L'importanza della disciplina nell'educazione" },
      { id: "cs3b", text: "Il rifiuto del conformismo imposto dall'educazione tradizionale" },
      { id: "cs3c", text: "La nostalgia per l'infanzia perduta" },
    ],
    correctId: "cs3b",
  },
];

// ------------------------------------------------------------------
// Shared tokens
// ------------------------------------------------------------------
const BASE = "#0E1522";
const BLUE = "#0A7AFF";
const TEAL = "#06B6D4";
const PINK = "#E41E52";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const ANTON = "'Anton', 'Impact', sans-serif";

// ------------------------------------------------------------------
// Small building blocks
// ------------------------------------------------------------------
const BackButton = ({ onClick, label = "Indietro" }: { onClick: () => void; label?: string }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      background: "transparent",
      border: "none",
      color: "rgba(255,255,255,0.6)",
      fontFamily: MONO,
      fontSize: 10,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      padding: "8px 4px",
      cursor: "pointer",
    }}
  >
    <ArrowLeft size={14} strokeWidth={2} /> {label}
  </button>
);

const Eyebrow = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <div
    style={{
      fontFamily: MONO,
      fontSize: 10.5,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color,
      marginBottom: 14,
    }}
  >
    {children}
  </div>
);

const PrimaryButton = ({
  children,
  onClick,
  disabled,
  color = BLUE,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color?: string;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      width: "100%",
      height: 54,
      borderRadius: 26,
      background: color,
      color: "#FFFFFF",
      border: "none",
      fontFamily: "Inter, sans-serif",
      fontSize: 15.5,
      fontWeight: 600,
      letterSpacing: "0.01em",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      boxShadow: "0 10px 30px rgba(10,122,255,0.28)",
    }}
  >
    {children}
  </button>
);

const GhostLink = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      background: "transparent",
      border: "none",
      color: "rgba(255,255,255,0.55)",
      fontFamily: MONO,
      fontSize: 10,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      padding: "10px 4px",
      cursor: "pointer",
    }}
  >
    {children}
  </button>
);

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
export const DemoGateFlow = ({ initialChoice, onComplete, onSkip }: DemoGateFlowProps) => {
  const [choice, setChoice] = useState<ContentChoice>(initialChoice);
  const [step, setStep] = useState<DemoStep>("content");

  const [gateProgress, setGateProgress] = useState(0);
  const [gateAnswers, setGateAnswers] = useState<Record<string, string>>({});
  const [gateValidating, setGateValidating] = useState(false);
  const [gateFeedback, setGateFeedback] = useState<boolean | null>(null);
  const [gateSelectedChoice, setGateSelectedChoice] = useState<string | null>(null);
  const [gateErrors, setGateErrors] = useState(0);
  const [gatePassed, setGatePassed] = useState(false);

  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  const activeQuestions = choice === "article" ? ARTICLE_QUESTIONS : SONG_QUESTIONS;
  const currentQuestion = activeQuestions[gateProgress];
  const contentLabel = choice === "article" ? "Articolo" : "Ascolto";

  useEffect(() => {
    setChoice(initialChoice);
  }, [initialChoice]);

  useEffect(() => {
    if (step === "gate") {
      setGateProgress(0);
      setGateAnswers({});
      setGateErrors(0);
      setGateFeedback(null);
      setGateSelectedChoice(null);
    }
  }, [step]);

  useEffect(() => {
    if (choice === "song" && step === "content" && !lyrics) {
      setLoadingLyrics(true);
      (async () => {
        try {
          const trackUrl = "https://open.spotify.com/intl-it/track/4gMgiXfqyzZLMhsksGmbQV";
          const { data, error } = await supabase.functions.invoke("fetch-lyrics", {
            body: { url: trackUrl },
          });
          if (error || !data || !data.lyrics) throw new Error("no lyrics");
          setLyrics(data.lyrics);
        } catch {
          // fallback link shown
        } finally {
          setLoadingLyrics(false);
        }
      })();
    }
  }, [choice, step, lyrics]);

  const handleStartGate = useCallback(() => setStep("gate"), []);

  const handleGateAnswerChoice = (choiceId: string) => {
    if (gateValidating || gateFeedback !== null) return;
    setGateSelectedChoice(choiceId);
    setGateValidating(true);

    setTimeout(() => {
      const isCorrect = choiceId === currentQuestion.correctId;
      setGateFeedback(isCorrect);
      setGateValidating(false);
      setGateAnswers({ ...gateAnswers, [currentQuestion.id]: choiceId });

      if (!isCorrect) {
        const newTotal = gateErrors + 1;
        setGateErrors(newTotal);
        if (newTotal >= 2) {
          setTimeout(() => {
            setGatePassed(false);
            setStep("result");
          }, 700);
          return;
        }
        setTimeout(() => {
          setGateFeedback(null);
          setGateSelectedChoice(null);
        }, 700);
      } else {
        if (gateProgress < activeQuestions.length - 1) {
          setTimeout(() => {
            setGateProgress((p) => p + 1);
            setGateFeedback(null);
            setGateSelectedChoice(null);
          }, 700);
        } else {
          setTimeout(() => {
            setGatePassed(true);
            setStep("result");
          }, 700);
        }
      }
    }, 500);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: BASE,
        color: "#FFFFFF",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AnimatePresence mode="wait">
        {step === "content" && choice === "article" && (
          <motion.div
            key="article"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            <div
              style={{
                padding: "max(env(safe-area-inset-top, 0px), 14px) 20px 4px 20px",
              }}
            >
              <BackButton onClick={onSkip} />
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px 22px 140px 22px",
                maxWidth: 720,
                width: "100%",
                margin: "0 auto",
              }}
            >
              <Eyebrow color={BLUE}>Articolo · 2 min di lettura</Eyebrow>
              <h1
                style={{
                  fontFamily: ANTON,
                  fontSize: 40,
                  lineHeight: 0.98,
                  letterSpacing: "0.005em",
                  textTransform: "uppercase",
                  margin: "0 0 20px 0",
                }}
              >
                Il social dove capisci prima di parlare
              </h1>
              {ARTICLE_CONTENT.split("\n\n").map((p, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 16,
                    lineHeight: 1.65,
                    color: "rgba(255,255,255,0.82)",
                    margin: "0 0 18px 0",
                  }}
                >
                  {p}
                </p>
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "40px 22px max(env(safe-area-inset-bottom, 0px), 22px) 22px",
                background: `linear-gradient(to top, ${BASE} 60%, rgba(14,21,34,0))`,
              }}
            >
              <div style={{ maxWidth: 520, margin: "0 auto" }}>
                <PrimaryButton onClick={handleStartGate}>
                  Ho letto, mettiamo a fuoco →
                </PrimaryButton>
              </div>
            </div>
          </motion.div>
        )}

        {step === "content" && choice === "song" && (
          <motion.div
            key="song"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            <div style={{ padding: "max(env(safe-area-inset-top, 0px), 14px) 20px 4px 20px" }}>
              <BackButton onClick={onSkip} />
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px 22px 140px 22px",
                maxWidth: 640,
                width: "100%",
                margin: "0 auto",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
                <div
                  style={{
                    width: 190,
                    height: 190,
                    borderRadius: 6,
                    marginBottom: 18,
                    background: "linear-gradient(135deg, #2a2a3e 0%, #0a0a12 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: ANTON,
                      fontSize: 34,
                      letterSpacing: "0.12em",
                      color: "rgba(255,255,255,0.85)",
                    }}
                  >
                    THE WALL
                  </span>
                </div>
                <h2
                  style={{
                    fontFamily: ANTON,
                    fontSize: 32,
                    lineHeight: 1,
                    textTransform: "uppercase",
                    textAlign: "center",
                    margin: 0,
                  }}
                >
                  Another Brick in the Wall
                </h2>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: MONO,
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  Pink Floyd · The Wall · 1979
                </div>
                <a
                  href="https://open.spotify.com/intl-it/track/4gMgiXfqyzZLMhsksGmbQV"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: 18,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 20px",
                    borderRadius: 999,
                    background: "#1DB954",
                    color: "#000",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Apri in Spotify
                </a>
              </div>

              <div
                style={{
                  background: "rgba(26, 35, 54, 0.6)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 20,
                  padding: 20,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                {loadingLyrics ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, gap: 10, color: "rgba(255,255,255,0.6)" }}>
                    <Loader2 size={18} className="animate-spin" />
                    <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      Recupero testo…
                    </span>
                  </div>
                ) : lyrics ? (
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      textAlign: "center",
                      fontFamily: "Inter, sans-serif",
                      fontSize: 15,
                      lineHeight: 2,
                      color: "rgba(255,255,255,0.82)",
                    }}
                  >
                    {lyrics}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.6)", fontFamily: "Inter, sans-serif", fontSize: 14 }}>
                    Ascolta la canzone su Spotify prima di procedere.
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "40px 22px max(env(safe-area-inset-bottom, 0px), 22px) 22px",
                background: `linear-gradient(to top, ${BASE} 60%, rgba(14,21,34,0))`,
              }}
            >
              <div style={{ maxWidth: 520, margin: "0 auto" }}>
                <PrimaryButton onClick={handleStartGate}>
                  Ho ascoltato, mettiamo a fuoco →
                </PrimaryButton>
              </div>
            </div>
          </motion.div>
        )}

        {step === "gate" && (
          <motion.div
            key="gate"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 22px",
            }}
          >
            <div style={{ position: "absolute", top: "max(env(safe-area-inset-top, 0px), 14px)", left: 20 }}>
              <BackButton onClick={() => setStep("content")} />
            </div>
            <div style={{ width: "100%", maxWidth: 520 }}>
              <Eyebrow color={PINK}>Gate di prova · {contentLabel}</Eyebrow>
              <h2
                style={{
                  fontFamily: ANTON,
                  fontSize: 40,
                  lineHeight: 0.98,
                  textTransform: "uppercase",
                  margin: "0 0 12px 0",
                }}
              >
                METTIAMO A FUOCO.
              </h2>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.55)",
                  marginBottom: 10,
                }}
              >
                Domanda {gateProgress + 1} · {activeQuestions.length} — massimo un errore
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
                {activeQuestions.map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background:
                        idx < gateProgress
                          ? TEAL
                          : idx === gateProgress
                          ? BLUE
                          : "rgba(255,255,255,0.12)",
                      boxShadow:
                        idx === gateProgress ? "0 0 10px rgba(10,122,255,0.55)" : "none",
                      transition: "all 200ms ease",
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  background: "rgba(26, 35, 54, 0.72)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 18,
                  padding: 18,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 16,
                    lineHeight: 1.4,
                    color: "#FFFFFF",
                    marginBottom: 14,
                    fontWeight: 500,
                  }}
                >
                  {currentQuestion.stem}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {currentQuestion.choices.map((c) => {
                    const isSelected = gateSelectedChoice === c.id;
                    const showFeedback = gateFeedback !== null && isSelected;
                    let bg = "rgba(255,255,255,0.03)";
                    let border = "1px solid rgba(255,255,255,0.06)";
                    let color = "rgba(255,255,255,0.85)";
                    if (isSelected && gateValidating) {
                      bg = "rgba(10,122,255,0.14)";
                      border = `1px solid ${BLUE}88`;
                    }
                    if (showFeedback && gateFeedback === true) {
                      bg = "rgba(6,182,212,0.18)";
                      border = `1px solid ${TEAL}`;
                      color = "#FFFFFF";
                    }
                    if (showFeedback && gateFeedback === false) {
                      bg = "rgba(228,30,82,0.18)";
                      border = `1px solid ${PINK}`;
                      color = "#FFFFFF";
                    }
                    const opacity = gateFeedback !== null && !isSelected ? 0.45 : 1;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleGateAnswerChoice(c.id)}
                        disabled={gateFeedback !== null || gateValidating}
                        style={{
                          minHeight: 44,
                          padding: "10px 14px",
                          borderRadius: 12,
                          background: bg,
                          border,
                          color,
                          textAlign: "left",
                          fontFamily: "Inter, sans-serif",
                          fontSize: 14,
                          lineHeight: 1.35,
                          cursor: gateFeedback !== null ? "default" : "pointer",
                          opacity,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          transition: "all 180ms ease",
                        }}
                      >
                        {isSelected && gateValidating && <Loader2 size={16} className="animate-spin" />}
                        <span style={{ flex: 1 }}>{c.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <GhostLink onClick={() => setStep("content")}>← Torna al contenuto</GhostLink>
            </div>
          </motion.div>
        )}

        {step === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "0 26px",
              maxWidth: 560,
              width: "100%",
              margin: "0 auto",
            }}
          >
            {gatePassed ? (
              <>
                <Eyebrow color={TEAL}>Gate di prova · Superato</Eyebrow>
                <h1
                  style={{
                    fontFamily: ANTON,
                    fontSize: 56,
                    lineHeight: 0.94,
                    letterSpacing: "0.005em",
                    textTransform: "uppercase",
                    margin: "0 0 22px 0",
                  }}
                >
                  HAI MESSO
                  <br />A FUOCO.
                </h1>
                <p
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,0.78)",
                    margin: "0 0 20px 0",
                  }}
                >
                  Prima comprensione registrata: è il{" "}
                  <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>primo nodo</strong>{" "}
                  della tua nebulosa. E nei commenti, chi supera il gate porta questo segno:
                </p>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    height: 22,
                    padding: "0 10px",
                    borderRadius: 999,
                    background: "rgba(10, 122, 255, 0.18)",
                    color: "#7FB3FF",
                    fontFamily: MONO,
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: "0.10em",
                    textTransform: "uppercase",
                    marginBottom: 32,
                  }}
                >
                  <LogoVertical hideText={true} className="w-3.5 h-3.5" />
                  HA LETTO
                </span>
                <div style={{ width: "100%" }}>
                  <PrimaryButton onClick={onComplete}>Crea il tuo account →</PrimaryButton>
                </div>
              </>
            ) : (
              <>
                <Eyebrow color={PINK}>Gate di prova · Non superato</Eyebrow>
                <h1
                  style={{
                    fontFamily: ANTON,
                    fontSize: 64,
                    lineHeight: 0.94,
                    textTransform: "uppercase",
                    margin: "0 0 22px 0",
                  }}
                >
                  QUASI.
                </h1>
                <p
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 16,
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,0.78)",
                    margin: "0 0 32px 0",
                  }}
                >
                  Il Gate non è un esame: è un invito a{" "}
                  <strong style={{ color: "#FFFFFF", fontWeight: 600 }}>rileggere con più attenzione</strong>. Su NoParrot ogni tentativo è crescita.
                </p>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                  <PrimaryButton onClick={() => setStep("content")}>Rileggi e riprova</PrimaryButton>
                  <GhostLink onClick={onSkip}>Salta e crea l'account →</GhostLink>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DemoGateFlow;