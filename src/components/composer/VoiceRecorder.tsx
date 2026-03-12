import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number, waveform: number[]) => void;
  onCancel: () => void;
  maxDurationSeconds?: number;
  accentColor?: string;
  thesisReminder?: string;
  headerLabel?: string;
}

// ─── Animated Waveform Ring (Canvas) ───
const WaveformRing = ({ active, size = 180, color = '#0A7AFF' }: { active: boolean; size?: number; color?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;
      const bars = 64, baseRadius = size * 0.32;

      // Glow when recording
      if (active) {
        const grad = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, baseRadius);
        grad.addColorStop(0, color + '15');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const barHeight = active
          ? 8 + Math.random() * 25 + Math.sin(Date.now() / 200 + i * 0.3) * 12
          : 4 + Math.sin(i * 0.5) * 2;

        const x1 = cx + Math.cos(angle) * baseRadius;
        const y1 = cy + Math.sin(angle) * baseRadius;
        const x2 = cx + Math.cos(angle) * (baseRadius + barHeight);
        const y2 = cy + Math.sin(angle) * (baseRadius + barHeight);

        const alpha = active ? 0.6 + Math.random() * 0.4 : 0.15;
        // Convert alpha to hex
        const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, '0');

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color + alphaHex;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [active, size, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="block"
    />
  );
};

