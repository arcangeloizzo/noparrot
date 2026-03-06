import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Zap, Clock, ThumbsUp, ThumbsDown, Trophy, Mic, ChevronDown, ChevronUp, Brain, ShieldCheck } from "lucide-react";
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
        };
        responses: Challenger[];
        hasVotedObj?: { stance: 'for' | 'against' | 'challenge_response', user_id: string } | null;
    };
    onRespond?: (challengeId: string) => void;
    onPostAction?: () => void;
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, onRespond, onPostAction }) => {
    const { user } = useAuth();
    const [hasVoted, setHasVoted] = useState(!!challenge.hasVotedObj);
    const [localVotesFor, setLocalVotesFor] = useState(challenge.votes_for || 0);
    const [localVotesAgainst, setLocalVotesAgainst] = useState(challenge.votes_against || 0);
    const [showChallengers, setShowChallengers] = useState(false);

    const totalVotes = localVotesFor + localVotesAgainst;
    const percentageFor = totalVotes === 0 ? 50 : Math.round((localVotesFor / totalVotes) * 100);
    const percentageAgainst = totalVotes === 0 ? 50 : Math.round((localVotesAgainst / totalVotes) * 100);

    const isExpired = new Date(challenge.expires_at) < new Date() || challenge.status !== 'active';

    const sortedResponses = [...(challenge.responses || [])].sort((a, b) => (b.argument_votes || 0) - (a.argument_votes || 0));

    const handleVote = async (stance: 'for' | 'against') => {
        if (!user || hasVoted || isExpired) return;
        setHasVoted(true);
        if (stance === 'for') setLocalVotesFor(prev => prev + 1);
        else setLocalVotesAgainst(prev => prev + 1);

        try {
            const { error } = await supabase.from('challenge_votes').insert({
                challenge_id: challenge.id,
                stance: stance,
                user_id: user.id
            });
            if (error) throw error;
            toast.success('Voto registrato!');
            if (onPostAction) onPostAction();
        } catch (err) {
            console.error(err);
            toast.error('Errore durante il voto');
            setHasVoted(false);
            if (stance === 'for') setLocalVotesFor(prev => prev - 1);
            else setLocalVotesAgainst(prev => prev - 1);
        }
    };

    const handleArgVote = async (responseId: string) => {
        if (!user || hasVoted || isExpired) return;
        setHasVoted(true);
        try {
            const { error } = await supabase.from('challenge_votes').insert({
                challenge_response_id: responseId,
                user_id: user.id
            });
            if (error) throw error;
            toast.success('Miglior argomento votato!');
            if (onPostAction) onPostAction();
        } catch (err) {
            console.error(err);
            toast.error('Errore durante il voto');
            setHasVoted(false);
        }
    };

    return (
        <div className="overflow-hidden rounded-2xl border border-brand-pink/20 bg-card flex flex-col">
            {/* Header Badge */}
            <div className="px-4 pt-4 pb-2 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-pink/10 text-brand-pink text-[11px] font-bold uppercase tracking-widest">
                        <Zap className="h-3.5 w-3.5 fill-current" />
                        Challenge
                    </span>
                </div>
                <div className={cn(
                    "text-[11px] font-medium flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    isExpired
                        ? "text-muted-foreground bg-secondary/50"
                        : "text-brand-pink bg-brand-pink/5"
                )}>
                    <Clock className="h-3 w-3" />
                    {isExpired ? 'Chiusa' : formatDistanceToNow(new Date(challenge.expires_at), { locale: it, addSuffix: false })}
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
                    <span className="text-muted-foreground font-normal ml-1.5">sostiene che:</span>
                </span>
            </div>

            {/* Thesis — Hero */}
            <div className="px-5 py-4">
                <h3 className="text-lg font-bold leading-snug text-foreground tracking-tight">
                    "{challenge.thesis}"
                </h3>
            </div>

            {/* Voice Player */}
            <div className="px-4 pb-4">
                <VoicePlayer
                    audioUrl={challenge.voicePost.audio_url}
                    durationSeconds={challenge.voicePost.duration_seconds}
                    waveformData={challenge.voicePost.waveform_data}
                    transcript={challenge.voicePost.transcript}
                    transcriptStatus={challenge.voicePost.transcript_status as any}
                />
            </div>

            {/* Polarization Bar */}
            <div className="px-4 pb-3">
                <div className="flex justify-between text-[11px] font-bold mb-1.5 px-0.5">
                    <span className="text-emerald-500">{percentageFor}% A favore</span>
                    <span className="text-brand-pink">{percentageAgainst}% Contro</span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
                    <div
                        className="h-full bg-emerald-500 rounded-l-full transition-all duration-500"
                        style={{ width: `${percentageFor}%` }}
                    />
                    <div
                        className="h-full bg-brand-pink rounded-r-full transition-all duration-500"
                        style={{ width: `${percentageAgainst}%` }}
                    />
                </div>

                {/* Vote Buttons */}
                {!isExpired && (
                    <div className="flex gap-2 mt-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "flex-1 h-9 border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-500 text-xs font-semibold",
                                hasVoted && "opacity-40 pointer-events-none"
                            )}
                            onClick={() => handleVote('for')}
                        >
                            <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                            D'accordo
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "flex-1 h-9 border-brand-pink/20 hover:bg-brand-pink/10 hover:text-brand-pink text-xs font-semibold",
                                hasVoted && "opacity-40 pointer-events-none"
                            )}
                            onClick={() => handleVote('against')}
                        >
                            <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                            Non concordo
                        </Button>
                    </div>
                )}
            </div>

            {/* Challengers Section */}
            {sortedResponses.length > 0 && (
                <div className="border-t border-border/50">
                    {/* Toggle */}
                    <button
                        className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-secondary/30 transition-colors"
                        onClick={() => setShowChallengers(!showChallengers)}
                    >
                        <span className="text-muted-foreground font-medium">
                            {sortedResponses.length} challenger · per qualità argomento
                        </span>
                        {showChallengers
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        }
                    </button>

                    {/* Collapsible List */}
                    {showChallengers && (
                        <div className="px-4 pb-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
                            {sortedResponses.map((resp, idx) => {
                                const isTopArg = idx === 0 && resp.argument_votes > 0;
                                return (
                                    <div
                                        key={resp.id}
                                        className={cn(
                                            "rounded-xl border p-3 flex flex-col gap-2.5 relative overflow-hidden",
                                            isTopArg ? "border-brand-yellow/30 bg-brand-yellow/[0.03]" : "border-border/50 bg-card"
                                        )}
                                    >
                                        {/* Stance accent bar */}
                                        <div className={cn(
                                            "absolute top-0 left-0 w-1 h-full rounded-l-xl",
                                            resp.stance === 'for' ? 'bg-emerald-500' : 'bg-brand-pink'
                                        )} />

                                        {/* Header */}
                                        <div className="flex items-center gap-2 pl-2">
                                            <span className="text-xs font-bold text-muted-foreground w-5">#{idx + 1}</span>
                                            <Avatar className="w-6 h-6">
                                                <AvatarImage src={resp.user?.avatar_url || ''} />
                                                <AvatarFallback className="text-[10px]">{resp.user?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium truncate">{resp.user?.full_name || `@${resp.user?.username}`}</span>

                                            {/* Stance Badge */}
                                            <span className={cn(
                                                "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                                                resp.stance === 'for' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-brand-pink/10 text-brand-pink'
                                            )}>
                                                {resp.stance === 'for' ? 'A favore' : 'Contro'}
                                            </span>

                                            {/* Gate badge */}
                                            {resp.gate_passed && (
                                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-0.5">
                                                    <ShieldCheck className="h-2.5 w-2.5" /> Gate
                                                </span>
                                            )}

                                            {/* Top Arg Trophy */}
                                            {isTopArg && (
                                                <div className="ml-auto flex items-center gap-1 text-brand-yellow text-[10px] font-bold">
                                                    <Trophy className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Compact Player */}
                                        <div className="pl-7">
                                            <VoicePlayer
                                                audioUrl={resp.voice_post?.audio_url}
                                                durationSeconds={resp.voice_post?.duration_seconds}
                                                waveformData={resp.voice_post?.waveform_data}
                                                transcript={resp.voice_post?.transcript}
                                                transcriptStatus={resp.voice_post?.transcript_status as any}
                                                compact
                                            />
                                        </div>

                                        {/* Arg Vote */}
                                        {!isExpired && (
                                            <div className="pl-7 flex items-center justify-between">
                                                <span className="text-[11px] text-muted-foreground">{resp.argument_votes || 0} voti</span>
                                                <button
                                                    className={cn(
                                                        "h-7 px-2.5 text-[11px] rounded-full flex items-center gap-1.5 font-medium transition-colors",
                                                        hasVoted
                                                            ? "opacity-40 pointer-events-none text-muted-foreground"
                                                            : "text-foreground hover:bg-secondary/60"
                                                    )}
                                                    onClick={() => handleArgVote(resp.id)}
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

            {/* CTA */}
            {!isExpired && onRespond && user?.id !== challenge.author?.id && (
                <div className="p-4 border-t border-border/50">
                    <button
                        onClick={() => onRespond(challenge.id)}
                        className="w-full h-11 rounded-xl bg-brand-pink/10 border border-brand-pink/20 text-brand-pink font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-pink/15 active:scale-[0.98] transition-all"
                    >
                        <Zap className="h-4 w-4 fill-current" />
                        Accetta la sfida · metti a fuoco prima
                    </button>
                </div>
            )}
        </div>
    );
};
