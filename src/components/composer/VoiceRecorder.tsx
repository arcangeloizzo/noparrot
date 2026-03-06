import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, Square, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number, waveform: number[]) => void;
  onCancel: () => void;
  maxDurationSeconds?: number;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onCancel,
  maxDurationSeconds = 180 // 3 minutes default
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [waveform, setWaveform] = useState<number[]>(Array(50).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const historyWaveformRef = useRef<number[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecordingProcess();
    };
  }, []);

  const stopRecordingProcess = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current?.state === 'running') {
      audioContextRef.current.close().catch(console.error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup Web Audio API for waveform
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let lastUpdateTime = 0;
      const drawWaveform = (timestamp: number) => {
        if (!analyserRef.current) return;
        animationFrameRef.current = requestAnimationFrame(drawWaveform);
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate root mean square (RMS)
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i] / 128.0) - 1;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        const cappedRms = Math.min(Math.max(rms * 5, 0.05), 1.0); // Normalize to 0-1 range approx

        historyWaveformRef.current.push(cappedRms);

        // Update display waveform (last 50 items) throttled to 10fps
        if (!timestamp || timestamp - lastUpdateTime > 100) {
          lastUpdateTime = timestamp || performance.now();
          setWaveform(prev => {
            const next = [...prev, cappedRms];
            if (next.length > 50) return next.slice(next.length - 50);
            return next;
          });
        }
      };

      animationFrameRef.current = requestAnimationFrame(drawWaveform);

      // We prefer webm with opus if available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);

        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
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
      // Fallback/notify user in a real app
    }
  };

  const stopRecording = () => {
    stopRecordingProcess();
    setIsRecording(false);
  };

  const handleReset = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setWaveform(Array(50).fill(0));
    historyWaveformRef.current = [];
  };

  const handleConfirm = () => {
    if (audioBlob) {
      // Create a downsampled representative waveform of 50 samples for DB storage
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
          if (slice.length > 0) {
            const max = Math.max(...slice);
            finalWaveform.push(max);
          } else {
            finalWaveform.push(0.05); // fallback
          }
        }
      }

      onRecordingComplete(audioBlob, recordingTime, finalWaveform);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const audioUrl = useMemo(() => {
    if (audioBlob) {
      return URL.createObjectURL(audioBlob);
    }
    return undefined;
  }, [audioBlob]);

  // Draw waveform bars
  const renderWaveform = (isActive: boolean) => (
    <div className="flex items-center gap-0.5 h-12 w-full max-w-[200px] overflow-hidden justify-center px-4">
      {waveform.map((amp, i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full transition-all duration-75",
            isActive ? "bg-primary" : "bg-primary/30"
          )}
          style={{
            height: `${Math.max(10, amp * 100)}%`,
            opacity: amp > 0.05 ? 1 : 0.3
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-secondary/50 rounded-xl border border-border/50 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex w-full items-center justify-between">
        <h3 className="font-semibold text-sm">Registazione Vocale</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        {renderWaveform(isRecording)}

        <div className="text-secondary-foreground/80 font-mono text-sm">
          {formatTime(recordingTime)} / {formatTime(maxDurationSeconds)}
        </div>

        {!audioBlob ? (
          <div className="flex gap-4 items-center mt-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                size="lg"
                className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600 shadow-lg"
              >
                <div className="w-4 h-4 rounded-full bg-white" />
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                size="lg"
                className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600 shadow-lg animate-pulse"
              >
                <Square className="w-5 h-5 fill-white text-white" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col w-full gap-3 mt-4">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                Rifai
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                Usa Registrazione
              </Button>
            </div>
            {/* Native player for preview */}
            <audio
              src={audioUrl}
              controls
              className="w-full mt-2 h-10"
              controlsList="nodownload nofullscreen"
            />
          </div>
        )}
      </div>
    </div>
  );
};
