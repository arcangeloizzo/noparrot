// src/components/feed/CommentMetricsBar.tsx
import { PostWithAuthor } from '@/integrations/supabase/types'
import { Button } from '../ui/button'
import { MessageCircle, Repeat2, Heart, Share2 } from 'lucide-react'
import { formatKilo } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useComprehensionGate } from '@/lib/comprehension-gate'
import { haptics } from '@/lib/haptics'

// 1. MODIFICA: Aggiungiamo 'onShareClick' qui
interface CommentMetricsBarProps {
  post: PostWithAuthor
  onCommentClick?: () => void
  onQuoteClick?: () => void
  onLikeClick?: () => void
  onShareClick: () => void // <-- AGGIUNTA QUESTA RIGA
}

export const CommentMetricsBar: React.FC<CommentMetricsBarProps> = ({
  post,
  onCommentClick,
  onQuoteClick,
  onLikeClick,
  onShareClick, // <-- AGGIUNTA QUESTA RIGA
}) => {
  const { user } = useAuth()
  const { runGate } = useComprehensionGate()

  const handleComment = async () => {
    if (!user) return
    haptics.selection()
    await runGate(post, onCommentClick)
  }

  const handleQuote = () => {
    if (!user) return
    haptics.selection()
    onQuoteClick?.()
  }

  const handleLike = () => {
    if (!user) return
    haptics.light()
    onLikeClick?.()
  }

  // 2. MODIFICA: Questa funzione ora usa 'onShareClick'
  // Non avvia più il gate da sola.
  const handleShare = () => {
    if (!user) return
    haptics.selection()
    onShareClick() // <-- MODIFICATA QUESTA RIGA
  }

  return (
    <div className="flex items-center justify-between w-full mt-2 -ml-2">
      <Button
        variant="ghost"
        size="icon"
        className="flex items-center gap-1 text-muted-foreground"
        onClick={handleComment}
      >
        <MessageCircle className="h-4 w-4" />
        <span className="text-xs">{formatKilo(post.comments_count || 0)}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="flex items-center gap-1 text-muted-foreground"
        onClick={handleQuote}
      >
        <Repeat2 className="h-4 w-4" />
        <span className="text-xs">{formatKilo(post.quotes_count || 0)}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="flex items-center gap-1 text-muted-foreground"
        onClick={handleLike}
      >
        <Heart className="h-4 w-4" />
        <span className="text-xs">{formatKilo(post.likes_count || 0)}</span>
      </Button>
      
      {/* 3. MODIFICA: Il click ora chiama 'handleShare' */}
      <Button
        variant="ghost"
        size="icon"
        className="flex items-center gap-1 text-muted-foreground"
        onClick={handleShare} // <-- Assicurati che chiami 'handleShare'
      >
        <Share2 className="h-4 w-4" />
      </Button>
    </div>
  )
}