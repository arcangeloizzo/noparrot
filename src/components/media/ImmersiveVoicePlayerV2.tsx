import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ImmersiveVoicePlayerV2Props {
  audioUrl: string;
  durationSeconds: number;
  transcriptStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null;
  onShowTranscript?: () => void;
}

export const ImmersiveVoicePlayerV2: React.FC<ImmersiveVoicePlayerV2Props> = ({
  audioUrl,
  durationSeconds,
  transcriptStatus,
  onShowTranscript,
}) => {
  const isImmediate = audioUrl.startsWith('http') || audioUrl.startsWith('blob:') || audioUrl.startsWith('data:');
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(isImmediate ? audioUrl : null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
            setResolvedUrl(error ? null : data?.signedUrl || null);
          }
        });
    }
    return () => { cancelled = true; };
  }, [audioUrl, isImmediate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(durationSeconds);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !durationSeconds) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * durationSeconds;
    
    // Fix issue where setting currentTime while ended throws, or use isFinite
    if (isFinite(newTime)) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaybackSpeed(prev => prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1);
  };

  // Safe formatting avoiding NaN
  const safeDuration = durationSeconds || 0;
  
  // Calculate percentage of playback (0 to 1)
  const progressRatio = safeDuration > 0 ? (currentTime / safeDuration) : 0;

  return (
    <div 
      className="mt-auto w-full relative flex flex-col overflow-hidden rounded-[24px] p-6 shrink-0 group"
      style={{
        background: 'linear-gradient(170deg, #061A2E 0%, #0A1929 40%, #060E18 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={resolvedUrl ?? undefined}
        onEnded={handleEnded}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Decorative Radial Background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 60%, rgba(10,122,255,0.05) 0%, transparent 70%)'
        }}
      />
      
      {/* Waveform Wrapper */}
      <div 
        className="relative z-10 flex items-center justify-between h-24 w-full mb-6 cursor-pointer group/waveform"
        onClick={handleSeek}
      >
         {/* Waveform Bars */}
         {[...Array(30)].map((_, i) => {
           // Create a visually pleasing mock waveform
           const fixedRandom = (Math.sin(i * 12.5) + Math.cos(i * 5.1) + 2) / 4; 
           const barRatio = i / 30;
           
           // Determine if this bar is "played"
           const isPlayed = barRatio <= progressRatio;
           
           const animationValue = isPlaying && Math.abs(barRatio - progressRatio) < 0.1
             ? `waveAnim ${0.8 + fixedRandom * 0.5}s ease-in-out infinite alternate`
             : 'none';
             
           return (
              <div 
                key={i}
                className="w-[3px] sm:w-[4px] rounded-full mx-[1px]"
                style={{
                   backgroundColor: isPlayed ? 'rgba(10,122,255,0.9)' : 'rgba(255,255,255,0.2)',
                   height: isPlaying ? `${Math.max(15, fixedRandom * 100)}%` : `${Math.max(15, fixedRandom * 80)}%`,
                   animation: animationValue,
                   animationDelay: `${fixedRandom * -1}s`,
                   boxShadow: isPlayed && isPlaying ? '0 0 8px rgba(10,122,255,0.4)' : 'none',
                   transition: 'height 0.3s ease, background-color 0.2s ease'
                }}
              />
           );
         })}
      </div>
      
      {/* Playback Controls & Info */}
      <div className="relative z-10 w-full flex flex-col">
         <div className="flex items-center justify-between w-full mb-2">
           <div className="flex items-center gap-3">
             {/* Main Play/Pause Button */}
             <button 
               onClick={togglePlayback}
               className="w-[60px] h-[60px] bg-white rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(10,122,255,0.3)] active:scale-95 transition-transform shrink-0"
             >
               {isPlaying ? (
                 <Pause className="w-6 h-6 text-[#0A7AFF] fill-[#0A7AFF]" />
               ) : (
                 <Play className="w-6 h-6 text-[#0A7AFF] fill-[#0A7AFF] ml-1" />
               )}
             </button>

             {/* Playback Speed Button */}
             <button
               onClick={cycleSpeed}
               className="h-8 px-3 rounded-full border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white transition-colors active:scale-95"
               style={{ fontFamily: 'JetBrains Mono', fontSize: '12px', fontWeight: 600 }}
             >
               {playbackSpeed}x
             </button>
           </div>
           
           {/* Time Display */}
           <div className="flex flex-col items-end">
             <span style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', color: '#7A8FA6', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
               {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')} /
             </span>
             <span style={{ fontFamily: 'JetBrains Mono', fontSize: '24px', fontWeight: 700, color: '#0A7AFF', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
               {Math.floor(safeDuration / 60)}:{(Math.floor(safeDuration) % 60).toString().padStart(2, '0')}
             </span>
           </div>
         </div>

         {/* Transcript Button */}
         {transcriptStatus === 'completed' && onShowTranscript && (
           <div className="w-full mt-4 flex justify-center">
             <button 
               onClick={(e) => { e.stopPropagation(); onShowTranscript(); }}
               className="flex items-center justify-center gap-2 py-2.5 px-6 rounded-full border border-[#0A7AFF]/30 bg-[#0A7AFF]/10 hover:bg-[#0A7AFF]/20 transition-all active:scale-[0.98] w-full sm:w-auto"
             >
               <FileText className="w-4 h-4 text-[#0A7AFF]" />
               <span style={{ fontFamily: 'Inter', fontSize: '13px', fontWeight: 600, color: '#0A7AFF' }}>
                 Leggi la trascrizione
               </span>
             </button>
           </div>
         )}
      </div>
    </div>
  );
};
