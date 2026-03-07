import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Zap, Clock, ThumbsUp, ThumbsDown, Brain, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { VoicePlayer } from "../media/VoicePlayer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from '@/contexts/AuthContext';

interface Challenger {
    id: string;
    user_id: string;
    stance: 'for' | 'against';
    argument_votes: number;
    gate_passed?: boolean;
    voice_post_id: string;
    user: {
        username: string;
        full_name: string | null;
        avatar_url: string | null;
    };
    voice_post: {
        audio_url: string;
        duration_seconds: number;
        waveform_data: number[] | null;
        transcript: string | null;
        transcript_status: string | null;
    };
}

interface ChallengeCardProps {
    challenge: {
        id: string;
        thesis: string;
        status: 'active' | 'expired' | 'closed';
        expires_at: string;
        votes_for: number;
        votes_against: number;
        author: {
            id: string;
            username: string;
            full_name: string | null;
            avatar_url: string | null;
        };
        voicePost: {
            audio_url: string;
            duration_seconds: number;
            waveform_data: number[] | null;
            transcript: string | null;
            transcript_status: string | null;
        } | null;
        responses: Challenger[];
        hasVotedObj?: { stance: 'for' | 'against' | 'challenge_response', user_id: string } | null;
    };
    onRespond?: (challengeId: string) => void;
    onPostAction?: () => void;
}

