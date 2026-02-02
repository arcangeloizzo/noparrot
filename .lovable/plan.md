
# Unificazione Visiva Reazioni Commenti - Il Punto

## Problema Identificato

L'icona like nei commenti non cambia quando si seleziona un'emoji diversa dal cuore. Il problema è limitato ai **commenti sui Focus editoriali** ("Il Punto") perché:

1. L'hook `useFocusCommentReactions.ts` non restituisce `myReactionType`
2. L'hook non supporta le reazioni estese nella mutation
3. Il componente `CommentWithReplies` in `FocusDetailSheet.tsx` mostra sempre e solo il cuore

## Stato Attuale

| Componente | myReactionType | Switch Icon | ReactionPicker |
|------------|----------------|-------------|----------------|
| `CommentItem.tsx` (standalone) | ✅ Corretto | ✅ Funziona | ✅ Presente |
| `CommentsDrawer.tsx` (inline CommentItem) | ✅ Corretto | ✅ Funziona | ✅ Presente |
| `FocusDetailSheet.tsx` (CommentWithReplies) | ❌ Mancante | ❌ Solo Heart | ❌ Mancante |
| `useFocusCommentReactions.ts` | ❌ Non restituisce | - | - |

## Soluzione

### 1. Fix Hook `useFocusCommentReactions.ts`

Allineare completamente all'implementazione di `useCommentReactions.ts`:

- Aggiungere `myReactionType` al return del query
- Aggiungere `byType` per i conteggi per tipo
- Supportare `reactionType` nella mutation
- Implementare Optimistic UI con rollback

### 2. Fix Componente `CommentWithReplies` in `FocusDetailSheet.tsx`

Aggiornare il componente per:
- Importare `ReactionPicker`, `useLongPress`, `reactionToEmoji`
- Implementare lo switch dinamico dell'icona (emoji vs Heart)
- Aggiungere il `ReactionPicker` con long-press
- Passare `reactionType` alla mutation

---

## Sezione Tecnica

### File da Modificare

| File | Modifiche |
|------|-----------|
| `src/hooks/useFocusCommentReactions.ts` | Allineamento completo a `useCommentReactions.ts` |
| `src/components/feed/FocusDetailSheet.tsx` | Switch icona + ReactionPicker in `CommentWithReplies` |

### Fix 1: useFocusCommentReactions.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { haptics } from '@/lib/haptics';
import type { ReactionType } from '@/components/ui/reaction-picker';

interface FocusCommentReactionData {
  likesCount: number;
  likedByMe: boolean;
  myReactionType?: ReactionType | null;
  byType: Record<ReactionType, number>;
}

export const useFocusCommentReactions = (focusCommentId: string) => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['focus-comment-reactions', focusCommentId],
    queryFn: async (): Promise<FocusCommentReactionData> => {
      const { data, error } = await supabase
        .from('focus_comment_reactions')
        .select('*')
        .eq('focus_comment_id', focusCommentId);
      
      if (error) throw error;
      
      const likesCount = data?.length || 0;
      const myReaction = data?.find(r => r.user_id === user?.id);
      const likedByMe = !!myReaction;
      
      // Aggregate reactions by type
      const byType: Record<ReactionType, number> = {} as Record<ReactionType, number>;
      data?.forEach(r => {
        const type = r.reaction_type as ReactionType;
        byType[type] = (byType[type] || 0) + 1;
      });
      
      return { 
        likesCount, 
        likedByMe,
        myReactionType: myReaction?.reaction_type as ReactionType | undefined,
        byType
      };
    },
    enabled: !!focusCommentId
  });
};

