import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, X, Bookmark, Layers, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusReactions, useToggleFocusReaction } from "@/hooks/useFocusReactions";
import { useFocusBookmark, useToggleFocusBookmark } from "@/hooks/useFocusBookmarks";
import { useFocusComments } from "@/hooks/useFocusComments";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useRef } from "react";
import { SourcesDrawer } from "./SourcesDrawer";
import { ReactionsSheet } from "./ReactionsSheet";
import { QuizModal } from "@/components/ui/quiz-modal";
import { toast as sonnerToast } from "sonner";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/ui/logo";
import { FocusDetailSkeleton, SourcesSkeleton } from "./skeletons";
import { useLongPress } from "@/hooks/useLongPress";
import { ReactionPicker, reactionToEmoji, type ReactionType } from "@/components/ui/reaction-picker";

interface Source {
  icon: string;
  name: string;
  url?: string;
}

interface FocusDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type?: 'daily';
  category?: string;
  title: string;
  deepContent?: string;
  sources: Source[];
  imageUrl?: string;
  focusId: string;
  editorialNumber?: number;
  reactions: { likes: number; comments: number; shares: number };
  userReactions?: { hasLiked: boolean };
  onLike?: () => void;
  onShare?: () => void;
  onComment?: () => void; // NEW: callback to open external CommentsDrawer
}

// Render deep_content as clean continuous text WITHOUT [SOURCE:N] markers
const renderCleanContent = (content: string): string => {
  return content.replace(/\[SOURCE:[\d,\s]+\]/g, '').trim();
};