// ─── Waveform Bar (for preview) ───
const WaveformBar = ({ bars = 45, progress = 0, color = '#0A7AFF', height = 32 }: {
  bars?: number; progress?: number; color?: string; height?: number;
}) => {
  const shapesRef = useRef<number[]>([]);

  if (!shapesRef.current.length) {
    shapesRef.current = Array.from({ length: bars }, (_, i) => {
      const center = bars / 2;
      const dist = Math.abs(i - center) / center;
      return 0.15 + (1 - dist) * 0.5 + Math.random() * 0.35;
    });
  }

  return (
    <div className="flex items-center gap-[1.5px] flex-1" style={{ height }}>
      {shapesRef.current.map((h, i) => (
        <div
          key={i}
          className="rounded-sm flex-1"
          style={{
            width: 2.5,
            minHeight: 3,
            height: `${Math.max(8, h * 100)}%`,
            background: i / bars < progress ? color : 'rgba(255,255,255,0.12)',
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
};

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onCancel,
  maxDurationSeconds = 180,
  accentColor = '#0A7AFF',
  thesisReminder,
  headerLabel = '🎙 Pensiero vocale',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const historyWaveformRef = useRef<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingProcess();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopRecordingProcess = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current?.state === 'running') {
      audioContextRef.current.close().catch(console.error);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawWaveform = () => {
        if (!analyserRef.current) return;
        animationFrameRef.current = requestAnimationFrame(drawWaveform);
        analyserRef.current.getByteTimeDomainData(dataArray);

        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i] / 128.0) - 1;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        const cappedRms = Math.min(Math.max(rms * 5, 0.05), 1.0);
        historyWaveformRef.current.push(cappedRms);
      };

      animationFrameRef.current = requestAnimationFrame(drawWaveform);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''; // Browser default

      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const actualMimeType = audioChunksRef.current.length > 0 && audioChunksRef.current[0].type
          ? audioChunksRef.current[0].type
          : mimeType;
        const blob = new Blob(audioChunksRef.current, { type: actualMimeType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      historyWaveformRef.current = [];

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDurationSeconds - 1) {
            stopRecording();
            return maxDurationSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = useCallback(() => {
    stopRecordingProcess();
    setIsRecording(false);
  }, []);

  const handleReset = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setPlaybackProgress(0);
    setIsPlaying(false);
    historyWaveformRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleConfirm = () => {
    if (!audioBlob) return;
    const full = historyWaveformRef.current;
    const targetLength = 50;
    let finalWaveform: number[] = [];

    if (full.length === 0) {
      finalWaveform = Array(targetLength).fill(0.1);
    } else if (full.length <= targetLength) {
      finalWaveform = [...full];
      while (finalWaveform.length < targetLength) finalWaveform.push(0.05);
    } else {
      const step = full.length / targetLength;
      for (let i = 0; i < targetLength; i++) {
        const start = Math.floor(i * step);
        const end = Math.floor((i + 1) * step);
        const slice = full.slice(start, end);
        finalWaveform.push(slice.length > 0 ? Math.max(...slice) : 0.05);
      }
    }

    onRecordingComplete(audioBlob, recordingTime, finalWaveform);
  };

  const togglePlayback = () => {
    if (!audioBlob) return;

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      if (audio.duration) setPlaybackProgress(audio.currentTime / audio.duration);
    };
    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackProgress(0);
    };

    audio.play().catch(err => {
      console.error("VoiceRecorder play error:", err);
      import("sonner").then(m => m.toast.error("Impossibile riprodurre l'audio locale: " + err.message));
      setIsPlaying(false);
    });
    setIsPlaying(true);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const maxMins = fmt(maxDurationSeconds);
  const progressPct = maxDurationSeconds > 0 ? (recordingTime / maxDurationSeconds) * 100 : 0;

  // Preview mode (after recording)
  if (audioBlob) {
    return (
      <div className="flex flex-col items-center w-full px-4 py-6 gap-5 animate-in fade-in">
        {/* Thesis reminder */}
        {thesisReminder && (
          <div
            className="w-full rounded-2xl px-4 py-3 text-sm italic"
            style={{
              background: 'linear-gradient(145deg, rgba(228,30,82,0.05), transparent)',
              border: '1px solid rgba(228,30,82,0.1)',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            "{thesisReminder}"
          </div>
        )}

        {/* Player */}
        <div
          className="w-full rounded-2xl px-4 py-4 flex items-center gap-3"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <button
            onClick={togglePlayback}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: accentColor + '22', color: accentColor }}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.5v11l9-5.5L4 2.5z" />
              </svg>
            )}
          </button>

          <WaveformBar bars={45} progress={playbackProgress} color={accentColor} height={32} />

          <span className="text-xs text-muted-foreground tabular-nums ml-2 flex-shrink-0">
            {fmt(recordingTime)}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={handleReset}
            className="flex-1 py-3.5 rounded-[14px] text-[13px] font-semibold"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.07)',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            Rifai
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3.5 rounded-[14px] text-[14px] font-bold text-white"
            style={{
              background: thesisReminder
                ? 'linear-gradient(135deg, #E41E52, #0A7AFF)'
                : accentColor,
            }}
          >
            {thesisReminder ? '⚡ Lancia Challenge' : '🎙 Pubblica'}
          </button>
        </div>
      </div>
    );
  }

  // Recording / idle mode
  return (
    <div className="flex flex-col items-center w-full px-4 py-6 gap-4 animate-in fade-in">
      {/* Thesis reminder */}
      {thesisReminder && (
        <div
          className="w-full rounded-2xl px-4 py-3 text-sm italic max-w-[280px] text-center"
          style={{
            background: 'linear-gradient(145deg, rgba(228,30,82,0.05), transparent)',
            border: '1px solid rgba(228,30,82,0.1)',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          "{thesisReminder}"
        </div>
      )}

      {/* Waveform Ring + REC button */}
      <div className="relative" style={{ width: 180, height: 180 }}>
        <WaveformRing active={isRecording} size={180} color={accentColor} />

        {/* Central button */}
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300"
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: isRecording
              ? `radial-gradient(circle at 40% 35%, #E41E52, #E41E52cc)`
              : `radial-gradient(circle at 40% 35%, ${accentColor}, ${accentColor}cc)`,
            boxShadow: `0 0 30px ${isRecording ? '#E41E52' : accentColor}33`,
            border: 'none',
          }}
        >
          {isRecording ? (
            // Stop icon
            <div className="w-6 h-6 bg-white rounded-[5px]" />
          ) : (
            // Play/Record icon
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </button>
      </div>

      {/* Timer */}
      <div className="flex items-baseline gap-1">
        <span
          className="text-[32px] font-light tracking-[2px] tabular-nums"
          style={{ color: isRecording ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}
        >
          {fmt(recordingTime)}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          / {maxMins}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-[60%] h-[3px] rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-sm"
          style={{
            width: `${progressPct}%`,
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}44`,
            transition: 'width 1s linear',
          }}
        />
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground">
        {isRecording ? 'Tocca per fermare' : 'Tocca per registrare'}
      </p>
    </div>
  );
};