export const useToggleFocusCommentReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      focusCommentId, 
      isLiked,
      reactionType = 'heart'
    }: { 
      focusCommentId: string; 
      isLiked: boolean;
      reactionType?: ReactionType;
    }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (isLiked) {
        const { error } = await supabase
          .from('focus_comment_reactions')
          .delete()
          .eq('focus_comment_id', focusCommentId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('focus_comment_reactions')
          .insert({
            focus_comment_id: focusCommentId,
            user_id: user.id,
            reaction_type: reactionType
          });
        
        if (error) throw error;
      }
    },
    
    // Optimistic UI
    onMutate: async ({ focusCommentId, isLiked, reactionType = 'heart' }) => {
      await queryClient.cancelQueries({ queryKey: ['focus-comment-reactions', focusCommentId] });
      
      const previous = queryClient.getQueryData<FocusCommentReactionData>(
        ['focus-comment-reactions', focusCommentId]
      );
      
      const newByType = { ...(previous?.byType || {}) } as Record<ReactionType, number>;
      if (isLiked) {
        const prevType = previous?.myReactionType || 'heart';
        if (newByType[prevType]) {
          newByType[prevType] = Math.max(0, newByType[prevType] - 1);
        }
      } else {
        newByType[reactionType] = (newByType[reactionType] || 0) + 1;
      }
      
      queryClient.setQueryData<FocusCommentReactionData>(['focus-comment-reactions', focusCommentId], {
        likesCount: (previous?.likesCount || 0) + (isLiked ? -1 : 1),
        likedByMe: !isLiked,
        myReactionType: isLiked ? null : reactionType,
        byType: newByType,
      });
      
      return { previous };
    },
    
    onError: (_err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['focus-comment-reactions', variables.focusCommentId], context.previous);
      }
      haptics.warning();
      toast.error('Errore nel like al commento');
    },
    
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['focus-comment-reactions', variables.focusCommentId] });
    }
  });
};
```

### Fix 2: FocusDetailSheet.tsx (CommentWithReplies)

Aggiungere imports:
```typescript
import { useLongPress } from '@/hooks/useLongPress';
import { ReactionPicker, type ReactionType, reactionToEmoji } from '@/components/ui/reaction-picker';
import { useRef, useState } from 'react';
```

Aggiornare `CommentWithReplies`:
```typescript
const CommentWithReplies = ({ ... }) => {
  const { data: reactionData } = useFocusCommentReactions(comment.id);
  const toggleReaction = useToggleFocusCommentReaction();
  const { user } = useAuth();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const likeButtonRef = useRef<HTMLButtonElement>(null);

  const handleLike = (reactionType: ReactionType = 'heart') => {
    if (!user) {
      sonnerToast.error('Devi effettuare il login');
      return;
    }
    toggleReaction.mutate({ 
      focusCommentId: comment.id, 
      isLiked: reactionData?.likedByMe || false,
      reactionType
    });
    haptics.light();
  };

  const likeHandlers = useLongPress({
    onLongPress: () => setShowReactionPicker(true),
    onTap: () => handleLike('heart'),
  });

  // ... rest of component

  // In the Actions section:
  <div className="flex items-center gap-4 mt-2 action-bar-zone">
    <div className="relative">
      <button 
        ref={likeButtonRef}
        {...likeHandlers}
        className="flex items-center gap-1 text-xs ... select-none"
        style={{ WebkitTapHighlightColor: 'transparent', WebkitUserSelect: 'none' }}
      >
        {reactionData?.myReactionType && reactionData.myReactionType !== 'heart' ? (
          <span className="text-base">{reactionToEmoji(reactionData.myReactionType)}</span>
        ) : (
          <Heart 
            className={cn(
              "w-3.5 h-3.5",
              reactionData?.likedByMe ? "text-red-500 fill-red-500" : ""
            )} 
          />
        )}
        <span>{reactionData?.likesCount || 0}</span>
      </button>
      <ReactionPicker
        isOpen={showReactionPicker}
        onClose={() => setShowReactionPicker(false)}
        onSelect={(type) => {
          handleLike(type);
          setShowReactionPicker(false);
        }}
        currentReaction={reactionData?.myReactionType}
        triggerRef={likeButtonRef}
      />
    </div>
    // ... other buttons
  </div>
};
```

---

## Flussi Impattati

| Flusso | Impatto |
|--------|---------|
| Feed Principale | Già funzionante (usa `CommentItem.tsx`) |
| Il Punto (Carousel) | **Fix in corso** (usa `FocusDetailSheet.tsx`) |
| Il Punto (Detail Sheet) | **Fix in corso** (usa `FocusDetailSheet.tsx`) |
| Notifiche | Già funzionante (usa `CommentItem.tsx`) |
| Post Salvati | Già funzionante (usa `CommentItem.tsx`) |

## Risultato Atteso

1. Le emoji selezionate sui commenti Focus si salvano correttamente
2. L'icona cambia dinamicamente (🔥, 😂, etc.) invece di tornare al cuore
3. Il long-press apre il ReactionPicker anche nei commenti Focus
4. Optimistic UI per feedback istantaneo

## Safe Guard

- Il colore `text-destructive` per il cuore attivo viene mantenuto
- Il Comprehension Gate non viene toccato
- Il badge "letto" rimane invariato
- Il posizionamento Portal del picker rimane quello stabilizzato
