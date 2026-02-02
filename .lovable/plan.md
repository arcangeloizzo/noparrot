`. Procedo con la presentazione formale del piano di implementazione:

<lov-plan>
# Unificazione CommentItem per Reazioni Estese

## Obiettivo
Far funzionare le reazioni estese (🔥 😂 😮 😢 ❤️) su **tutti** i commenti, sia nei post normali che ne "Il Punto", con:
- Switch visivo istantaneo dell'icona
- Persistenza corretta nel database
- Nessun toast di errore

---

## Problema Attuale

Nel file `CommentItem.tsx`, la funzione `handleLike` **perde** il `reactionType`:

```typescript
const handleLike = (reactionType: ReactionType = 'heart') => {
  // ...
  onLike(comment.id, reactions?.likedByMe || false);  // ❌ reactionType non viene passato!
};
```

Inoltre, per "Il Punto", il `CommentsDrawer` usa `useToggleCommentReaction` (tabella `comment_reactions`) invece di `useToggleFocusCommentReaction` (tabella `focus_comment_reactions`), causando errori RLS.

---

## Soluzione

Rendere `CommentItem` **autonomo** per le reazioni:

1. Aggiungere prop `commentKind: 'post' | 'focus'`
2. Usare internamente gli hook corretti in base al kind
3. Gestire la logica `mode: add/remove/update` internamente
4. Rimuovere la dipendenza dalla callback `onLike` del parent

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/feed/CommentItem.tsx` | Refactor completo: hook condizionali + logica interna |
| `src/components/feed/CommentsDrawer.tsx` | Passare `commentKind`, rimuovere `onLike` |
| `src/components/feed/CommentsSheet.tsx` | Rimuovere `onLike` |
| `src/components/feed/PostCommentsView.tsx` | Rimuovere `onLike` |
| `src/components/media/MediaCommentsSheet.tsx` | Rimuovere `onLike` |

---

## Sezione Tecnica

### 1. CommentItem.tsx - Modifiche

**Nuovi import:**
```typescript
import { useCommentReactions, useToggleCommentReaction } from '@/hooks/useCommentReactions';
import { useFocusCommentReactions, useToggleFocusCommentReaction } from '@/hooks/useFocusCommentReactions';
import { useAuth } from '@/contexts/AuthContext';
```

**Props aggiornate:**
```typescript
interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onReply: () => void;
  onDelete: () => void;  // ✅ onLike RIMOSSO
  isHighlighted?: boolean;
  postHasSource?: boolean;
  onMediaClick?: (media: any[], index: number) => void;
  getUserAvatar?: (...) => React.ReactNode;
  commentKind?: 'post' | 'focus';  // ✅ NUOVO
}
```

**Hook condizionali:**
```typescript
const { user } = useAuth();

// Usa gli hook corretti in base al kind
const postReactions = useCommentReactions(commentKind === 'post' ? comment.id : '');
const focusReactions = useFocusCommentReactions(commentKind === 'focus' ? comment.id : '');
const reactions = commentKind === 'focus' ? focusReactions.data : postReactions.data;

const togglePostReaction = useToggleCommentReaction();
const toggleFocusReaction = useToggleFocusCommentReaction();
```

**handleLike corretto:**
```typescript
const handleLike = (reactionType: ReactionType = 'heart') => {
  if (!user) {
    toast.error('Devi effettuare il login');
    return;
  }
  
  setIsLiking(true);
  haptics.light();
  
  // Calcola il mode corretto
  const liked = reactions?.likedByMe || false;
  const prevType = (reactions?.myReactionType ?? 'heart') as ReactionType;
  const mode: 'add' | 'remove' | 'update' = !liked ? 'add' : prevType === reactionType ? 'remove' : 'update';
  
  // Usa la mutation corretta
  if (commentKind === 'focus') {
    toggleFocusReaction.mutate({ focusCommentId: comment.id, mode, reactionType });
  } else {
    togglePostReaction.mutate({ commentId: comment.id, mode, reactionType });
  }
  
  setTimeout(() => setIsLiking(false), 250);
};
```

### 2. CommentsDrawer.tsx - Modifiche

```diff
- import { useCommentReactions, useToggleCommentReaction } from '@/hooks/useCommentReactions';
+ import { useCommentReactions } from '@/hooks/useCommentReactions';

// Nel componente, rimuovere:
- const toggleReaction = useToggleCommentReaction();

// Nel mapping dei commenti:
<CommentItem
  key={comment.id}
  comment={comment}
  currentUserId={user?.id}
  onReply={() => {...}}
- onLike={(commentId, mode, reactionType) => {
-   toggleReaction.mutate({ commentId, mode, reactionType });
- }}
  onDelete={() => {...}}
+ commentKind={isFocusContent ? 'focus' : 'post'}
  ...
/>
```

### 3. CommentsSheet.tsx, PostCommentsView.tsx, MediaCommentsSheet.tsx

Stessa modifica: rimuovere prop `onLike` e aggiungere `commentKind="post"` (default).

---

## Risultato Atteso

1. ✅ Le emoji selezionate (🔥 😂 😮 😢) rimangono visibili invece di tornare ❤️
2. ✅ "Il Punto" usa la tabella corretta `focus_comment_reactions`
3. ✅ Nessun toast "Errore nel like al commento" per Focus content
4. ✅ Optimistic UI funziona correttamente in tutti i contesti
5. ✅ Il cuore rosso (`text-destructive`) rimane per le reazioni heart

---

## Safe Guard

- Non tocchiamo il Comprehension Gate
- Non tocchiamo il badge "lettore consapevole" (lampadina)
- Il posizionamento Portal del picker rimane invariato
- Il colore `text-destructive` per il cuore rimane

---

## Prossimi Passi (dopo questo fix)

1. **Counter commenti ne "Il Punto"** - Il contatore non si aggiorna nella preview
2. **Click icona commento nel dettaglio** - Apre il flusso gate invece del drawer commenti

Questi verranno affrontati in un'operazione separata per evitare rollback complessi.
