import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Play, Pause, Loader2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface VoicePlayerProps {
  audioUrl: string;
  durationSeconds: number;
  waveformData?: number[] | null;
  transcript?: string | null;
  transcriptStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  compact?: boolean;
  accentColor?: string;
}

/** Generate bell-curve waveform with random variation */
const generateWaveform = (count: number, seed?: number[] | null): number[] => {
  if (Array.isArray(seed) && seed.length > 0) return seed;
  return Array.from({ length: count }, (_, i) => {
    const center = count / 2;
    const gaussian = Math.exp(-0.5 * Math.pow((i - center) / (count * 0.28), 2));
    const variation = 0.3 + Math.random() * 0.7;
    return Math.max(0.08, gaussian * variation);
  });
};

export const VoicePlayer: React.FC<VoicePlayerProps> = ({
  audioUrl,
  durationSeconds,
  waveformData,
  transcript,
  transcriptStatus,
  compact = false,
  accentColor = '#0A7AFF',
}) => {
  const isImmediate = audioUrl.startsWith('http') || audioUrl.startsWith('blob:') || audioUrl.startsWith('data:');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(isImmediate ? audioUrl : null);

  useEffect(() => {
    let cancelled = false;
    if (isImmediate) {
      setResolvedUrl(audioUrl);
    } else {
      supabase.storage
        .from('voice-audio')
        .createSignedUrl(audioUrl, 3600)
        .then(({ data, error }) => {
          if (!cancelled) {
            setResolvedUrl(error ? null : data.signedUrl);
          }
        });
    }
    return () => { cancelled = true; };
  }, [audioUrl]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const barCount = compact ? 30 : 50;
  const waveform = useMemo(() => generateWaveform(barCount, waveformData), [barCount, waveformData]);

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
    const p = audioRef.current.currentTime / audioRef.current.duration;
    setProgress(isNaN(p) ? 0 : p);
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
    const pct = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pct * audioRef.current.duration;
    setProgress(pct);
    if (!isPlaying) togglePlayback();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const isTranscriptLoading = transcriptStatus === 'pending' || transcriptStatus === 'processing';
  const hasTranscript = transcriptStatus === 'completed' && transcript;

  const audioEl = (
    <audio
      ref={audioRef}
      src={resolvedUrl ?? undefined}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
      onPause={() => setIsPlaying(false)}
      onPlay={() => setIsPlaying(true)}
    />
  );

  // ─── COMPACT ───
  if (compact) {
    return (
      <div
        className="flex items-center gap-2.5 w-full"
        style={{
          padding: '8px 10px',
          borderRadius: '10px',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {audioEl}
        <button
          onClick={togglePlayback}
          className="shrink-0 flex items-center justify-center active:scale-95 transition-transform"
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: `radial-gradient(circle at 40% 35%, ${accentColor}, ${accentColor}CC)`,
            boxShadow: `0 0 12px ${accentColor}40`,
          }}
        >
          {isPlaying
            ? <Pause className="h-3 w-3 fill-white text-white" />
            : <Play className="h-3 w-3 fill-white text-white ml-px" />
          }
        </button>

        <div
          className="flex-1 flex items-center justify-between cursor-pointer"
          style={{ height: 22 }}
          onClick={handleWaveformClick}
        >
          {waveform.map((amp, i) => {
            const played = (i / waveform.length) <= progress;
            return (
              <div
                key={i}
                style={{
                  width: 2.5, borderRadius: 2, minHeight: 3,
                  height: `${Math.max(14, amp * 100)}%`,
                  backgroundColor: played ? accentColor : 'rgba(255,255,255,0.12)',
                  transition: 'background-color 100ms',
                }}
              />
            );
          })}
        </div>

        <span className="text-[10px] font-medium tabular-nums shrink-0" style={{ color: 'rgba(241,245,249,0.5)' }}>
          {formatTime(currentTime)} / {formatTime(durationSeconds)}
        </span>
      </div>
    );
  }

  // ─── FULL PLAYER ───
  return (
    <div className="flex flex-col w-full" style={{
      background: `linear-gradient(135deg, ${accentColor}0F, rgba(255,255,255,0.03), ${accentColor}0A)`,
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 18,
      padding: '16px 18px',
      backdropFilter: 'blur(8px)',
      gap: 10,
    }}>
      {audioEl}

      <div className="flex items-center gap-3.5">
        {/* Play button */}
        <div className="relative shrink-0 flex items-center justify-center" style={{ width: 46, height: 46 }}>
          {/* Spinning ring when playing */}
          {isPlaying && (
            <div
              className="absolute inset-[-4px] rounded-full animate-spin"
              style={{
                border: `1.5px solid ${accentColor}33`,
                animationDuration: '3s',
              }}
            />
          )}
          <button
            onClick={togglePlayback}
            className="relative z-10 flex items-center justify-center active:scale-95 transition-transform"
            style={{
              width: 46, height: 46, borderRadius: '50%',
              background: `radial-gradient(circle at 40% 35%, ${accentColor}, ${accentColor}CC)`,
              boxShadow: `0 0 20px ${accentColor}40, 0 0 40px ${accentColor}1F`,
            }}
          >
            {isPlaying
              ? <Pause className="h-4 w-4 fill-white text-white" />
              : <Play className="h-4 w-4 fill-white text-white ml-0.5" />
            }
          </button>
        </div>

        {/* Waveform + time */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div
            className="flex items-center justify-between w-full cursor-pointer"
            style={{ height: 36 }}
            onClick={handleWaveformClick}
          >
            {waveform.map((amp, i) => {
              const played = (i / waveform.length) <= progress;
              return (
                <div
                  key={i}
                  style={{
                    width: 2.5, borderRadius: 2, minHeight: 3,
                    height: `${Math.max(8, amp * 100)}%`,
                    backgroundColor: played ? accentColor : 'rgba(255,255,255,0.12)',
                    transition: 'background-color 100ms',
                  }}
                />
              );
            })}
          </div>
          <span className="text-[11px] font-medium tabular-nums" style={{ color: 'rgba(241,245,249,0.5)' }}>
            {formatTime(currentTime)} / {formatTime(durationSeconds)}
          </span>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={changeSpeed}
          className="font-bold transition-colors"
          style={{
            padding: '3px 8px', borderRadius: 10, fontSize: 11,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(241,245,249,0.6)',
            backdropFilter: 'blur(4px)',
            letterSpacing: '0.3px',
            fontWeight: 600,
          }}
        >
          {playbackRate}x
        </button>

        <button
          onClick={() => setShowTranscript(!showTranscript)}
          disabled={transcriptStatus === 'failed'}
          className="flex items-center gap-1.5 transition-colors"
          style={{
            padding: '3px 8px', borderRadius: 10, fontSize: 11,
            background: showTranscript ? `${accentColor}1F` : 'rgba(255,255,255,0.05)',
            border: `1px solid ${showTranscript ? `${accentColor}40` : 'rgba(255,255,255,0.08)'}`,
            color: showTranscript ? accentColor : 'rgba(241,245,249,0.6)',
            backdropFilter: 'blur(4px)',
            letterSpacing: '0.3px',
            fontWeight: 600,
          }}
        >
          {isTranscriptLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Trascrizione...</span>
            </>
          ) : transcriptStatus === 'failed' ? (
            <span style={{ opacity: 0.5 }}>Non disp.</span>
          ) : (
            <>
              <FileText className="h-3 w-3" />
              Trascrizione
            </>
          )}
        </button>
      </div>

      {/* Transcript block */}
      {showTranscript && hasTranscript && (
        <div
          className="animate-in fade-in slide-in-from-top-2"
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '12px 14px',
            maxHeight: 100,
            overflowY: 'auto',
            fontSize: 12.5,
            lineHeight: 1.6,
            color: 'rgba(241,245,249,0.6)',
          }}
        >
          {transcript}
        </div>
      )}
    </div>
  );
};
