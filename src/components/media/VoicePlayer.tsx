import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, ChevronDown, ChevronUp, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoicePlayerProps {
  audioUrl: string;
  durationSeconds: number;
  waveformData?: number[] | null;
  transcript?: string | null;
  transcriptStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  compact?: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({
  audioUrl,
  durationSeconds,
  waveformData,
  transcript,
  transcriptStatus,
  compact = false
}) => {
  const fullAudioUrl = audioUrl.startsWith('http')
    ? audioUrl
    : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/voice-audio/${audioUrl}`;
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const waveform = Array.isArray(waveformData) && waveformData.length > 0
    ? waveformData
    : Array(compact ? 30 : 50).fill(0).map(() => Math.random() * 0.5 + 0.1);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const changeSpeed = () => {
    if (!audioRef.current) return;
    const nextRate = playbackRate === 1 ? 1.5 : (playbackRate === 1.5 ? 2 : 1);
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const currentProg = audioRef.current.currentTime / audioRef.current.duration;
    setProgress(isNaN(currentProg) ? 0 : currentProg);
    setCurrentTime(audioRef.current.currentTime || 0);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(1);
    if (audioRef.current) audioRef.current.currentTime = 0;
    setTimeout(() => { setProgress(0); setCurrentTime(0); }, 500);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * audioRef.current.duration;
    setProgress(percentage);
    if (!isPlaying) togglePlayback();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isTranscriptLoading = transcriptStatus === 'pending' || transcriptStatus === 'processing';
  const hasTranscript = transcriptStatus === 'completed' && transcript;

  if (compact) {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <audio
          ref={audioRef}
          src={fullAudioUrl}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />
        <div className="flex items-center gap-2.5">
          {/* Compact Play Button */}
          <button
            onClick={togglePlayback}
            className="h-9 w-9 shrink-0 rounded-full bg-primary flex items-center justify-center shadow-[0_0_12px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)] transition-all active:scale-95"
          >
            {isPlaying
              ? <Pause className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground" />
              : <Play className="h-3.5 w-3.5 fill-primary-foreground text-primary-foreground ml-0.5" />
            }
          </button>

          {/* Compact Waveform */}
          <div
            className="flex-1 h-6 flex items-center justify-between gap-[1.5px] cursor-pointer"
            onClick={handleWaveformClick}
          >
            {waveform.map((amp, index) => {
              const isPlayed = (index / waveform.length) <= progress;
              return (
                <div
                  key={index}
                  className={cn(
                    "w-[2.5px] rounded-full transition-colors duration-100",
                    isPlayed ? "bg-primary" : "bg-foreground/10"
                  )}
                  style={{ height: `${Math.max(20, amp * 100)}%` }}
                />
              );
            })}
          </div>

          {/* Compact Time */}
          <span className="text-[10px] font-medium text-muted-foreground tabular-nums shrink-0">
            {formatTime(currentTime)} / {formatTime(durationSeconds)}
          </span>
        </div>
      </div>
    );
  }

  // Full player
  return (
    <div className="flex flex-col gap-2.5 bg-foreground/[0.03] backdrop-blur-xl border border-foreground/[0.08] rounded-2xl p-4 w-full">
      <audio
        ref={audioRef}
        src={fullAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      <div className="flex items-center gap-4">
        {/* Play Button — Large, glowing */}
        <button
          onClick={togglePlayback}
          className="h-12 w-12 shrink-0 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.35)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.5)] transition-all active:scale-95"
        >
          {isPlaying
            ? <Pause className="h-5 w-5 fill-primary-foreground text-primary-foreground" />
            : <Play className="h-5 w-5 fill-primary-foreground text-primary-foreground ml-0.5" />
          }
        </button>

        {/* Waveform — Thicker, defined bars */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div
            className="h-10 flex items-center justify-between gap-[2px] cursor-pointer"
            onClick={handleWaveformClick}
          >
            {waveform.map((amp, index) => {
              const isPlayed = (index / waveform.length) <= progress;
              return (
                <div
                  key={index}
                  className={cn(
                    "w-[3px] rounded-full transition-colors duration-100",
                    isPlayed ? "bg-primary" : "bg-foreground/[0.12]"
                  )}
                  style={{ height: `${Math.max(20, amp * 100)}%` }}
                />
              );
            })}
          </div>

          {/* Time under waveform */}
          <div className="text-[11px] font-medium text-muted-foreground tabular-nums">
            {formatTime(currentTime)} / {formatTime(durationSeconds)}
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <button
          className="h-6 px-2.5 text-[10px] font-bold tracking-wider rounded-full bg-secondary/60 text-muted-foreground hover:bg-secondary transition-colors"
          onClick={changeSpeed}
        >
          {playbackRate}x
        </button>

        <button
          className={cn(
            "h-6 px-2.5 text-[11px] rounded-full flex items-center gap-1.5 transition-colors",
            showTranscript ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60"
          )}
          onClick={() => setShowTranscript(!showTranscript)}
          disabled={transcriptStatus === 'failed'}
        >
          {isTranscriptLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Trascrizione...</span>
            </>
          ) : transcriptStatus === 'failed' ? (
            <span className="opacity-50">Trascrizione non disp.</span>
          ) : (
            <>
              <FileText className="h-3 w-3" />
              Testo
              {showTranscript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </>
          )}
        </button>
      </div>

      {/* Transcript Expanded */}
      {showTranscript && hasTranscript && (
        <div className="text-sm text-foreground/90 bg-foreground/[0.03] rounded-xl p-3 max-h-40 overflow-y-auto leading-relaxed border border-foreground/[0.06] animate-in fade-in slide-in-from-top-2">
          {transcript}
        </div>
      )}
    </div>
  );
};
