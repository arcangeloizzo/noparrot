import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { XCircle, CheckCircle2, ChevronRight, Loader2, Sparkles, BookOpen, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Types
type DemoStep = "intro" | "article" | "song" | "gate" | "result";
type ContentChoice = "article" | "song" | null;

interface DemoGateFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

// ----------------------------------------------------------------------
// DATA: Demo Content
// ----------------------------------------------------------------------
const ARTICLE_CONTENT = `Ogni giorno milioni di persone condividono articoli senza leggerli. Commentano video senza guardarli. Reagiscono a titoli senza aprire il link. Il risultato è un ecosistema digitale dove il rumore ha sostituito il significato e la velocità ha ucciso la comprensione.

NoParrot nasce da una domanda semplice: e se prima di commentare dovessi dimostrare di aver capito?

Non è un quiz scolastico. È quello che chiamiamo Comprehension Gate — un momento di messa a fuoco. Quando trovi un contenuto interessante su NoParrot, prima di entrare nella discussione ti vengono poste tre domande generate dall'intelligenza artificiale. Non servono risposte perfette: serve attenzione. Il Gate non giudica la tua intelligenza, verifica la tua intenzione.

Chi supera il Gate ottiene un badge visibile sui propri commenti. È un segnale per tutti gli altri: questa persona ha letto, ha capito, ha qualcosa da dire. Il risultato è una discussione dove ogni voce ha peso, ogni commento ha contesto, ogni interazione ha senso.

Ma NoParrot non si ferma al Gate. La piattaforma costruisce la tua Nebulosa Cognitiva — una mappa visiva e interattiva dei temi che hai esplorato e compreso. Società, economia, scienza, cultura, tecnologia, politica: ogni Gate superato illumina un nodo nella tua mappa. È il tuo portfolio intellettuale, la prova visibile della tua curiosità.

Poi c'è Il Punto: quando un tema è complesso, l'intelligenza artificiale di NoParrot sintetizza le fonti multiple in un unico contenuto trasparente, con ogni fonte linkata e verificabile. Non è giornalismo — è aggregazione intelligente che ti permette di confrontare le prospettive invece di sceglierne una sola.

E infine il Trust Score: un punteggio di affidabilità della fonte, non del singolo articolo. Quando qualcuno condivide un link, vedi subito se proviene da una testata con una storia di rigore o da un sito discutibile.

Il design è intenzionale. Feed immersivo, niente pubblicità il primo anno, niente notifiche aggressive. Solo tu e il contenuto. NoParrot non compete con Instagram sulla velocità o con TikTok sulla viralità. Compete con il tempo che sprechi in doomscrolling — e lo trasforma in crescita.

Comprendi. Discuti. Cresci. Questo è NoParrot.`;

// ----------------------------------------------------------------------
// DATA: Hardcoded Quiz Questions
// ----------------------------------------------------------------------
const ARTICLE_QUESTIONS = [
  {
    id: "q1",
    stem: "Cosa verifica il Comprehension Gate?",
    choices: [
      { id: "c1a", text: "La cultura generale dell'utente" },
      { id: "c1b", text: "L'attenzione e la comprensione del contenuto" }, // CORRECT
      { id: "c1c", text: "La velocità di lettura" },
    ],
    correctId: "c1b"
  },
  {
    id: "q2",
    stem: "Cos'è la Nebulosa Cognitiva?",
    choices: [
      { id: "c2a", text: "Un algoritmo che seleziona i contenuti" },
      { id: "c2b", text: "Una mappa visiva dei temi esplorati e compresi dall'utente" }, // CORRECT
      { id: "c2c", text: "Un sistema di notifiche personalizzate" },
    ],
    correctId: "c2b"
  },
  {
    id: "q3",
    stem: "Qual è l'approccio di NoParrot alle fonti di informazione?",
    choices: [
      { id: "c3a", text: "Seleziona una sola fonte autorevole per ogni notizia" },
      { id: "c3b", text: "Sintetizza fonti multiple con trasparenza e verifica l'affidabilità della fonte" }, // CORRECT
      { id: "c3c", text: "Blocca le fonti con bassa reputazione" },
    ],
    correctId: "c3b"
  }
];

const SONG_QUESTIONS = [
  {
    id: "qs1",
    stem: "Contro cosa si rivolgono le parole della canzone?",
    choices: [
      { id: "cs1a", text: "Contro il sistema politico" },
      { id: "cs1b", text: "Contro un sistema educativo oppressivo che soffoca l'individualità" }, // CORRECT
      { id: "cs1c", text: "Contro la società dei consumi" },
    ],
    correctId: "cs1b"
  },
  {
    id: "qs2",
    stem: "Cosa rappresenta il 'muro' nella canzone?",
    choices: [
      { id: "cs2a", text: "Un muro fisico tra due paesi" },
      { id: "cs2b", text: "La barriera emotiva e psicologica costruita dalle esperienze negative" }, // CORRECT
      { id: "cs2c", text: "Il confine tra infanzia e età adulta" },
    ],
    correctId: "cs2b"
  },
  {
    id: "qs3",
    stem: "Qual è il messaggio centrale del brano?",
    choices: [
      { id: "cs3a", text: "L'importanza della disciplina nell'educazione" },
      { id: "cs3b", text: "Il rifiuto del conformismo e del controllo imposti dall'educazione tradizionale" }, // CORRECT
      { id: "cs3c", text: "La nostalgia per l'infanzia perduta" },
    ],
    correctId: "cs3b"
  }
];

export const DemoGateFlow = ({ onComplete, onSkip }: DemoGateFlowProps) => {
  const [step, setStep] = useState<DemoStep>("intro");
  const [choice, setChoice] = useState<ContentChoice>(null);
  
  // Gate state
  const [gateProgress, setGateProgress] = useState(0);
  const [gateAnswers, setGateAnswers] = useState<Record<string, string>>({});
  const [gateValidating, setGateValidating] = useState(false);
  const [gateFeedback, setGateFeedback] = useState<boolean | null>(null);
  const [gateSelectedChoice, setGateSelectedChoice] = useState<string | null>(null);
  const [gateErrors, setGateErrors] = useState(0);
  
  // Result state
  const [gatePassed, setGatePassed] = useState(false);

  // Song content state
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  const activeQuestions = choice === "article" ? ARTICLE_QUESTIONS : SONG_QUESTIONS;
  const currentQuestion = activeQuestions[gateProgress];

  // Reset gate state when entering gate
  useEffect(() => {
    if (step === "gate") {
      setGateProgress(0);
      setGateAnswers({});
      setGateErrors(0);
      setGateFeedback(null);
      setGateSelectedChoice(null);
    }
  }, [step]);

  // Fetch lyrics if choosing song
  useEffect(() => {
    if (step === "song" && !lyrics) {
      setLoadingLyrics(true);
      const fetchLyrics = async () => {
        try {
          // Spotify URL for Another Brick in the Wall (Part 2)
          const trackUrl = "https://open.spotify.com/intl-it/track/4gMgiXfqyzZLMhsksGmbQV";
          const { data, error } = await supabase.functions.invoke('fetch-lyrics', {
            body: { url: trackUrl }
          });
          
          if (error || !data || !data.lyrics) {
            throw new Error("Failed to fetch lyrics");
          }
          setLyrics(data.lyrics);
        } catch (e) {
          console.error("Error fetching lyrics:", e);
          // Don't set text, we'll show fallback link instead
        } finally {
          setLoadingLyrics(false);
        }
      };
      fetchLyrics();
    }
  }, [step, lyrics]);

  const handleCardClick = (selected: ContentChoice) => {
    setChoice(selected);
    if (selected === "article") setStep("article");
    if (selected === "song") setStep("song");
  };

  const handleStartGate = () => {
    setStep("gate");
  };

  const handleGateAnswerChoice = (choiceId: string) => {
    if (gateValidating || gateFeedback !== null) return;
    
    setGateSelectedChoice(choiceId);
    setGateValidating(true);
    
    // Simulate network delay
    setTimeout(() => {
      const isCorrect = choiceId === currentQuestion.correctId;
      setGateFeedback(isCorrect);
      setGateValidating(false);
      
      const newAnswers = { ...gateAnswers, [currentQuestion.id]: choiceId };
      setGateAnswers(newAnswers);
      
      if (!isCorrect) {
        const newTotalErrors = gateErrors + 1;
        setGateErrors(newTotalErrors);
        
        if (newTotalErrors >= 2) {
          // Failure
          setTimeout(() => {
            setGatePassed(false);
            setStep("result");
          }, 800);
          return;
        }
        
        // 1 error allowed
        setTimeout(() => {
          setGateFeedback(null);
          setGateSelectedChoice(null);
        }, 800);
      } else {
        // Correct
        if (gateProgress < activeQuestions.length - 1) {
          setTimeout(() => {
            setGateProgress(prev => prev + 1);
            setGateFeedback(null);
            setGateSelectedChoice(null);
          }, 800);
        } else {
          // Success
          setTimeout(() => {
            setGatePassed(true);
            setStep("result");
          }, 800);
        }
      }
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0D1B2A] text-white overflow-hidden flex flex-col">
      <AnimatePresence mode="wait">
        
        {/* STEP 1: INTRO */}
        {step === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto"
          >
            <div className="text-center mb-10 w-full space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight" style={{ fontFamily: 'Impact, sans-serif' }}>
                Prima di entrare, prova.
              </h1>
              <p className="text-[rgba(255,255,255,0.7)] text-lg max-w-[280px] mx-auto leading-relaxed">
                Su NoParrot comprendi prima di commentare. Scegli un contenuto e metti a fuoco.
              </p>
            </div>

            <div className="w-full space-y-4">
              {/* CARD 1: Article */}
              <button
                onClick={() => handleCardClick("article")}
                className="w-full text-left p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 relative overflow-hidden group border border-[rgba(10,122,255,0.3)] bg-[rgba(10,122,255,0.08)] backdrop-blur-md hover:border-[#0A7AFF] hover:bg-[rgba(10,122,255,0.15)] focus:outline-none focus:ring-2 focus:ring-[#0A7AFF]"
              >
                <div className="w-12 h-12 rounded-full bg-[rgba(10,122,255,0.2)] flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-[#0A7AFF]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">Cos'è NoParrot?</h3>
                  <p className="text-[rgba(255,255,255,0.6)] text-sm mt-1">Leggi un breve articolo sulla piattaforma</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[rgba(255,255,255,0.3)] ml-auto transition-transform group-hover:translate-x-1" />
              </button>

              {/* CARD 2: Song */}
              <button
                onClick={() => handleCardClick("song")}
                className="w-full text-left p-5 rounded-2xl flex items-center gap-4 transition-all duration-300 relative overflow-hidden group border border-[rgba(228,30,82,0.3)] bg-[rgba(228,30,82,0.08)] backdrop-blur-md hover:border-[#E41E52] hover:bg-[rgba(228,30,82,0.15)] focus:outline-none focus:ring-2 focus:ring-[#E41E52]"
              >
                <div className="w-12 h-12 rounded-full bg-[rgba(228,30,82,0.2)] flex items-center justify-center flex-shrink-0">
                  <Music className="w-6 h-6 text-[#E41E52]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">Another Brick in the Wall</h3>
                  <p className="text-[rgba(255,255,255,0.6)] text-sm mt-1">Pink Floyd · The Wall, 1979</p>
                </div>
                <ChevronRight className="w-5 h-5 text-[rgba(255,255,255,0.3)] ml-auto transition-transform group-hover:translate-x-1" />
              </button>
            </div>

            <div className="mt-12">
              <button 
                onClick={onSkip}
                className="text-[rgba(255,255,255,0.4)] text-sm hover:text-white transition-colors"
              >
                Salta e registrati &rarr;
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 2A: ARTICLE CONTENT */}
        {step === "article" && (
          <motion.div
            key="article"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col w-full max-w-2xl mx-auto h-full"
          >
            <div className="flex-1 overflow-y-auto px-6 py-10 space-y-6 pb-32 scrollbar-hide">
              <button onClick={() => setStep("intro")} className="text-[rgba(255,255,255,0.5)] text-sm mb-4 inline-block">&larr; Indietro</button>
              <h2 className="text-3xl font-bold leading-tight tracking-tight">Il social dove capisci prima di parlare</h2>
              
              <div className="space-y-6 text-[rgba(255,255,255,0.85)] leading-relaxed text-[17px] font-light">
                {ARTICLE_CONTENT.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0D1B2A] via-[#0D1B2A] to-transparent pt-12">
              <div className="max-w-2xl mx-auto">
                <Button 
                  onClick={handleStartGate}
                  className="w-full bg-[#0A7AFF] hover:bg-[#0A7AFF]/90 text-white rounded-xl h-14 text-lg font-medium shadow-lg"
                >
                  Ho letto, mettiamo a fuoco &rarr;
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2B: SONG CONTENT */}
        {step === "song" && (
          <motion.div
            key="song"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col w-full max-w-2xl mx-auto h-full bg-gradient-to-b from-[#1a1a2e] to-[#0D1B2A]"
          >
            <div className="flex-1 overflow-y-auto px-6 py-10 pb-32 scrollbar-hide">
              <button onClick={() => setStep("intro")} className="text-[rgba(255,255,255,0.5)] text-sm mb-6 inline-block">&larr; Indietro</button>
              
              <div className="flex flex-col items-center mb-10">
                <div className="w-48 h-48 bg-[#222] shadow-2xl rounded-sm mb-6 flex items-center justify-center overflow-hidden border border-[rgba(255,255,255,0.1)]">
                  {/* Provide a stylized placeholder since we can't reliably load spotify images without auth/api */}
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center">
                    <span className="font-bold text-3xl tracking-widest uppercase text-white/80" style={{ fontFamily: 'Impact, sans-serif' }}>THE WALL</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center">Another Brick in the Wall (Part 2)</h2>
                <p className="text-[rgba(255,255,255,0.6)] text-center mt-2">Pink Floyd &middot; The Wall &middot; 1979</p>
              </div>

              <div className="bg-black/20 rounded-2xl p-6 backdrop-blur-sm border border-white/5 mx-auto max-w-md">
                {loadingLyrics ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-60">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#E41E52]" />
                    <p>Recupero testo in corso...</p>
                  </div>
                ) : lyrics ? (
                  <div className="whitespace-pre-wrap text-center text-[rgba(255,255,255,0.85)] font-medium leading-[2.5] text-lg">
                    {lyrics}
                  </div>
                ) : (
                   <div className="text-center py-8">
                     <p className="text-[rgba(255,255,255,0.7)] mb-4">Ascolta la canzone e leggi il testo su Spotify prima di procedere.</p>
                     <a 
                       href="https://open.spotify.com/intl-it/track/4gMgiXfqyzZLMhsksGmbQV" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="inline-block px-6 py-3 bg-[#1DB954] text-black font-bold rounded-full hover:scale-105 transition-transform"
                     >
                       Apri in Spotify
                     </a>
                   </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0D1B2A] via-[#0D1B2A] to-transparent pt-12">
              <div className="max-w-2xl mx-auto">
                <Button 
                  onClick={handleStartGate}
                  className="w-full bg-[#E41E52] hover:bg-[#E41E52]/90 text-white rounded-xl h-14 text-lg font-medium shadow-lg"
                >
                  Ho ascoltato, mettiamo a fuoco &rarr;
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: DEMO GATE UI */}
        {step === "gate" && (
           <motion.div
           key="gate"
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm"
         >
           <div className="bg-[#111] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col border border-white/10" style={{ maxHeight: '85vh' }}>
             
             <div className="p-6 border-b border-white/10 flex-shrink-0">
               <h2 className="text-xl font-bold text-center">Mettiamo a fuoco.</h2>
               <p className="text-sm text-muted-foreground text-center mt-2">Una domanda alla volta, per vedere più chiaro.</p>
               <div className="flex justify-center gap-2 mt-4">
                 {activeQuestions.map((_, idx) => (
                   <div key={idx} className={`w-2 h-2 rounded-full transition-all duration-200 ${
                     idx < gateProgress ? "bg-[hsl(var(--cognitive-correct))]" : 
                     idx === gateProgress ? "bg-[hsl(var(--cognitive-glow-blue))] scale-125" : "bg-white/20"}`} />
                 ))}
               </div>
             </div>

             <div className="p-6 flex-1 overflow-y-auto">
               <p className="text-sm text-muted-foreground mb-2">Passo {gateProgress + 1} — facciamo chiarezza su questo punto.</p>
               <h3 className="text-lg font-semibold mb-6">{currentQuestion.stem}</h3>

               <div className="space-y-3">
                 {currentQuestion.choices.map((c) => {
                   const isSelected = gateSelectedChoice === c.id;
                   const showingFeedback = gateFeedback !== null && isSelected;
                   
                   let buttonStyles = "border-white/10 bg-white/5 hover:bg-white/10";
                   if (!gateFeedback && isSelected && gateValidating) buttonStyles = "border-[#0A7AFF] bg-[#0A7AFF]/10";
                   if (showingFeedback && gateFeedback === true) buttonStyles = "border-[hsl(var(--cognitive-glow-blue))] bg-[hsl(var(--cognitive-glow-blue))]/20";
                   if (showingFeedback && gateFeedback === false) buttonStyles = "border-[hsl(var(--cognitive-incorrect))] bg-[hsl(var(--cognitive-incorrect))]/20";
                   if (gateFeedback !== null && !isSelected) buttonStyles += " opacity-50";

                   return (
                     <button 
                       key={c.id} 
                       onClick={() => handleGateAnswerChoice(c.id)}
                       disabled={gateFeedback !== null || gateValidating}
                       className={`w-full p-5 rounded-2xl text-left transition-all border-2 text-base flex items-center gap-3 ${buttonStyles}`}
                     >
                       {!gateFeedback && isSelected && gateValidating && (
                         <Loader2 className="w-5 h-5 animate-spin text-[#0A7AFF]" />
                       )}
                       {showingFeedback && gateFeedback === true && (
                         <CheckCircle2 className="w-5 h-5 text-[hsl(var(--cognitive-glow-blue))]" />
                       )}
                       {showingFeedback && gateFeedback === false && (
                         <XCircle className="w-5 h-5 text-[hsl(var(--cognitive-incorrect))]" />
                       )}
                       <span className={`flex-1 leading-relaxed ${showingFeedback ? "font-medium" : ""}`}>
                         {c.text}
                       </span>
                     </button>
                   );
                 })}
               </div>
               
               {gateFeedback !== null && gateValidating && (
                  <div className="p-5 rounded-2xl mt-6 text-center animate-fade-in bg-white/5 border-2 border-white/10 flex justify-center gap-2 items-center">
                    <Loader2 className="w-4 h-4 animate-spin text-white/50" />
                    <p className="font-medium text-[15px] text-white/50">
                      Sto verificando il risultato…
                    </p>
                  </div>
               )}
             </div>

             <div className="px-6 pb-6 pt-2 flex gap-3 flex-shrink-0">
               <Button 
                 onClick={() => setStep(choice as DemoStep)}
                 variant="outline" 
                 className="flex-1 bg-transparent border-white/10 hover:bg-white/5 text-white"
                 disabled={gateValidating}
               >
                 Annulla
               </Button>
             </div>
           </div>
         </motion.div>
        )}

        {/* STEP 4: RESULT */}
        {step === "result" && (
           <motion.div
           key="result"
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto text-center"
         >
           {gatePassed ? (
             <>
               <motion.div 
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
                 className="mb-8 relative"
               >
                 {/* Mini Nebulosa Effect */}
                 <div className="w-32 h-32 rounded-full border border-white/10 flex items-center justify-center relative bg-black/20">
                    <motion.div 
                      animate={{ 
                        boxShadow: [`0 0 0 0 ${choice === 'article' ? '#0A7AFF' : '#E41E52'}80`, `0 0 20px 10px ${choice === 'article' ? '#0A7AFF' : '#E41E52'}00`] 
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`w-6 h-6 rounded-full ${choice === 'article' ? 'bg-[#0A7AFF]' : 'bg-[#E41E52]'}`}
                    />
                    
                    {/* Other inactive nodes */}
                    <div className="absolute top-4 left-8 w-2 h-2 rounded-full bg-white/10" />
                    <div className="absolute top-10 right-6 w-3 h-3 rounded-full bg-white/10" />
                    <div className="absolute bottom-8 left-6 w-2 h-2 rounded-full bg-white/10" />
                    <div className="absolute bottom-6 right-10 w-4 h-4 rounded-full bg-white/10" />
                 </div>
               </motion.div>

               <h1 className="text-4xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Impact, sans-serif' }}>Hai messo a fuoco.</h1>
               <p className="text-[rgba(255,255,255,0.7)] text-lg mb-4">
                 Ecco come funziona NoParrot: comprendi, poi partecipi. Ogni contenuto che capisci arricchisce la tua mappa mentale.
               </p>
               <p className="text-[rgba(255,255,255,0.4)] text-sm mb-12">
                 Il tuo primo nodo. Registrati per continuare.
               </p>

               <Button 
                 onClick={onComplete}
                 className="w-full bg-gradient-to-r from-[#0A7AFF] to-[#E41E52] hover:opacity-90 text-white rounded-xl h-14 text-lg font-medium shadow-lg hover:scale-105 transition-transform"
               >
                 Crea il tuo account &rarr;
               </Button>
             </>
           ) : (
             <>
               <div className="mb-8 w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                 <XCircle className="w-10 h-10" />
               </div>
               
               <h1 className="text-4xl font-bold tracking-tight mb-4" style={{ fontFamily: 'Impact, sans-serif' }}>Quasi.</h1>
               <p className="text-[rgba(255,255,255,0.7)] text-lg mb-8">
                 Il Gate non è un esame — è un invito a rileggere con più attenzione. Su NoParrot, ogni tentativo è crescita.
               </p>

               <div className="w-full space-y-3">
                 <Button 
                   onClick={() => setStep(choice as DemoStep)}
                   className="w-full bg-[#0A7AFF] hover:bg-[#0A7AFF]/90 text-white rounded-xl h-14 text-lg font-medium shadow-lg"
                 >
                   Riprova &rarr;
                 </Button>
                 
                 <Button 
                   onClick={onSkip}
                   variant="outline"
                   className="w-full border-white/20 text-white hover:bg-white/5 rounded-xl h-14 text-lg font-medium"
                 >
                   Vai alla registrazione &rarr;
                 </Button>
               </div>
             </>
           )}
         </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
