import { cn } from "@/lib/utils";
import { Zap } from "lucide-react";
import { MediaGallery } from "@/components/media/MediaGallery";
import { MentionText } from "../MentionText";
import { VoicePlayer } from "@/components/media/VoicePlayer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateQA } from "@/lib/ai-helpers";
import { getWordCount, getQuestionCountWithoutSource } from "@/lib/gate-utils";
import { toast } from "sonner";
import type { Post } from "@/hooks/usePosts";

interface ChallengeBodyProps {
  post: Post;
  activeVoicePost: any;
  challengeCountdown: string;
  isChallengeUrgent: boolean;
  isChallengeExpired: boolean;
  challengeResponses: any[];
  userVote: any;
  voteForResponse: (id: string) => void;
  removeVote: () => void;
  challengeDrawerOpen: boolean;
  setChallengeDrawerOpen: (v: boolean) => void;
  carouselIndex: number;
  setCarouselIndex: (i: number) => void;
  setSelectedMediaIndex: (i: number | null) => void;
  setShowFullText: (v: boolean) => void;
  setShowAnalysisOverlay: (v: boolean) => void;
  setQuizData: (v: any) => void;
  setShowQuiz: (v: boolean) => void;
  setShowChallengeFlow: (v: boolean) => void;
  user: any;
  renderBodyText: (content: string | undefined | null, hasTitle: boolean) => JSX.Element | null;
}

