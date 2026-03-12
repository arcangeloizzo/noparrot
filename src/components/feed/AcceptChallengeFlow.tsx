import React, { useState, useCallback } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { VoiceRecorder } from "@/components/composer/VoiceRecorder";
import { VoicePlayer } from "@/components/media/VoicePlayer";
import { Loader2, ThumbsDown, ThumbsUp, Mic, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AcceptChallengeFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeId: string;
  challengeThesis: string;
  onComplete?: () => void;
}

type Stance = "for" | "against";

export const AcceptChallengeFlow: React.FC<AcceptChallengeFlowProps> = ({
  open,
  onOpenChange,
  challengeId,
  challengeThesis,
  onComplete,
}) => {
  const [step, setStep] = useState<"stance" | "recording" | "preview">("stance");
  const [stance, setStance] = useState<Stance | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioWaveform, setAudioWaveform] = useState<number[]>([]);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleStanceSelect = (s: Stance) => {
    setStance(s);
    setStep("recording");
  };

  const handleRecordingComplete = useCallback(
    (blob: Blob, duration: number, waveform: number[]) => {
      setAudioBlob(blob);
      setAudioDuration(duration);
      setAudioWaveform(waveform);
      setAudioUrl(URL.createObjectURL(blob));
      setStep("preview");
    },
    []
  );

  const handleReRecord = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl("");
    setStep("recording");
  };

  const handleSubmit = async () => {
    if (!audioBlob || !stance) return;
    setSubmitting(true);

    try {
      // Convert blob to base64
      const buffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const audio_base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke(
        "submit-challenge-response",
        {
          body: {
            challenge_id: challengeId,
            audio_base64,
            audio_mime_type: audioBlob.type,
            stance,
            duration_seconds: audioDuration,
            waveform_data: audioWaveform,
          },
        }
      );

      if (error) {
        // Handle specific edge function errors if they are passed through
        // Supabase functions sometimes wrap the error in a generic response when status != 2xx
        // It's possible the `error` object itself contains the specific message, or we need to parse it
        console.error("submit-challenge-response error object:", error);

        // If the error message from the edge function is known, show a friendly toast
        const isDuplicateMsg =
          error.message?.includes("Already responded") ||
          error.message?.includes("non-2xx") && data?.error === "Already responded to this challenge";

        if (isDuplicateMsg || (data && data.error === "Already responded to this challenge")) {
          throw new Error("Hai già risposto a questa sfida!");
        }

        throw new Error(data?.error || "Errore durante l'invio della risposta");
      }

      if (data?.error) throw new Error(data.error);

      toast.success("Risposta inviata! 🎙️");
      onComplete?.();
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      console.error("submit-challenge-response error:", err);
      // Custom friendly messages
      const msg = err?.message || "Errore durante l'invio";

      if (msg.includes("Hai già risposto") || msg.includes("Already responded") || msg.includes("non-2xx")) {
        toast.error("Hai già risposto a questa sfida!");
      } else if (msg.includes("Challenge expired")) {
        toast.error("Questa sfida è scaduta!");
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetState = () => {
    setStep("stance");
    setStance(null);
    setAudioBlob(null);
    setAudioDuration(0);
    setAudioWaveform([]);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl("");
  };

  const handleClose = (open: boolean) => {
    if (!open) resetState();
    onOpenChange(open);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8 px-5 pt-3 max-h-[85vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />

        {/* Thesis reminder */}
        <div
          className="mb-5 px-4 py-3 rounded-2xl"
          style={{
            background: "linear-gradient(145deg, rgba(255,212,100,0.06), rgba(255,255,255,0.02), rgba(10,122,255,0.04))",
            border: "1px solid rgba(255,212,100,0.15)",
          }}
        >
          <p className="text-xs font-medium text-muted-foreground mb-1">Tesi della sfida</p>
          <p className="text-sm font-semibold text-foreground leading-snug">"{challengeThesis}"</p>
        </div>

        {/* ─── Step: Stance Choice ─── */}
        {step === "stance" && (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-foreground text-center">Qual è la tua posizione?</h3>
            <div className="flex gap-3">
              <button
                onClick={() => handleStanceSelect("for")}
                className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl transition-all active:scale-[0.97]"
                style={{
                  background: "rgba(10,122,255,0.08)",
                  border: "1px solid rgba(10,122,255,0.25)",
                }}
              >
                <ThumbsUp className="h-6 w-6" style={{ color: "#0A7AFF" }} />
                <span className="text-sm font-bold" style={{ color: "#0A7AFF" }}>
                  A favore
                </span>
              </button>
              <button
                onClick={() => handleStanceSelect("against")}
                className="flex-1 flex flex-col items-center gap-2 py-5 rounded-2xl transition-all active:scale-[0.97]"
                style={{
                  background: "rgba(255,212,100,0.08)",
                  border: "1px solid rgba(255,212,100,0.25)",
                }}
              >
                <ThumbsDown className="h-6 w-6" style={{ color: "#FFD464" }} />
                <span className="text-sm font-bold" style={{ color: "#FFD464" }}>
                  Contro la tesi
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ─── Step: Recording ─── */}
        {step === "recording" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Mic className="h-4 w-4" style={{ color: stance === "for" ? "#0A7AFF" : "#FFD464" }} />
                Registra il tuo argomento
              </h3>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: stance === "for" ? "rgba(10,122,255,0.1)" : "rgba(255,212,100,0.1)",
                  color: stance === "for" ? "#0A7AFF" : "#FFD464",
                }}
              >
                {stance === "for" ? "A favore" : "Contro"}
              </span>
            </div>
            <VoiceRecorder
              onRecordingComplete={handleRecordingComplete}
              onCancel={() => setStep("stance")}
              maxDurationSeconds={180}
            />
          </div>
        )}

        {/* ─── Step: Preview + Submit ─── */}
        {step === "preview" && audioUrl && (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-foreground">Anteprima</h3>
            <VoicePlayer
              audioUrl={audioUrl}
              durationSeconds={audioDuration}
              waveformData={audioWaveform}
              accentColor={stance === "for" ? "#0A7AFF" : "#FFD464"}
            />
            <div className="flex gap-3 mt-2">
              <Button variant="outline" className="flex-1" onClick={handleReRecord}>
                Rifai
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Invia risposta
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
