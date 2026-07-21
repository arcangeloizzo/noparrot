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
  onShowTranscript?: () => void;
  hideTranscriptButton?: boolean;
}

/** Generate bell-curve waveform with random variation */
const generateWaveform = (count: number, seed?: number[] | null, salt?: string): number[] => {
  if (Array.isArray(seed) && seed.length > 0) {
    // Normalize to `count` bars via block average
    if (seed.length === count) return seed;
    const out: number[] = [];
    const block = seed.length / count;
    for (let i = 0; i < count; i++) {
      const start = Math.floor(i * block);
      const end = Math.max(start + 1, Math.floor((i + 1) * block));
      let sum = 0;
      for (let k = start; k < end; k++) sum += seed[k] ?? 0;
      out.push(sum / (end - start));
    }
    return out;
  }
  // Deterministic fallback derived from `salt` (audioUrl)
  let s = 0;
  const str = salt ?? 'voice';
  for (let i = 0; i < str.length; i++) s = (s * 31 + str.charCodeAt(i)) | 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 10000) / 10000;
  };
  return Array.from({ length: count }, (_, i) => {
    const center = count / 2;
    const gaussian = Math.exp(-0.5 * Math.pow((i - center) / (count * 0.28), 2));
    const variation = 0.3 + rand() * 0.7;
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
  onShowTranscript,
  hideTranscriptButton = false,
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

  const barCount = compact ? 32 : 44;
  const waveform = useMemo(
    () => generateWaveform(barCount, waveformData, audioUrl),
    [barCount, waveformData, audioUrl]
  );

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
    const current = audioRef.current.currentTime || 0;
    const total = durationSeconds > 0 ? durationSeconds : (audioRef.current.duration || 1);
    const p = current / total;
    setProgress(isNaN(p) || !isFinite(p) ? 0 : p);
    setCurrentTime(current);
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
    const total = durationSeconds > 0 ? durationSeconds : (audioRef.current.duration || 1);
    if (isFinite(total) && total > 0) {
      audioRef.current.currentTime = pct * total;
      setProgress(pct);
    }
    if (!isPlaying) togglePlayback();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const remaining = Math.max(0, (durationSeconds || 0) - currentTime);

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
        className="flex items-center w-full"
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: '10px 12px',
          borderRadius: '14px',
          gap: '11px',
          background: 'rgba(255,255,255,0.045)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset',
        }}
      >
        {audioEl}
        <button
          onClick={togglePlayback}
          className="shrink-0 flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(10,14,22,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          {isPlaying
            ? <Pause className="w-[14px] h-[14px] fill-white text-white" />
            : <Play className="w-[14px] h-[14px] fill-white text-white ml-px" />
          }
        </button>

        <div
          className="flex-1 flex items-center cursor-pointer"
          style={{ height: 26, gap: '2px' }}
          onClick={handleWaveformClick}
        >
          {waveform.map((amp, i) => {
            const played = (i / waveform.length) <= progress;
            return (
              <div
                key={i}
                style={{
                  flex: 1, borderRadius: 2, minHeight: '15%',
                  height: `${Math.max(14, amp * 100)}%`,
                  backgroundColor: played ? accentColor : 'rgba(255,255,255,0.18)',
                  transition: 'background-color 100ms',
                }}
              />
            );
          })}
        </div>

        <span
          className="shrink-0 text-right"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10.5px',
            color: 'rgba(255,255,255,0.5)',
            minWidth: '38px',
          }}
        >
          {formatTime(remaining)}
        </span>

        {!hideTranscriptButton && transcriptStatus === 'completed' && onShowTranscript && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowTranscript();
            }}
            className="shrink-0 p-1.5 rounded-lg active:scale-95 transition-transform ml-1"
            style={{
              border: `1px solid ${accentColor}40`,
              background: `${accentColor}1F`,
              color: accentColor
            }}
            title="Leggi la trascrizione"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // ─── FULL PLAYER ───
  return (
    <div 
      className="flex flex-col w-full"
      onClick={(e) => e.stopPropagation()}
      style={{
        borderRadius: '18px',
        padding: '15px 16px',
        background: 'rgba(255,255,255,0.045)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.07) inset',
        gap: 10,
      }}
    >
      {audioEl}

      <div className="flex items-center" style={{ gap: '13px' }}>
        {/* Play button */}
        <button
          onClick={togglePlayback}
          className="shrink-0 flex items-center justify-center active:scale-90 transition-transform"
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'rgba(10,14,22,0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          {isPlaying
            ? <Pause className="w-[18px] h-[18px] fill-white text-white" />
            : <Play className="w-[18px] h-[18px] fill-white text-white ml-0.5" />
          }
        </button>

        {/* Waveform */}
        <div
          className="flex-1 flex items-center cursor-pointer"
          style={{ height: 38, gap: '2px' }}
          onClick={handleWaveformClick}
        >
          {waveform.map((amp, i) => {
            const played = (i / waveform.length) <= progress;
            return (
              <div
                key={i}
                style={{
                  flex: 1, borderRadius: 2, minHeight: '15%',
                  height: `${Math.max(15, amp * 100)}%`,
                  backgroundColor: played ? accentColor : 'rgba(255,255,255,0.18)',
                  transition: 'background-color 100ms',
                }}
              />
            );
          })}
        </div>

        {/* Remaining time */}
        <span
          className="shrink-0 text-right"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10.5px',
            color: 'rgba(255,255,255,0.5)',
            minWidth: '38px',
          }}
        >
          {formatTime(remaining)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          onClick={changeSpeed}
          className="font-bold transition-colors active:scale-95"
          style={{
            padding: '5px 12px', borderRadius: 12, fontSize: 12,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(241,245,249,0.8)',
            backdropFilter: 'blur(4px)',
            letterSpacing: '0.3px',
            fontWeight: 600,
          }}
        >
          {playbackRate}x
        </button>

        {!hideTranscriptButton && (
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            disabled={transcriptStatus === 'failed'}
            className="flex items-center gap-1.5 transition-colors active:scale-95"
            style={{
              padding: '5px 14px', borderRadius: 12, fontSize: 13,
              background: showTranscript ? `${accentColor}1F` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showTranscript ? `${accentColor}40` : 'rgba(255,255,255,0.08)'}`,
              color: showTranscript ? accentColor : 'rgba(241,245,249,0.8)',
              backdropFilter: 'blur(4px)',
              letterSpacing: '0.2px',
              fontWeight: 600,
              fontFamily: 'Inter, sans-serif'
            }}
          >
            {isTranscriptLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Trascrizione...</span>
              </>
            ) : transcriptStatus === 'failed' ? (
              <span style={{ opacity: 0.5 }}>Trascrizione non disp.</span>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                Leggi la trascrizione
              </>
            )}
          </button>
        )}
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
