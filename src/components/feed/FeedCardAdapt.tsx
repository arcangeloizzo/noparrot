// src/components/feed/FeedCardAdapt.tsx
import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Heart,
  MessageCircle,
  Bookmark,
  MoreHorizontal,
  EyeOff,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '@/integrations/supabase/client'
import { PostWithAuthor, PostWithAuthorAndQuotedPost } from '@/lib/types'

// UI Components
import { TrustBadge } from '@/components/ui/trust-badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { QuizModal } from '@/components/ui/quiz-modal'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo' 
import { Card } from '@/components/ui/card' 

// Feed Components
import { PostTestActionsModal } from './PostTestActionsModal'
import { QuotedPostCard } from './QuotedPostCard'
import { PostHeader } from './PostHeader'
import { MentionText } from './MentionText'
import { SimilarContentOverlay } from './SimilarContentOverlay'

// Media Components
import { MediaGallery } from '@/components/media/MediaGallery'
import { MediaViewer } from '@/components/media/MediaViewer'

// Composer Components
import { SourceReaderGate } from '../composer/SourceReaderGate'

// --- MODIFICA 1: Importiamo i nuovi componenti ---
import { ShareSheet } from '@/components/share/ShareSheet'
import { NewMessageSheet } from '@/components/messages/NewMessageSheet'
import { CommentsSheet } from './CommentsSheet'
import { ComposerModal } from '../composer/ComposerModal'
import { ComprehensionTest } from './ComprehensionTest' 

// Hooks & Utils
import { useToggleReaction } from '@/hooks/usePosts'

import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { cn, getDisplayUsername, formatKilo } from '@/lib/utils' // Importiamo formatKilo da qui
import { fetchTrustScore } from '@/lib/comprehension-gate'
import { shouldRequireGate } from '@/lib/shouldRequireGate'
import { generateQA, fetchArticlePreview } from '@/lib/ai-helpers'
import { uniqueSources } from '@/lib/url'
import { haptics } from '@/lib/haptics'

// Tipi
type Post = PostWithAuthorAndQuotedPost
interface FeedCardProps {
  post: Post
  onRemove?: (postId: string) => void
  onQuoteShare?: (post: Post) => void
  isExpanded?: boolean
  isCommentDisabled?: boolean
}

