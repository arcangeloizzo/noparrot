import { cn } from "@/lib/utils";
import { Zap, ArrowUp } from "lucide-react";
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
import { getAvatarImageUrl, getCardImageUrl } from "@/lib/mediaUtils";
import { useMemo } from "react";

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
  const downscaledMedia = useMemo(() => {
    if (!post.media) return [];
    return post.media.map(item => ({
      ...item,
      url: getCardImageUrl(item.url, 1200, 75),
      thumbnail_url: item.thumbnail_url ? getCardImageUrl(item.thumbnail_url, 1200, 75) : undefined
    }));
  }, [post.media]);
  return (
    <div className="w-full flex flex-col pt-2 pb-6 overflow-hidden" style={{ maxHeight: '60vh' }}>
        {/* Badge Challenge — first element in the flow */}
        <div className="w-full flex justify-center mb-5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="h-8 px-4 text-[12px] rounded-full font-bold tracking-wide inline-flex items-center uppercase border shadow-sm"
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
                    fontFamily: "'Anton', 'Impact', sans-serif",
                    fontSize: 'clamp(30px, 8vw, 42px)',
                    lineHeight: 0.92,
                    letterSpacing: '-0.02em',
                    color: '#FFFFFF',
                    textTransform: 'uppercase'
                  }}
                  className={cn(
                    " w-full",
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
                      className="text-sm font-semibold text-primary mt-1 active:opacity-60 transition-opacity"
                    >
                      Approfondisci
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
          <div className="flex-1 min-h-0 w-full mb-6 rounded-2xl overflow-hidden border border-white/10  bg-black/50">
            {downscaledMedia.length === 1 ? (
              <img
                src={downscaledMedia[0].thumbnail_url || downscaledMedia[0].url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full object-cover">
                <MediaGallery
                  media={downscaledMedia}
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
        <div className="relative w-full  rounded-2xl flex-shrink-0">
          <VoicePlayer
            audioUrl={activeVoicePost.audio_url}
            durationSeconds={activeVoicePost.duration_seconds}
            waveformData={activeVoicePost.waveform_data}
            transcript={activeVoicePost.transcript}
            transcriptStatus={activeVoicePost.transcript_status as any}
            accentColor="#E41E52"
          />
        </div>
       {/* ─── ARENA + META ─── */}
       {(() => {
         const vFor = post.challenge?.votes_for || 0;
         const vAgainst = post.challenge?.votes_against || 0;
         const total = vFor + vAgainst;
         const pctFor = total === 0 ? 50 : Math.round((vFor / total) * 100);
         const pctAgainst = total === 0 ? 50 : 100 - pctFor;
         return (
           <div className="mt-4 px-1">
             {/* Arena */}
             <div style={{ position: 'relative', height: '34px', borderRadius: '12px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.05)', boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset' }}>
               <div style={{
                 width: `${pctFor}%`,
                 background: 'linear-gradient(90deg, rgba(10,122,255,0.85), rgba(10,122,255,0.55))',
                 display: 'flex', alignItems: 'center',
               }}>
                 <span style={{
                   paddingLeft: '11px',
                   fontFamily: "'JetBrains Mono', monospace",
                   fontSize: '11.5px', fontWeight: 600, color: '#FFFFFF',
                 }}>{pctFor}%</span>
               </div>
               <div style={{
                 width: `${pctAgainst}%`, marginLeft: 'auto',
                 background: 'linear-gradient(90deg, rgba(255,212,100,0.5), rgba(255,212,100,0.85))',
                 display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
               }}>
                 <span style={{
                   paddingRight: '11px',
                   fontFamily: "'JetBrains Mono', monospace",
                   fontSize: '11.5px', fontWeight: 600, color: '#1a1608',
                 }}>{pctAgainst}%</span>
               </div>
               {/* VS chip */}
               <span style={{
                 position: 'absolute', left: `${pctFor}%`, top: '50%',
                 transform: 'translate(-50%, -50%)',
                 fontFamily: "'Anton', sans-serif", fontSize: '12px',
                 background: 'rgba(10,14,22,0.85)', padding: '3px 7px',
                 borderRadius: '6px', color: '#FFFFFF', letterSpacing: '0.04em',
               }}>VS</span>
             </div>

             {/* META row */}
             <div className="flex items-center justify-between" style={{ marginTop: '10px' }}>
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   if (challengeResponses.length > 0) setChallengeDrawerOpen(true);
                 }}
                 style={{
                   fontFamily: "'JetBrains Mono', monospace",
                   fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase',
                   color: '#8fb8e8', fontWeight: 600,
                 }}
                 className="active:opacity-60 transition-opacity"
               >
                 {total} VOTI · {challengeResponses.length} RISPOSTE →
               </button>
               <span style={{
                 fontFamily: "'JetBrains Mono', monospace",
                 fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase',
                 color: isChallengeExpired ? 'rgba(255,255,255,0.5)' : '#FFD464', fontWeight: 600,
               }}>
                 {isChallengeExpired ? 'CONCLUSA' : `⏳ SCADE TRA ${challengeCountdown}`}
               </span>
             </div>
           </div>
         );
       })()}

       {/* ─── Drawer risposte (restyled) ─── */}
       {challengeResponses.length > 0 && (
         <Drawer open={challengeDrawerOpen} onOpenChange={setChallengeDrawerOpen}>
           <DrawerContent
             className="max-h-[85vh]"
             style={{
               background: 'rgba(18,26,42,0.92)',
               backdropFilter: 'blur(26px) saturate(150%)',
               WebkitBackdropFilter: 'blur(26px) saturate(150%)',
               boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset, 0 -20px 60px -20px rgba(0,0,0,0.6)',
               borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
               zIndex: 60,
             }}
           >
             <DrawerHeader style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.05)' }}>
               <DrawerTitle
                 className="flex items-center justify-center gap-2"
                 style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 700 }}
               >
                 <span>Dibattito</span>
                 <span style={{
                   fontFamily: "'JetBrains Mono', monospace",
                   fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 600,
                 }}>· {challengeResponses.length} rispost{challengeResponses.length === 1 ? 'a' : 'e'}</span>
               </DrawerTitle>
             </DrawerHeader>
             {/* Mini-arena */}
             {(() => {
               const vFor = post.challenge?.votes_for || 0;
               const vAgainst = post.challenge?.votes_against || 0;
               const total = vFor + vAgainst;
               const pctFor = total === 0 ? 50 : Math.round((vFor / total) * 100);
               const pctAgainst = total === 0 ? 50 : 100 - pctFor;
               return (
                 <div style={{ marginLeft: '16px', marginRight: '16px', marginBottom: '12px' }}>
                   <div style={{ position: 'relative', height: '26px', borderRadius: '10px', overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.05)' }}>
                     <div style={{ width: `${pctFor}%`, background: 'linear-gradient(90deg, rgba(10,122,255,0.85), rgba(10,122,255,0.55))', display: 'flex', alignItems: 'center' }}>
                       <span style={{ paddingLeft: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 600, color: '#FFFFFF' }}>{pctFor}%</span>
                     </div>
                     <div style={{ width: `${pctAgainst}%`, marginLeft: 'auto', background: 'linear-gradient(90deg, rgba(255,212,100,0.5), rgba(255,212,100,0.85))', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                       <span style={{ paddingRight: '10px', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 600, color: '#1a1608' }}>{pctAgainst}%</span>
                     </div>
                   </div>
                 </div>
               );
             })()}
             <ScrollArea className="flex-1 overflow-auto px-4 pb-6" style={{ maxHeight: 'calc(85vh - 140px)' }}>
               <div>
                 {challengeResponses.map((resp) => {
                   const stanceColor = resp.stance === 'for' ? '#0A7AFF' : '#FFD464';
                   const stanceLabelColor = resp.stance === 'for' ? '#6db1ff' : '#FFD464';
                   const stanceBg = resp.stance === 'for' ? 'rgba(10,122,255,0.1)' : 'rgba(255,212,100,0.08)';
                   const stanceBorder = resp.stance === 'for' ? 'rgba(10,122,255,0.45)' : 'rgba(255,212,100,0.4)';
                   const voted = userVote?.challenge_response_id === resp.id;
                   return (
                     <div
                       key={resp.id}
                       style={{
                         borderRadius: '16px',
                         padding: '11px 13px',
                         marginBottom: '10px',
                         display: 'flex',
                         gap: '11px',
                         alignItems: 'stretch',
                         background: 'rgba(255,255,255,0.04)',
                         boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset',
                       }}
                     >
                       {/* Stance bar */}
                       <div style={{ width: '4px', borderRadius: '2px', background: stanceColor, flexShrink: 0 }} />
                       {/* Body */}
                       <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
                         <div className="flex items-center gap-2">
                           <Avatar className="w-[26px] h-[26px]">
                             <AvatarImage src={getAvatarImageUrl(resp.user.avatar_url) || undefined} />
                             <AvatarFallback className="text-[10px] bg-muted">
                               {(resp.user.full_name || resp.user.username).charAt(0).toUpperCase()}
                             </AvatarFallback>
                           </Avatar>
                           <span style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                             {resp.user.full_name || resp.user.username}
                           </span>
                           <span
                             style={{
                               fontFamily: "'JetBrains Mono', monospace",
                               fontSize: '9px', fontWeight: 700,
                               padding: '2px 8px', borderRadius: '999px',
                               textTransform: 'uppercase', letterSpacing: '0.08em',
                               color: stanceLabelColor,
                               border: `1px solid ${stanceBorder}`,
                               background: stanceBg,
                             }}
                           >
                             {resp.stance === 'for' ? 'A favore' : 'Contro'}
                           </span>
                         </div>
                         <VoicePlayer
                           compact
                           audioUrl={resp.voice_post.audio_url}
                           durationSeconds={resp.voice_post.duration_seconds}
                           waveformData={resp.voice_post.waveform_data}
                           transcript={resp.voice_post.transcript}
                           transcriptStatus={resp.voice_post.transcript_status as any}
                           accentColor={stanceColor}
                         />
                       </div>
                       {/* Argument vote column */}
                       <button
                         onClick={(e) => {
                           e.stopPropagation();
                           if (voted) removeVote();
                           else if (!userVote) voteForResponse(resp.id);
                         }}
                         disabled={!!userVote && !voted}
                         style={{
                           minWidth: '40px',
                           borderRadius: '12px',
                           background: voted ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
                           display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                           gap: '2px', padding: '6px 4px',
                           opacity: !!userVote && !voted ? 0.5 : 1,
                           cursor: !!userVote && !voted ? 'not-allowed' : 'pointer',
                         }}
                         className="active:scale-95 transition-transform"
                       >
                         <ArrowUp style={{ width: '15px', height: '15px', color: '#FFFFFF' }} />
                         <span style={{
                           fontFamily: "'JetBrains Mono', monospace",
                           fontSize: '11px', color: '#FFFFFF', fontWeight: 600,
                         }}>{resp.argument_votes}</span>
                       </button>
                     </div>
                   );
                 })}
               </div>
             </ScrollArea>
           </DrawerContent>
         </Drawer>
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
              "relative w-full mt-4 py-3.5 rounded-full font-bold text-[15px] tracking-wide overflow-hidden transition-all ",
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
