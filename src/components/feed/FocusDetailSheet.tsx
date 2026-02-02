import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, X, Bookmark, Layers, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusReactions, useToggleFocusReaction } from "@/hooks/useFocusReactions";
import { useFocusBookmark, useToggleFocusBookmark } from "@/hooks/useFocusBookmarks";
import { useFocusComments } from "@/hooks/useFocusComments";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { SourcesDrawer } from "./SourcesDrawer";
import { ReactionsSheet } from "./ReactionsSheet";
import { QuizModal } from "@/components/ui/quiz-modal";
import { toast as sonnerToast } from "sonner";
import { haptics } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/ui/logo";
import { FocusDetailSkeleton, SourcesSkeleton } from "./skeletons";

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
          className="h-[85vh] bg-[#0E141A] border-white/10 flex flex-col"
          hideClose={true}
        >
          {/* Header fisso con badge e X allineati orizzontalmente */}
          <div className="shrink-0 bg-[#0E141A] pt-4 pb-3 border-b border-white/10">
            <div className="flex items-center justify-between">
              <Badge className="bg-[#0A7AFF] text-white font-semibold px-3 py-1 border-0 font-mono">
                ◉ IL PUNTO
              </Badge>
              
              {/* X custom più grande e cliccabile */}
              <button 
                onClick={() => onOpenChange(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                aria-label="Chiudi"
              >
                <X className="w-6 h-6 text-white/70" />
              </button>
            </div>
          </div>

          {/* Contenuto scrollabile */}
          <div className="flex-1 min-h-0 overflow-y-auto pb-20 force-scrollbar">
            <h2 className="text-white text-2xl font-bold text-left leading-tight mt-4 pb-4 border-b border-white/10">
              {title}
            </h2>
          
            <div className="py-6 space-y-6">
              {/* Deep Content - show skeleton if not loaded */}
              {!deepContent ? (
                <FocusDetailSkeleton />
              ) : (
                <div>
                  <h4 className="text-gray-400 text-sm font-semibold mb-3">Approfondimento</h4>
                  <p className="text-gray-200 text-base leading-relaxed whitespace-pre-wrap">
                    {renderCleanContent(deepContent)}
                  </p>
                </div>
              )}
              
              {/* Sources Section - show skeleton if sources not loaded */}
              {sources.length === 0 ? (
                <SourcesSkeleton />
              ) : (
                <div className="py-4 border-t border-white/10">
                  <h4 className="text-sm font-semibold text-white/70 mb-3">
                    Fonti consultate per questa sintesi
                  </h4>
                  <button
                    onClick={() => setSourcesDrawerOpen(true)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="w-5 h-5 text-[#0A7AFF]" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">
                          Vedi le {sources.length} fonti
                        </p>
                        <p className="text-xs text-white/50">
                          L'analisi incrocia contenuti da più testate
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/30" />
                  </button>
                </div>
              )}
            
              {/* Action Bar */}
              <div className="py-4 flex items-center justify-between gap-3 border-y border-white/10">
                {/* Primary Share Button */}
                <button 
                  onClick={handleShareFromDrawer}
                  disabled={isProcessing}
                  className="h-10 px-4 bg-white hover:bg-gray-50 text-[#1F3347] font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <Logo variant="icon" size="sm" className="h-4 w-4" />
                  <span className="text-sm font-semibold">
                    {isProcessing ? 'Caricamento...' : 'Condividi'}
                  </span>
                </button>

                {/* Reactions Bar */}
                <div className="flex items-center gap-1 bg-white/5 backdrop-blur-xl h-10 px-3 rounded-2xl border border-white/10">
                  {/* Like */}
                  <button 
                    onClick={() => {
                      if (!user) {
                        sonnerToast.error('Devi effettuare il login per mettere like');
                        return;
                      }
                      toggleReaction.mutate({ focusId, focusType: type });
                      haptics.light();
                    }}
                    className="flex items-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <Heart
                      className={cn(
                        "w-5 h-5 transition-all",
                        reactionsData?.likedByMe ? "text-red-500 fill-red-500" : "text-white"
                      )} 
                    />
                  </button>
                  {/* Like Counter - tappable to open reactions sheet */}
                  <button
                    onClick={() => setReactionsSheetOpen(true)}
                    className="text-xs font-bold text-white px-1 hover:underline"
                  >
                    {reactionsData?.likes || reactions.likes || 0}
                  </button>

                  {/* Comments - now delegates to parent via onComment */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onComment?.();
                    }}
                    className="flex items-center gap-1.5 h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5 text-white" />
                    <span className="text-xs font-bold text-white">{comments.length}</span>
                  </button>

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
                    className="flex items-center h-full px-2 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    <Bookmark 
                      className={cn(
                        "w-5 h-5 transition-all",
                        isBookmarked ? "text-primary fill-primary" : "text-white"
                      )} 
                    />
                  </button>
                </div>
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