const getHostnameFromUrl = (url: string | undefined): string => {
  if (!url) return 'Fonte'
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`
    return new URL(urlWithProtocol).hostname
  } catch {
    return 'Fonte'
  }
}

// --- MODIFICA 3: Rinominato in 'FeedCard' ---
export const FeedCard: React.FC<FeedCardProps> = ({
  post,
  onRemove,
  onQuoteShare,
  isExpanded = false,
  isCommentDisabled = false,
}) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(
    null,
  )

  // Stati per i modal
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false)
  const [isTestActionsModalOpen, setIsTestActionsModalOpen] = useState(false)
  const [isSimilarContentModalOpen, setIsSimilarContentModalOpen] =
    useState(false)

  // --- MODIFICA 4: Stati per il flusso di condivisione ---
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false)
  const [isNewMessageSheetOpen, setIsNewMessageSheetOpen] = useState(false)
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false)
  const [pendingShareAction, setPendingShareAction] = useState<
    'quote' | 'dm' | null
  >(null)
  // --- Fine Modifica 4 ---

  // Article preview state
  const [articlePreview, setArticlePreview] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Gate states
  const [showReader, setShowReader] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [readerSource, setReaderSource] = useState<any>(null)
  const [quizData, setQuizData] = useState<any>(null)

  // Trust Score state
  const [trustScore, setTrustScore] = useState<{
    band: 'BASSO' | 'MEDIO' | 'ALTO'
    score: number
    reasons?: string[]
  } | null>(null)
  const [loadingTrustScore, setLoadingTrustScore] = useState(false)

  const toggleReaction = useToggleReaction()

  // Controllo se l'utente ha messo 'mi piace' o 'salvato'
  const userHasLiked = useMemo(() => {
    return post.user_reactions?.has_hearted || false
  }, [post.user_reactions])

  const userHasBookmarked = useMemo(() => {
    return post.user_reactions?.has_bookmarked || false
  }, [post.user_reactions])

  // Fetch article preview
  useEffect(() => {
    const loadArticlePreview = async () => {
      if (!post.shared_url) {
        setArticlePreview(null)
        return
      }
      setLoadingPreview(true)
      try {
        const preview = await fetchArticlePreview(post.shared_url)
        if (preview) {
          setArticlePreview(preview)
        }
      } catch (error) {
        console.error('Error fetching article preview:', error)
      } finally {
        setLoadingPreview(false)
      }
    }
    loadArticlePreview()
  }, [post.shared_url])

  // Fetch trust score
  useEffect(() => {
    const loadTrustScore = async () => {
      if (!post.shared_url) {
        setTrustScore(null)
        return
      }
      setLoadingTrustScore(true)
      try {
        const result = await fetchTrustScore({
          postText: post.content,
          sources: [post.shared_url],
        })
        if (result) {
          setTrustScore({
            band: result.band,
            score: result.score,
            reasons: result.reasons,
          })
        }
      } catch (error) {
        console.error('Error fetching trust score:', error)
      } finally {
        setLoadingTrustScore(false)
      }
    }
    loadTrustScore()
  }, [post.shared_url, post.content])

  // --- MODIFICA 6: CORREZIONE LOGICA 'handleLike' e 'handleBookmark' ---
  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    haptics.light()
    // Usiamo la funzione corretta
    toggleReaction.mutate({ postId: post.id, reactionType: 'heart' })
  }

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    haptics.selection()
    // Usiamo la funzione corretta
    toggleReaction.mutate({ postId: post.id, reactionType: 'bookmark' })
  }
  // --- FINE MODIFICA 6 ---

  // Handler per i commenti (corretto, senza quiz)
  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCommentDisabled) return
    haptics.selection()
    if (isExpanded) {
    } else {
      setIsCommentsOpen(true) 
    }
  }

  // Handler per la "Quota" (la 4° icona nel tuo screenshot)
  const handleQuoteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    haptics.selection()
    setIsQuoteModalOpen(true) 
  }

  // Handler per il menu "Altro"
  const handleHide = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptics.warning()
    toast.success('Post nascosto')
    onRemove?.(post.id)
  }

  const handleReport = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptics.error()
    toast.success('Post segnalato')
  }

  // --- MODIFICA 7: INIZIO NUOVA LOGICA DI CONDIVISIONE ---

  // Chiamato dal click sull'icona del LOGO (Icona 3)
  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      toast.error('Accedi per condividere')
      return
    }
    haptics.selection()
    setIsShareSheetOpen(true) 
  }

  // Chiamato da ShareSheet -> "Quota sul feed"
  const handleShareToFeed = () => {
    setIsShareSheetOpen(false) 
    if (post.source_url && shouldRequireGate(post.source_url)) {
      setPendingShareAction('quote') 
      setIsQuizModalOpen(true) 
    } else {
      setIsQuoteModalOpen(true)
    }
  }

  // Chiamato da ShareSheet -> "Invia a un amico"
  const handleShareWithFriend = () => {
    setIsShareSheetOpen(false) 
    if (post.source_url && shouldRequireGate(post.source_url)) {
      setPendingShareAction('dm') 
      setIsQuizModalOpen(true) 
    } else {
      setIsNewMessageSheetOpen(true)
    }
  }

  // Chiamato da ComprehensionTest quando l'utente SUPERA il quiz
  const handleQuizSuccess = () => {
    setIsQuizModalOpen(false)
    
    if (pendingShareAction === 'quote') {
      setIsQuoteModalOpen(true)
    } else if (pendingShareAction === 'dm') {
      setIsNewMessageSheetOpen(true)
    }
    
    setPendingShareAction(null) 
  }

  // Chiamato se l'utente chiude il quiz senza superarlo
  const handleQuizClose = () => {
    setIsQuizModalOpen(false)
    setPendingShareAction(null) 
  }

  // --- FINE NUOVA LOGICA DI CONDIVISIONE ---

  
  // (La tua logica originale per 'startComprehensionGate'...)
  const startComprehensionGate = async () => {
     if (!post.shared_url || !user) return;
     // ...
     setReaderSource({
       url: post.shared_url,
       // ... (il resto della tua logica 'setReaderSource')
     })
     setShowReader(true)
  }
  
  // (La tua logica originale per 'handleReaderComplete'...)
  const handleReaderComplete = async () => {
     setShowReader(false)
     // ...
     const result = await generateQA({ /* ... */ })
     // ...
     setQuizData({ /* ... */ })
     setShowQuiz(true)
  }

  // (La tua logica originale per 'handleQuizSubmit'...)
  const handleQuizSubmit = async (answers: Record<string, string>) => {
     // ...
     // Questa logica gestisce il VECCHIO quiz
     // ...
     return { passed: false, score: 0, total: 0, wrongIndexes: [] }
  }


  // Navigazione
  const openPost = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isExpanded) return
    const target = e.target as HTMLElement
    if (target.tagName === 'A' || target.closest('a')) {
      return
    }
    haptics.selection()
    navigate(`/post/${post.id}`)
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: it,
  })

  // Deduplicazione fonti
  const displaySources = uniqueSources(post.sources || [])

  // Contenuto Avatar
  const getAvatarContent = () => {
    if (post.author.avatar_url) {
      return (
        <img
          src={post.author.avatar_url}
          alt={post.author.full_name || post.author.username}
          className="w-full h-full object-cover"
        />
      )
    }
    const initial = (post.author.full_name || post.author.username)
      .charAt(0)
      .toUpperCase()
    const bgColors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-yellow-500',
    ]
    const colorIndex = post.author.id.charCodeAt(0) % bgColors.length
    return (
      <div
        className={`${bgColors[colorIndex]} w-full h-full flex items-center justify-center text-white font-bold text-lg`}
      >
        {initial}
      </div>
    )
  }

  return (
    <>
      <Card
        className={cn(
          'w-full p-4 rounded-none border-b',
          !isExpanded && 'cursor-pointer',
        )}
        onClick={openPost}
      >
        <div className="flex gap-3">
          {/* Avatar a sinistra */}
          <div
            className="flex-shrink-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/profile/${post.author.id}`)
            }}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
              {getAvatarContent()}
            </div>
          </div>

          {/* Content a destra */}
          <div className="flex-1 min-w-0">
            {/* Header SENZA avatar */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/profile/${post.author.id}`)
                }}
              >
                <PostHeader
                  displayName={
                    post.author.full_name ||
                    getDisplayUsername(post.author.username)
                  }
                  username={getDisplayUsername(post.author.username)}
                  timestamp={timeAgo}
                  label={
                    post.stance === 'Condiviso'
                      ? 'Condiviso'
                      : post.stance === 'Confutato'
                      ? 'Confutato'
                      : undefined
                  }
                  avatarUrl={null}
                />
              </div>

              {/* Actions Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="p-1.5 rounded-full text-muted-foreground -mr-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleHide}>
                    <EyeOff className="w-4 h-4 mr-2" />
                    Nascondi post
                  </DropdownMenuItem>
                  {/* Altre opzioni... */}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Contenuto Post */}
            {post.content && (
              <div className="mb-2 text-foreground text-[15px] leading-snug whitespace-pre-wrap break-words">
                <MentionText text={post.content} />
              </div>
            )}

            {/* Media Gallery */}
            {post.media && post.media.length > 0 && (
              <MediaGallery
                media={post.media}
                onClick={(media, index) => {
                  setSelectedMediaIndex(index)
                }}
              />
            )}

            {/* Quoted Post */}
            {post.quoted_post && (
              <QuotedPostCard
                post={post.quoted_post as PostWithAuthor}
                className="mt-2"
              />
            )}

            {/* Article Preview Card */}
            {post.source_url && (
              <a
                href={post.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 mt-2 border rounded-2xl overflow-hidden hover:bg-muted/30 transition-all cursor-pointer group block"
                onClick={(e) => e.stopPropagation()}
              >
                {(articlePreview?.image || post.preview_img) && !loadingPreview && (
                   <div className="aspect-video w-full overflow-hidden bg-muted">
                     <img 
                       src={articlePreview?.image || post.preview_img}
                       alt={articlePreview?.title || post.shared_title || ''}
                       className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                     />
                   </div>
                )}
                <div className="p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>{getHostnameFromUrl(post.source_url)}</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="font-semibold text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                    {articlePreview?.title || post.shared_title || 'Post condiviso'}
                  </div>
                </div>

              </a>
            )}

            {/* Trust Badge */}
            {trustScore && post.source_url && (
              <div
                className="mb-3 flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <TrustBadge
                  band={trustScore.band}
                  score={trustScore.score}
                  reasons={trustScore.reasons}
                  size="sm"
                />
              </div>
            )}

            {/* --- MODIFICA 8: Barra delle icone --- */}
            <div className="flex items-center justify-between w-full mt-2 -ml-2">
              
              {/* Icona 1: MI PIACE (Cuore) */}
              <Button
                variant="ghost"
                size="icon"
                className="flex items-center gap-1 text-muted-foreground"
                onClick={handleLike}
              >
                <Heart 
                  className={cn(
                    "h-4 w-4 transition-all",
                    userHasLiked && "fill-primary stroke-primary"
                  )}
                />
                <span className="text-xs">{formatKilo(post.likes_count || 0)}</span>
              </Button>

              {/* Icona 2: COMMENTI (Fumetto) - SENZA QUIZ */}
              <Button
                variant="ghost"
                size="icon"
                className="flex items-center gap-1 text-muted-foreground"
                onClick={handleCommentClick}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="text-xs">{formatKilo(post.comments_count || 0)}</span>
              </Button>

              {/* Icona 3: CONDIVISIONE (Logo App) */}
              <Button
                variant="ghost"
                size="icon"
                className="flex items-center gap-1 text-muted-foreground"
                onClick={handleShareClick} // <-- Collega il nuovo flusso
              >
                <Logo className="h-4 w-4" /> 
                <span className="text-xs">{formatKilo(post.quotes_count || 0)}</span>
              </Button>
              
              {/* Icona 4: SALVA (Bookmark) */}
              <Button
                variant="ghost"
                size="icon"
                className="flex items-center gap-1 text-muted-foreground"
                onClick={handleBookmark} 
              >
                <Bookmark 
                  className={cn(
                    "h-4 w-4 transition-all",
                    userHasBookmarked && "fill-primary stroke-primary"
                  )}
                />
              </Button>
            </div>
            {/* --- Fine Modifica 8 --- */}

          </div>
        </div>
      </Card>

      {/* --- MODIFICA 9: Assicurati che tutti i modal siano qui --- */}

      {/* Sheet e Modal esistenti */}
      <CommentsSheet
        post={post}
        open={isCommentsOpen}
        onOpenChange={setIsCommentsOpen}
      />
      
      <ComposerModal
        open={isQuoteModalOpen}
        onOpenChange={setIsQuoteModalOpen}
        quotedPost={post}
      />

      {/* I modal per il test (li gestisci già) */}
      {showReader && readerSource && createPortal(
        <SourceReaderGate
          source={readerSource}
          isOpen={showReader}
          onClose={() => {
            setShowReader(false)
            setReaderSource(null)
            // NON resettare il pendingShareAction qui
          }}
          onComplete={handleReaderComplete} 
        />,
        document.body,
      )}

      {showQuiz && quizData && createPortal(
        <QuizModal
          questions={quizData.questions}
          onSubmit={handleQuizSubmit} 
          onCancel={() => {
            setShowQuiz(false)
            setQuizData(null)
            // NON resettare il pendingShareAction qui
          }}
        />,
        document.body,
      )}

      {/* Modal e Media Viewer esistenti... */}
      {isTestActionsModalOpen && (
        <PostTestActionsModal
          post={post}
          open={isTestActionsModalOpen}
          onOpenChange={setIsTestActionsModalOpen}
          onTriggerSimilarContent={() => setIsSimilarContentModalOpen(true)}
        />
      )}
      {isSimilarContentModalOpen && (
        <SimilarContentOverlay
          post={post}
          open={isSimilarContentModalOpen}
          onOpenChange={setIsSimilarContentModalOpen}
        />
      )}
      {selectedMediaIndex !== null && post.media && createPortal(
        <MediaViewer
          media={post.media}
          initialIndex={selectedMediaIndex}
          onClose={() => setSelectedMediaIndex(null)}
        />,
        document.body,
      )}

      {/* --- MODIFICA 10: Aggiungiamo i nuovi Sheet --- */}
      
      <ShareSheet
        open={isShareSheetOpen}
        onOpenChange={setIsShareSheetOpen}
        onShareToFeed={handleShareToFeed}
        onShareWithFriend={handleShareWithFriend}
      />

      <NewMessageSheet
        open={isNewMessageSheetOpen}
        onOpenChange={setIsNewMessageSheetOpen}
        prefilledMessage={`Guarda questo post: ${post.source_url || post.content.slice(0, 50)}...`}
      />

      {/* --- MODIFICA 11: Aggiungiamo il NUOVO quiz modal --- */}
      {isQuizModalOpen && (
        <ComprehensionTest
          post={post} // Passa l'intero post
          open={isQuizModalOpen}
          onOpenChange={handleQuizClose} // Se l'utente chiude il modal
          onTestPassed={handleQuizSuccess} // Se supera il test
        />
      )}

    </>
  )
}