export const FocusDetailSheet = ({
  open,
  onOpenChange,
  type = 'daily',
  category,
  title,
  deepContent,
  sources,
  imageUrl,
  focusId,
  editorialNumber,
  reactions,
  userReactions,
  onLike,
  onShare,
  onComment,
}: FocusDetailSheetProps) => {
  const { user } = useAuth();
  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [reactionsSheetOpen, setReactionsSheetOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizData, setQuizData] = useState<{ qaId?: string; questions: any[]; sourceUrl: string; forShare?: boolean; error?: boolean; errorMessage?: string } | null>(null);
  
  // Hook for comment count (read-only, for display)
  const { data: comments = [] } = useFocusComments(focusId, type);
  
  // Hook per le reazioni
  const { data: reactionsData } = useFocusReactions(focusId, type);
  const toggleReaction = useToggleFocusReaction();
  
  // Hook per il bookmark
  const { data: isBookmarked } = useFocusBookmark(focusId, type);
  const toggleBookmark = useToggleFocusBookmark();
  
  // Long press for reaction picker with drag-to-select
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const likeButtonRef = useRef<HTMLButtonElement>(null);
  
  const likeHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => {
      if (!user) {
        sonnerToast.error('Devi effettuare il login per mettere like');
        return;
      }
      toggleReaction.mutate({ focusId, focusType: type });
      haptics.light();
    },
    onMove: (x, y) => setDragPosition({ x, y }),
    onRelease: () => setDragPosition(null),
  });

  // Skip reader - genera quiz direttamente dal drawer (utente ha già letto)
  const handleShareFromDrawer = async () => {
    if (!deepContent) {
      onShare?.();
      return;
    }
    
    if (!user) {
      sonnerToast.error('Devi effettuare il login per condividere');
      return;
    }
    
    setIsProcessing(true);
    sonnerToast.info('Generando il quiz di comprensione...');
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-qa', {
        body: {
          title: title,
          summary: deepContent,
          sourceUrl: `editorial://${focusId}`,
          testMode: 'USER_ONLY',
          isPrePublish: true,
        }
      });

      if (error || !data?.questions?.length) {
        console.error('[FocusDetailSheet] Quiz generation error:', error);
        sonnerToast.error('Errore nella generazione del quiz');
        setIsProcessing(false);
        return;
      }

      setQuizData({
        qaId: data.qaId,
        questions: data.questions,
        sourceUrl: `editorial://${focusId}`,
        forShare: true,
      });
      setShowQuiz(true);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('[FocusDetailSheet] Error:', error);
      sonnerToast.error('Errore nella verifica');
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} modal={!showQuiz}>
        <SheetContent 
          side="bottom" 
          className="h-[85vh] bg-background border-border flex flex-col"
          hideClose={true}
        >
          {/* Header fisso con badge e X allineati orizzontalmente */}
          <div className="shrink-0 bg-background/95 backdrop-blur-md pt-4 pb-3 px-5 border-b border-border sticky top-0 z-50">
            <div className="flex items-center justify-between">
              <Badge className="bg-[#0A7AFF] hover:bg-[#0A7AFF] text-white font-bold px-3 py-1.5 border-0 font-mono tracking-widest text-[11px] shadow-sm">
                ◉ IL PUNTO
              </Badge>
              
              {/* X custom più grande e cliccabile */}
              <button 
                onClick={() => onOpenChange(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted transition-colors active:scale-95"
                aria-label="Chiudi"
              >
                <X className="w-5 h-5 text-foreground/80" />
              </button>
            </div>
          </div>

          {/* Contenuto scrollabile */}
          <div className="flex-1 min-h-0 overflow-y-auto w-full force-scrollbar">
            <h2 
              style={{
                fontFamily: 'Impact, sans-serif',
                fontSize: '28px',
                lineHeight: 1.05,
                color: '#FFFFFF',
                letterSpacing: '-0.01em'
              }}
              className="mt-6 pb-6 border-b border-border drop-shadow-sm px-5"
            >
              {title}
            </h2>
          
            <div className="py-6 space-y-8 px-5">
              {/* Deep Content - show skeleton if not loaded */}
              {!deepContent ? (
                <FocusDetailSkeleton />
              ) : (
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-px bg-border flex-1" />
                    <h4 
                      style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#0A7AFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                      className="font-bold shrink-0"
                    >
                      Approfondimento
                    </h4>
                    <div className="h-px bg-border flex-1" />
                  </div>
                  <div 
                    style={{ fontSize: '16px', lineHeight: 1.7, color: '#E2EAF4' }}
                    className="space-y-5"
                  >
                    {renderCleanContent(deepContent).split('\n').map((paragraph, idx) => (
                      paragraph.trim() ? <p key={idx}>{paragraph}</p> : null
                    ))}
                  </div>
                </div>
              )}
              
              {/* Sources Section - show skeleton if sources not loaded */}
              {sources.length === 0 ? (
                <SourcesSkeleton />
              ) : (
                <div className="pt-8 border-t border-border">
                  <h4 
                    style={{ fontFamily: 'JetBrains Mono', fontSize: '10px', color: '#0A7AFF', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                    className="font-bold mb-4"
                  >
                    Fonti consultate ({sources.length})
                  </h4>
                  <div 
                    className="mb-8 pointer-events-auto flex flex-col"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}
                  >
                    {sources.map((source: any, idx: number, arr: any[]) => {
                      const colors = ['#0A7AFF', '#E41E52', '#FFD464', '#10B981', '#A78BFA'];
                      const barColor = colors[idx % colors.length];
                      const domainName = (source.name || new URL(source.url || 'https://link').hostname).replace('www.', '');
                      const headline = source.title || source.headline || source.description;
                      
                      return (
                        <button 
                          key={idx}
                          onClick={(e) => {
                             e.stopPropagation();
                             if (source.url) window.open(source.url, '_blank', 'noopener,noreferrer');
                          }}
                          className="w-full flex items-center group hover:bg-white/5 transition-all outline-none"
                          style={{ 
                            borderBottom: idx !== arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            padding: '12px'
                          }}
                        >
                          <div className="flex items-center min-w-0 flex-1">
                            <div style={{ width: '3px', height: '24px', borderRadius: '2px', backgroundColor: barColor, flexShrink: 0 }} />
                            <div className="flex flex-col items-start px-3 min-w-0 flex-1">
                              <span style={{ fontFamily: 'JetBrains Mono', fontSize: '9px', color: '#7A8FA6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {domainName}
                              </span>
                              {headline && (
                                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#E2EAF4', width: '100%', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                                  {headline}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ color: '#7A8FA6', fontSize: '12px', flexShrink: 0 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            
              {/* AI Disclaimer */}
              <div className="bg-purple-500/5 border border-purple-500/10 rounded-2xl p-5 mb-6">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-500/10 p-2 rounded-full shrink-0">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    <p className="text-sm font-bold text-purple-900 dark:text-purple-300 tracking-wide uppercase">Sintesi Algoritmica</p>
                    <p className="text-[13px] text-purple-800/80 dark:text-purple-300/80 leading-relaxed">
                      Questo contenuto è stato generato automaticamente analizzando e incrociando le fonti citate. Non è un articolo redazionale. Ti invitiamo sempre a verificare le fonti originali per approfondire.
                    </p>
                  </div>
                </div>
              </div>
            
            </div>
          </div>
          
          {/* Action Bar Background Layer */}
          <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-4 pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between gap-3">
              {/* Primary Share Button */}
              <button 
                onClick={handleShareFromDrawer}
                disabled={isProcessing}
                className="h-11 px-5 bg-foreground hover:bg-foreground/90 text-background font-bold rounded-full shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 flex-1"
              >
                <Logo variant="icon" size="sm" className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  {isProcessing ? 'Caricamento...' : 'Condividi post'}
                </span>
              </button>

              {/* Reactions Bar */}
              <div className="flex items-center gap-1.5 bg-muted/50 h-11 px-3.5 rounded-full border border-border/50 shadow-sm shrink-0">
                {/* Like with long press for reaction picker */}
                <div className="relative flex items-center">
                  <button 
                    ref={likeButtonRef}
                    {...likeHandlers}
                    className="flex items-center gap-1.5 h-full px-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors select-none"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {reactionsData?.myReactionType && reactionsData.myReactionType !== 'heart' ? (
                      <span className="text-lg transition-all">
                        {reactionToEmoji(reactionsData.myReactionType as ReactionType)}
                      </span>
                    ) : (
                      <Heart
                        className={cn(
                          "w-5 h-5 transition-all",
                          reactionsData?.likedByMe ? "text-red-500 fill-red-500" : "text-foreground"
                        )} 
                      />
                    )}
                  </button>
                  
                  <ReactionPicker
                    isOpen={showReactionPicker}
                    onClose={() => setShowReactionPicker(false)}
                    onSelect={(reactionType) => {
                      if (!user) {
                        sonnerToast.error('Devi effettuare il login per mettere like');
                        return;
                      }
                      toggleReaction.mutate({ focusId, focusType: type, reactionType });
                      setShowReactionPicker(false);
                    }}
                    currentReaction={reactionsData?.myReactionType as ReactionType | undefined}
                    triggerRef={likeButtonRef}
                    dragPosition={dragPosition}
                    onDragRelease={() => setDragPosition(null)}
                  />
                </div>
                {/* Like Counter - tappable to open reactions sheet */}
                <button
                  onClick={() => setReactionsSheetOpen(true)}
                  className="text-xs font-bold text-foreground px-1 hover:underline"
                >
                  {reactionsData?.likes || reactions.likes || 0}
                </button>

                <div className="w-px h-4 bg-border mx-1" />

                {/* Comments - now delegates to parent via onComment */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onComment?.();
                  }}
                  className="flex items-center gap-1.5 h-full px-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-foreground" />
                  <span className="text-xs font-bold text-foreground">{comments.length}</span>
                </button>

                <div className="w-px h-4 bg-border mx-1" />

                {/* Bookmark */}
                <button
                  onClick={() => {
                    if (!user) {
                      sonnerToast.error('Devi effettuare il login per salvare');
                      return;
                    }
                    toggleBookmark.mutate({ focusId, focusType: type });
                    haptics.light();
                  }}
                  className="flex items-center h-full px-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <Bookmark 
                    className={cn(
                      "w-5 h-5 transition-all",
                      isBookmarked ? "text-primary fill-primary" : "text-foreground"
                    )} 
                  />
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sources Drawer */}
      {/* Reactions Sheet - Who reacted */}
      <ReactionsSheet
        isOpen={reactionsSheetOpen}
        onClose={() => setReactionsSheetOpen(false)}
        focusId={focusId}
        focusType={type}
      />

      <SourcesDrawer
        open={sourcesDrawerOpen}
        onOpenChange={setSourcesDrawerOpen}
        sources={sources.map((s, i) => ({
          icon: s.icon || '📰',
          name: s.name || `Fonte ${i + 1}`,
          url: s.url || '',
          title: s.name || '',
          description: '',
        }))}
      />

      {/* Quiz Modal for share gate */}
      {showQuiz && quizData && (
        <QuizModal
          questions={quizData.questions}
          qaId={quizData.qaId}
          onSubmit={async (answers) => {
            const qaId = quizData.qaId;
            const sourceUrl = quizData.sourceUrl;
            const gateType = 'share';
            
            try {
              const { data, error } = await supabase.functions.invoke('submit-qa', {
                body: {
                  qaId,
                  postId: null,
                  sourceUrl: sourceUrl,
                  answers,
                  gateType
                }
              });

              if (error) {
                console.error('[FocusDetailSheet] Validation error:', error);
                return { passed: false, score: 0, total: quizData.questions.length, wrongIndexes: [] };
              }

              const passed = data?.passed || false;
              const score = data?.score || 0;
              const wrongIndexes = data?.wrongIndexes || [];
              
              return { passed, score, total: quizData.questions.length, wrongIndexes };
            } catch (err) {
              console.error('[FocusDetailSheet] Unexpected error:', err);
              return { passed: false, score: 0, total: quizData.questions.length, wrongIndexes: [] };
            }
          }}
          onCancel={() => {
            setShowQuiz(false);
            setQuizData(null);
            setIsProcessing(false);
          }}
          onComplete={(passed) => {
            setShowQuiz(false);
            setQuizData(null);
            
            if (passed) {
              // Share flow completed
              onShare?.();
            }
            setIsProcessing(false);
          }}
        />
      )}
    </>
  );
};