export const ChallengeBody = ({
  post,
  activeVoicePost,
  challengeCountdown,
  isChallengeUrgent,
  isChallengeExpired,
  challengeResponses,
  userVote,
  voteForResponse,
  removeVote,
  challengeDrawerOpen,
  setChallengeDrawerOpen,
  carouselIndex,
  setCarouselIndex,
  setSelectedMediaIndex,
  setShowFullText,
  setShowAnalysisOverlay,
  setQuizData,
  setShowQuiz,
  setShowChallengeFlow,
  user,
  renderBodyText,
}: ChallengeBodyProps) => {
  return (
    <div className="w-full flex flex-col pt-2 pb-6">
        {/* Badge Challenge — first element in the flow */}
        <div className="w-full flex justify-center mb-5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-8 px-4 text-[12px] rounded-full font-bold tracking-wide inline-flex items-center uppercase border shadow-sm backdrop-blur-md"
              style={{ color: '#E41E52', background: 'rgba(228,30,82,0.06)', borderColor: 'rgba(228,30,82,0.2)' }}>
              ⚡ CHALLENGE
            </span>
            {challengeCountdown && (
              <span style={{ 
                color: isChallengeExpired ? 'rgba(241,245,249,0.4)' : isChallengeUrgent ? '#FF8A3D' : 'rgba(241,245,249,0.4)', 
                fontSize: 13,
                fontWeight: isChallengeUrgent ? 700 : 500,
                marginLeft: 4
              }}>
                · {isChallengeExpired ? '⏱ Chiusa' : `⏱ Scade tra ${challengeCountdown}`}
              </span>
            )}
          </div>
        </div>
        {/* Challenge Content Hierarchy - 4 scenarios */}
        {(() => {
          const hasTitle = Boolean(post.challenge?.title);
          const hasBodyText = Boolean(post.challenge?.body_text);

          if (hasTitle) {
            return (
              <div className={cn(
                "flex flex-col mb-4",
                hasBodyText ? "items-start text-left px-2" : "items-center text-center justify-center flex-1 px-4 min-h-0"
              )}>
                <h2 
                  style={{
                    fontFamily: 'Impact, sans-serif',
                    fontSize: 'clamp(30px, 8vw, 42px)',
                    lineHeight: 0.92,
                    letterSpacing: '-0.02em',
                    color: '#FFFFFF',
                    textTransform: 'uppercase'
                  }}
                  className={cn(
                    "drop-shadow-xl w-full",
                    hasBodyText ? "mb-3" : "text-center mb-6"
                  )}
                >
                  {post.challenge?.title}
                </h2>
                {hasBodyText && renderBodyText(post.challenge?.body_text, true)}
              </div>
            );
          }

          // Fallback per i post precedenti (senza title o body_text)
          return (
            <>
              {/* 1. Solo corpo o testo utente */}
              {post.content && post.content !== post.challenge?.thesis && (
                <div className="flex-shrink-0 mb-4 px-1">
                  <div 
                    style={{
                      fontSize: '15px',
                      color: '#E2EAF4',
                      lineHeight: 1.55
                    }}
                    className="whitespace-pre-wrap line-clamp-3"
                  >
                    <MentionText content={post.content} />
                  </div>
                  {post.content.length > 150 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowFullText(true); }}
                      className="text-sm font-semibold text-primary mt-1 hover:underline"
                    >
                      Mostra tutto
                    </button>
                  )}
                </div>
              )}
              
              {/* 1b. Thesis Content fallback */}
              {!post.content && (
                <div 
                  style={{
                    fontSize: '15px',
                    color: '#E2EAF4',
                    lineHeight: 1.55
                  }}
                  className="px-1 mb-4"
                >
                  <MentionText content={post.challenge?.thesis || ''} />
                </div>
              )}
            </>
          );
        })()}

        {/* 2. Media Image (Cropped flexibly taking remaining space) */}
        {post.media && post.media.length > 0 && (
          <div className="flex-1 min-h-0 w-full mb-6 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/50">
            {post.media.length === 1 ? (
              <img
                src={post.media[0].thumbnail_url || post.media[0].url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full object-cover">
                <MediaGallery
                  media={post.media}
                  onClick={(_, index) => setSelectedMediaIndex(index)}
                  initialIndex={carouselIndex}
                  onIndexChange={setCarouselIndex}
                  className="w-full h-full object-cover"
                  fillHeight={true}
                />
              </div>
            )}
          </div>
        )}

        {/* 3. Audio Player */}
        <div className="relative w-full shadow-2xl rounded-2xl flex-shrink-0">
          <VoicePlayer
            audioUrl={activeVoicePost.audio_url}
            durationSeconds={activeVoicePost.duration_seconds}
            waveformData={activeVoicePost.waveform_data}
            transcript={activeVoicePost.transcript}
            transcriptStatus={activeVoicePost.transcript_status as any}
            accentColor="#E41E52"
          />
        </div>
       {/* Polarization bar - V2 CSS */}
       <div className="mt-4 px-1">
         <div className="flex items-end justify-between mb-1.5" style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
           <span style={{ color: '#0A7AFF' }}>
             A FAVORE ({Math.round(((post.challenge!.votes_for || 0) / Math.max(1, (post.challenge!.votes_for || 0) + (post.challenge!.votes_against || 0))) * 100)}%)
           </span>
           <span style={{ color: '#FFD464' }}>
             CONTRO ({Math.round(((post.challenge!.votes_against || 0) / Math.max(1, (post.challenge!.votes_for || 0) + (post.challenge!.votes_against || 0))) * 100)}%)
           </span>
         </div>
         <div className="flex overflow-hidden" style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}>
           <div style={{ width: `${Math.round(((post.challenge!.votes_for || 0) / Math.max(1, (post.challenge!.votes_for || 0) + (post.challenge!.votes_against || 0))) * 100)}%`, background: 'linear-gradient(90deg, #0A7AFF, #3D9AFF)', borderRadius: '4px 0 0 4px' }} />
           <div style={{ width: `${Math.round(((post.challenge!.votes_against || 0) / Math.max(1, (post.challenge!.votes_for || 0) + (post.challenge!.votes_against || 0))) * 100)}%`, background: 'linear-gradient(90deg, #F5C842, #FFD464)', borderRadius: '0 4px 4px 0' }} />
         </div>
       </div>

       {/* Challenge Responses Button + Drawer */}
       {challengeResponses.length > 0 && (
         <div className="mt-5 flex justify-center">
           <button
             onClick={(e) => {
               e.stopPropagation();
               setChallengeDrawerOpen(true);
             }}
             className="flex items-center justify-center gap-1.5 py-1.5 px-4 rounded-full text-sm font-semibold text-slate-300 hover:text-white transition-all hover:bg-white/5"
           >
             <Zap className="w-3.5 h-3.5" style={{ color: '#E41E52' }} />
             Vedi {challengeResponses.length} rispost{challengeResponses.length === 1 ? 'a' : 'e'}
           </button>

           <Drawer open={challengeDrawerOpen} onOpenChange={setChallengeDrawerOpen}>
             <DrawerContent className="max-h-[85vh]">
               <DrawerHeader>
                 <DrawerTitle className="flex items-center justify-center gap-2">
                   <Zap className="w-5 h-5" style={{ color: '#E41E52' }} />
                   {challengeResponses.length} rispost{challengeResponses.length === 1 ? 'a' : 'e'} alla challenge
                 </DrawerTitle>
               </DrawerHeader>
               <ScrollArea className="flex-1 overflow-auto px-4 pb-6" style={{ maxHeight: 'calc(85vh - 80px)' }}>
                 <div className="space-y-3">
                   {challengeResponses.map((resp) => (
                     <div
                       key={resp.id}
                       className="rounded-xl p-4"
                       style={{
                         background: 'hsl(var(--muted) / 0.5)',
                         border: '1px solid hsl(var(--border))',
                       }}
                     >
                       <div className="flex items-center gap-2 mb-3">
                         <Avatar className="w-7 h-7">
                           <AvatarImage src={resp.user.avatar_url || undefined} />
                           <AvatarFallback className="text-[10px] bg-muted">
                             {(resp.user.full_name || resp.user.username).charAt(0).toUpperCase()}
                           </AvatarFallback>
                         </Avatar>
                         <span className="text-sm font-semibold text-foreground">
                           {resp.user.full_name || resp.user.username}
                         </span>
                         <span
                           className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ml-auto"
                           style={{
                             background: resp.stance === 'for' ? 'rgba(59,159,255,0.15)' : 'rgba(255,212,100,0.15)',
                             color: resp.stance === 'for' ? '#3B9FFF' : '#FFD464',
                           }}
                         >
                           {resp.stance === 'for' ? 'A favore' : 'Contro'}
                         </span>
                       </div>
                       <VoicePlayer
                         audioUrl={resp.voice_post.audio_url}
                         durationSeconds={resp.voice_post.duration_seconds}
                         waveformData={resp.voice_post.waveform_data}
                         transcript={resp.voice_post.transcript}
                         transcriptStatus={resp.voice_post.transcript_status as any}
                         accentColor={resp.stance === 'for' ? '#3B9FFF' : '#FFD464'}
                       />
                       <div className="flex items-center justify-between mt-3">
                         <span className="text-xs text-muted-foreground">
                           {resp.argument_votes} vot{resp.argument_votes === 1 ? 'o' : 'i'}
                         </span>
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             if (userVote?.challenge_response_id === resp.id) {
                               removeVote();
                             } else if (!userVote) {
                               voteForResponse(resp.id);
                             }
                           }}
                           disabled={!!userVote && userVote.challenge_response_id !== resp.id}
                           className={cn(
                             "text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5",
                             userVote?.challenge_response_id === resp.id
                               ? "bg-primary/20 text-primary hover:bg-destructive/20 hover:text-destructive"
                               : userVote
                                 ? "bg-muted text-muted-foreground cursor-not-allowed"
                                 : "bg-muted hover:bg-accent text-foreground"
                           )}
                         >
                           {userVote?.challenge_response_id === resp.id ? (
                             <span className="flex items-center gap-1">
                               <span className="group-hover:hidden">✓ Votato</span>
                               <span className="hidden group-hover:inline">✗ Rimuovi voto</span>
                             </span>
                           ) : (
                             '🏆 Miglior argomento'
                           )}
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
               </ScrollArea>
             </DrawerContent>
           </Drawer>
         </div>
        )}
      {(() => {
        const isExpired = post.challenge?.status === 'expired' || post.challenge?.status === 'closed' || new Date(post.challenge?.expires_at || '') < new Date();
        const isAuthor = user?.id === post.author.id;
        const hasResponded = challengeResponses.some(r => r.user_id === user?.id);
        const isDisabled = isExpired || hasResponded;

        return !isAuthor ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isDisabled) return;
              // Trigger challenge respond flow
              const handleRespond = async () => {
                const transcriptText = activeVoicePost?.transcript || post.content;
                const wordCount = getWordCount(transcriptText);
                const questionCount = getQuestionCountWithoutSource(wordCount);
                if (questionCount === 0) {
                  setShowChallengeFlow(true);
                  return;
                }
                setShowAnalysisOverlay(true);
                try {
                  const result = await generateQA({
                    contentId: post.id,
                    title: post.author.full_name || post.author.username,
                    summary: transcriptText,
                    userText: transcriptText || '',
                    questionCount,
                  });
                  setShowAnalysisOverlay(false);
                  if (result.insufficient_context) {
                    toast.info("Trascrizione non sufficiente per il test.");
                    setShowChallengeFlow(true);
                    return;
                  }
                  if (!result || result.error || !result.questions?.length) {
                    toast.error(result?.error || "Errore generico");
                    return;
                  }
                  setQuizData({ qaId: result.qaId, questions: result.questions, sourceUrl: `post://${post.id}`, onChallengeRespond: true });
                  setShowQuiz(true);
                } catch {
                  setShowAnalysisOverlay(false);
                  toast.error("Errore generico");
                }
              };
              handleRespond();
            }}
            disabled={isDisabled}
            className={cn(
              "relative w-full mt-4 py-3.5 rounded-full font-bold text-[15px] tracking-wide overflow-hidden transition-all shadow-lg",
              isDisabled ? "opacity-50 cursor-not-allowed" : "hover:scale-[1.02] active:scale-[0.98]"
            )}
            style={{
              background: isDisabled ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #E41E52, #FF6B35)',
              color: isDisabled ? 'rgba(255,255,255,0.3)' : 'white',
              border: isDisabled ? '1px solid rgba(255,255,255,0.1)' : 'none',
            }}
          >
            {!isDisabled && (
              <span className="absolute inset-0" style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2.5s ease-in-out infinite',
              }} />
            )}
            <span className="relative z-10">
              {hasResponded ? '✓ Hai già risposto' : isExpired ? '⚡ Sfida chiusa' : '⚡ Accetta la sfida'}
            </span>
          </button>
        ) : null;
      })()}
    </div>
  );
};