// Palette constants
const COLOR_AGAINST = '#FFD464';
const COLOR_FOR = '#0A7AFF';
const COLOR_CHALLENGE = '#E41E52';
const COLOR_URGENCY = '#FF8A3D';

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onRespond, onPostAction }) => {
    const { user } = useAuth();
    const [hasVoted, setHasVoted] = useState(!!challenge.hasVotedObj);
    const [votedResponseId, setVotedResponseId] = useState<string | null>(null);
    const [localVotesFor, setLocalVotesFor] = useState(challenge.votes_for || 0);
    const [localVotesAgainst, setLocalVotesAgainst] = useState(challenge.votes_against || 0);
    const [showChallengers, setShowChallengers] = useState(false);
    const [countdown, setCountdown] = useState('');

    const totalVotes = localVotesFor + localVotesAgainst;
    const percentageFor = totalVotes === 0 ? 50 : Math.round((localVotesFor / totalVotes) * 100);
    const percentageAgainst = totalVotes === 0 ? 50 : Math.round((localVotesAgainst / totalVotes) * 100);
    const isExpired = new Date(challenge.expires_at) < new Date() || challenge.status !== 'active';
    const sortedResponses = [...(challenge.responses || [])].sort((a, b) => (b.argument_votes || 0) - (a.argument_votes || 0));

    // Countdown timer
    const msRemaining = new Date(challenge.expires_at).getTime() - Date.now();
    const isUrgent = !isExpired && msRemaining < 2 * 60 * 60 * 1000; // < 2h

    useEffect(() => {
        if (isExpired) { setCountdown('Chiusa'); return; }
        const update = () => {
            const ms = new Date(challenge.expires_at).getTime() - Date.now();
            if (ms <= 0) { setCountdown('Chiusa'); return; }
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            setCountdown(h > 0 ? `${h}h ${m}m` : `${m}m`);
        };
        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, [challenge.expires_at, isExpired]);

    const handleVote = async (stance: 'for' | 'against') => {
        if (!user || hasVoted || isExpired) return;
        setHasVoted(true);
        if (stance === 'for') setLocalVotesFor(p => p + 1);
        else setLocalVotesAgainst(p => p + 1);
        try {
            const { error } = await supabase.from('challenge_votes').insert({
                challenge_id: challenge.id, stance, user_id: user.id
            } as any);
            if (error) throw error;
            toast.success('Voto registrato!');
            onPostAction?.();
        } catch {
            toast.error('Errore durante il voto');
            setHasVoted(false);
            if (stance === 'for') setLocalVotesFor(p => p - 1);
            else setLocalVotesAgainst(p => p - 1);
        }
    };

    const handleArgVote = async (responseId: string) => {
        if (!user || hasVoted || isExpired) return;
        setHasVoted(true);
        setVotedResponseId(responseId);
        try {
            const { error } = await supabase.from('challenge_votes').insert({
                challenge_response_id: responseId, challenge_id: challenge.id, user_id: user.id
            } as any);
            if (error) throw error;
            toast.success('Miglior argomento votato!');
            onPostAction?.();
        } catch {
            toast.error('Errore durante il voto');
            setHasVoted(false);
            setVotedResponseId(null);
        }
    };

    return (
        <div
            className="overflow-hidden rounded-2xl flex flex-col"
            style={{
                background: `linear-gradient(160deg, rgba(255,212,100,0.06) 0%, transparent 40%, rgba(10,122,255,0.04) 100%)`,
                border: `1px solid rgba(255,212,100,0.2)`,
            }}
        >
            {/* Header Badge */}
            <div className="px-4 pt-4 pb-2 flex justify-between items-center">
                <span className="inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.5px]"
                    style={{ background: `rgba(228,30,82,0.15)`, color: COLOR_CHALLENGE }}>
                    <Zap className="h-3.5 w-3.5 fill-current" />
                    Challenge
                </span>
                <div className="text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                        color: isExpired ? 'rgba(241,245,249,0.4)' : isUrgent ? COLOR_URGENCY : COLOR_CHALLENGE,
                        background: isExpired ? 'rgba(255,255,255,0.05)' : isUrgent ? 'rgba(255,138,61,0.08)' : `rgba(228,30,82,0.05)`,
                    }}>
                    <Clock className="h-3 w-3" />
                    {countdown}
                </div>
            </div>

            {/* Author */}
            <div className="px-4 pb-2 flex items-center gap-2.5">
                <Avatar className="w-8 h-8 border border-border/30">
                    <AvatarImage src={challenge.author?.avatar_url || ''} />
                    <AvatarFallback className="text-xs">{challenge.author?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground">
                    {challenge.author?.full_name || `@${challenge.author?.username}`}
                    <span className="font-normal ml-1.5" style={{ color: 'rgba(241,245,249,0.4)' }}>sostiene che:</span>
                </span>
            </div>

            {/* ─── Thesis Block ─── */}
            <div className="px-4 pb-3">
                <div className="relative" style={{
                    background: `linear-gradient(145deg, rgba(255,212,100,0.06), rgba(255,255,255,0.02), rgba(10,122,255,0.04))`,
                    border: `1px solid rgba(255,212,100,0.15)`,
                    borderRadius: 18,
                    padding: '18px 20px',
                }}>
                    {/* Decorative quote */}
                    <span className="absolute select-none pointer-events-none" style={{
                        top: 10, left: 14, fontSize: 48, fontFamily: 'Georgia, serif',
                        color: `rgba(255,212,100,0.1)`, lineHeight: 1,
                    }}>"</span>

                    <h3 className="relative z-10" style={{
                        fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: 'white',
                        paddingLeft: 4,
                    }}>
                        {challenge.thesis}
                    </h3>

                    {/* Player inside thesis block */}
                    {challenge.voicePost && (
                    <div className="mt-3">
                        <VoicePlayer
                            audioUrl={challenge.voicePost.audio_url}
                            durationSeconds={challenge.voicePost.duration_seconds}
                            waveformData={challenge.voicePost.waveform_data}
                            transcript={challenge.voicePost.transcript}
                            transcriptStatus={challenge.voicePost.transcript_status as any}
                            accentColor={COLOR_CHALLENGE}
                        />
                    </div>
                    )}
                </div>
            </div>

            {/* ─── Polarization Bar ─── */}
            <div className="px-4 pb-3">
            <div className="flex items-end justify-between mb-1.5">
                    <div className="flex flex-col">
                        <span style={{ fontSize: 14, fontWeight: 800, color: COLOR_FOR }}>{percentageFor}%</span>
                        <span style={{ fontSize: 11, color: 'rgba(241,245,249,0.3)' }}>a favore</span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span style={{ fontSize: 14, fontWeight: 800, color: COLOR_AGAINST }}>{percentageAgainst}%</span>
                        <span style={{ fontSize: 11, color: 'rgba(241,245,249,0.3)' }}>contro</span>
                    </div>
                </div>
                <div className="flex overflow-hidden" style={{ height: 6, borderRadius: 3 }}>
                    <div
                        className="transition-all duration-500"
                        style={{
                            width: `${percentageAgainst}%`,
                            background: `linear-gradient(90deg, ${COLOR_AGAINST}, ${COLOR_AGAINST}CC)`,
                            boxShadow: `0 0 8px rgba(255,212,100,0.2)`,
                        }}
                    />
                    <div
                        className="transition-all duration-500"
                        style={{
                            width: `${percentageFor}%`,
                            background: `linear-gradient(90deg, ${COLOR_FOR}CC, ${COLOR_FOR})`,
                            boxShadow: `0 0 8px rgba(10,122,255,0.2)`,
                        }}
                    />
                </div>

                {/* Vote Buttons */}
                {!isExpired && (
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => handleVote('for')}
                            className={cn("flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]",
                                hasVoted && "opacity-40 pointer-events-none")}
                            style={{ border: `1px solid rgba(10,122,255,0.2)`, color: COLOR_FOR, background: `rgba(10,122,255,0.06)` }}
                        >
                            <ThumbsUp className="h-3.5 w-3.5" /> D'accordo
                        </button>
                        <button
                            onClick={() => handleVote('against')}
                            className={cn("flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]",
                                hasVoted && "opacity-40 pointer-events-none")}
                            style={{ border: `1px solid rgba(255,212,100,0.2)`, color: COLOR_AGAINST, background: `rgba(255,212,100,0.06)` }}
                        >
                            <ThumbsDown className="h-3.5 w-3.5" /> Non concordo
                        </button>
                    </div>
                )}
            </div>

            {/* ─── Challengers Section ─── */}
            {sortedResponses.length > 0 && (
                <div className="mx-4 mb-3" style={{
                    background: 'rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16,
                    overflow: 'hidden',
                }}>
                    <button
                        className="w-full px-4 py-3 flex items-center justify-between"
                        onClick={() => setShowChallengers(!showChallengers)}
                    >
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(241,245,249,0.6)' }}>
                            {sortedResponses.length} challenger · per qualità argomento
                        </span>
                        {showChallengers
                            ? <ChevronUp className="h-4 w-4" style={{ color: 'rgba(241,245,249,0.4)' }} />
                            : <ChevronDown className="h-4 w-4" style={{ color: 'rgba(241,245,249,0.4)' }} />
                        }
                    </button>

                    {showChallengers && (
                        <div className="px-3 pb-3 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                            {sortedResponses.map((resp, idx) => {
                                const stanceColor = resp.stance === 'for' ? COLOR_FOR : COLOR_AGAINST;
                                const isVotedResp = votedResponseId === resp.id;
                                const isOtherAfterVote = votedResponseId && votedResponseId !== resp.id;

                                return (
                                    <div key={resp.id} className={cn("flex flex-col gap-2", isOtherAfterVote && "opacity-40 pointer-events-none")}>
                                        {/* Header row */}
                                        <div className="flex items-center gap-2">
                                            {/* Rank */}
                                            <span className="flex items-center justify-center shrink-0" style={{
                                                width: 22, height: 22, borderRadius: 7,
                                                fontSize: 11, fontWeight: 800,
                                                ...(idx === 0
                                                    ? { background: 'rgba(255,212,100,0.13)', color: COLOR_AGAINST, border: `1px solid rgba(255,212,100,0.2)` }
                                                    : { background: 'rgba(255,255,255,0.05)', color: 'rgba(241,245,249,0.4)', border: '1px solid rgba(255,255,255,0.06)' }
                                                ),
                                            }}>
                                                {idx + 1}
                                            </span>

                                            <Avatar className="w-[30px] h-[30px]">
                                                <AvatarImage src={resp.user?.avatar_url || ''} />
                                                <AvatarFallback className="text-[10px]">{resp.user?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium truncate text-foreground">{resp.user?.full_name || `@${resp.user?.username}`}</span>

                                            {/* Stance badge */}
                                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest" style={{
                                                background: resp.stance === 'for' ? 'rgba(10,122,255,0.1)' : 'rgba(255,212,100,0.1)',
                                                border: `1px solid ${resp.stance === 'for' ? 'rgba(10,122,255,0.15)' : 'rgba(255,212,100,0.15)'}`,
                                                color: stanceColor,
                                            }}>
                                                {resp.stance === 'for' ? 'A favore' : 'Contro'}
                                            </span>

                                            {/* Gate badge */}
                                            {resp.gate_passed && (
                                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                                                    style={{ background: 'rgba(10,122,255,0.1)', color: COLOR_FOR }}>
                                                    <ShieldCheck className="h-2.5 w-2.5" /> Gate
                                                </span>
                                            )}
                                        </div>

                                        {/* Compact player */}
                                        <div style={{ marginLeft: 32 }}>
                                            <VoicePlayer
                                                audioUrl={resp.voice_post?.audio_url}
                                                durationSeconds={resp.voice_post?.duration_seconds}
                                                waveformData={resp.voice_post?.waveform_data}
                                                transcript={resp.voice_post?.transcript}
                                                transcriptStatus={resp.voice_post?.transcript_status as any}
                                                compact
                                                accentColor={stanceColor}
                                            />
                                        </div>

                                        {/* Vote button */}
                                        {!isExpired && (
                                            <div style={{ marginLeft: 32 }} className="flex items-center justify-between">
                                                <span style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)' }}>{resp.argument_votes || 0} voti</span>
                                                <button
                                                    onClick={() => handleArgVote(resp.id)}
                                                    className={cn("flex items-center gap-1.5 font-medium transition-all active:scale-[0.97]",
                                                        hasVoted && !isVotedResp && "opacity-40 pointer-events-none")}
                                                    style={{
                                                        padding: '5px 12px', borderRadius: 8, fontSize: 11.5,
                                                        ...(isVotedResp
                                                            ? { background: 'rgba(10,122,255,0.12)', border: '1px solid rgba(10,122,255,0.3)', color: COLOR_FOR }
                                                            : { border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(241,245,249,0.6)' }
                                                        ),
                                                    }}
                                                >
                                                    <Brain className="h-3.5 w-3.5" />
                                                    Miglior argomento
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ─── CTA "Accetta la sfida" ─── */}
            {!isExpired && onRespond && user?.id !== challenge.author?.id && (
                <div className="px-4 pb-4">
                    <button
                        onClick={() => onRespond(challenge.id)}
                        className="relative w-full overflow-hidden flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                        style={{
                            background: `linear-gradient(135deg, rgba(255,212,100,0.08), rgba(10,122,255,0.12))`,
                            border: `1px solid rgba(255,212,100,0.2)`,
                            borderRadius: 16,
                            padding: '14px 20px',
                        }}
                    >
                        {/* Shimmer overlay */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
                                animation: 'shimmer 3s infinite',
                            }}
                        />
                        <span className="relative z-10">
                            <span style={{ fontWeight: 700, fontSize: 14, color: 'rgba(241,245,249,0.9)' }}>⚡ Accetta la sfida</span>
                            <span style={{ fontWeight: 400, fontSize: 12, color: 'rgba(241,245,249,0.4)', marginLeft: 6 }}>· metti a fuoco prima</span>
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};
