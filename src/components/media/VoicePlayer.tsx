import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Play, Pause, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoicePlayerProps {
  audioUrl: string;
  durationSeconds: number;
  waveformData?: number[] | null;
  transcript?: string | null;
  transcriptStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({
  audioUrl,
  durationSeconds,
  waveformData,
  transcript,
  transcriptStatus
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Fallback waveform if none provided
  const waveform = Array.isArray(waveformData) && waveformData.length > 0
    ? waveformData
    : Array(50).fill(0).map(() => Math.random() * 0.5 + 0.1); // Fake it for older posts if needed

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

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
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(1); // fully complete
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // reset
    }
    // Small timeout to reset progress bar visual
    setTimeout(() => setProgress(0), 500);
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

  return (
    <div className="flex flex-col gap-2 bg-secondary/30 backdrop-blur-sm border border-white/10 rounded-2xl p-3 w-full max-w-sm">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      <div className="flex items-center gap-3">
        {/* Play Button */}
        <Button
          variant="secondary"
          size="icon"
          onClick={togglePlayback}
          className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
        </Button>

        {/* Waveform */}
        <div
          className="flex-1 h-8 flex items-center justify-between gap-px cursor-pointer px-1"
          onClick={handleWaveformClick}
        >
          {waveform.map((amp, index) => {
            const isPlayed = (index / waveform.length) <= progress;
            return (
              <div
                key={index}
                className={cn(
                  "w-1 rounded-full transition-colors duration-150",
                  isPlayed ? "bg-primary" : "bg-primary/20 hover:bg-primary/40"
                )}
                style={{
                  height: `${Math.max(20, amp * 100)}%`
                }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <div className="text-xs font-medium text-muted-foreground tabular-nums shrink-0">
          {formatTime(audioRef.current?.currentTime || 0)} / {formatTime(durationSeconds)}
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between mt-1 px-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] font-semibold tracking-wider rounded-full bg-secondary/50"
          onClick={changeSpeed}
        >
          {playbackRate}x
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 text-[11px] rounded-full flex items-center gap-1",
            showTranscript ? "bg-secondary text-foreground" : "text-muted-foreground"
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
            <span>Trascrizione non disp.</span>
          ) : (
            <>
              Trascrizione
              {showTranscript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </>
          )}
        </Button>
      </div>

      {/* Transcript Expanded View */}
      {showTranscript && hasTranscript && (
        <div className="mt-2 text-sm text-foreground/90 bg-black/10 dark:bg-white/5 rounded-xl p-3 max-h-40 overflow-y-auto leading-relaxed border border-border/50 animate-in fade-in slide-in-from-top-2">
          {transcript}
        </div>
      )}
    </div>
  );
};
