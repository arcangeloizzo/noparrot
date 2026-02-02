
# Fix Persistenza Reazioni Estese nei Commenti

## Problema Identificato

Dopo una dettagliata analisi del flusso di codice, il **problema principale** è che quando l'utente seleziona un'emoji dal ReactionPicker, la mutation viene chiamata correttamente ma il **valore `reactions` letto nel `handleLike` potrebbe essere stale o non sincronizzato**.

Analisi del flow:
1. L'utente fa long-press → `setShowReactionPicker(true)` 
2. L'utente clicca un'emoji (es. 🔥) → `onSelect(type)` viene chiamato con `type = 'fire'`
3. `handleLike('fire')` viene eseguito
4. Dentro `handleLike`, legge `reactions?.likedByMe` e `reactions?.myReactionType` 
5. **PROBLEMA**: questi valori potrebbero essere `undefined` se la query non è ancora terminata o se c'è un problema di re-render

Il secondo problema identificato:

**CommentsDrawer.tsx (linea 9) importa ancora `useToggleCommentReaction`** anche se non lo usa più, e questo è codice morto. Ma più importante, nella stessa zona del codice **potrebbero esserci altre istanze non aggiornate**.

Inoltre, ho notato che **la mutation non ha log di debug**, rendendo difficile capire se viene effettivamente chiamata.

---

## Soluzione

### 1. Aggiungere Log di Debug Temporanei
Aggiungere console.log nel `handleLike` per tracciare esattamente cosa viene passato alla mutation.

### 2. Fix Robusto del `handleLike`
Modificare `handleLike` in `CommentItem.tsx` per:
- Aggiungere logging
- Gestire correttamente il caso in cui `reactions` è `undefined`
- Assicurarsi che il `reactionType` arrivi correttamente alla mutation

### 3. Pulizia Import Inutilizzati
Rimuovere `useToggleCommentReaction` da `CommentsDrawer.tsx` e `CommentsSheet.tsx` (codice morto).

---

## Sezione Tecnica

### File: `src/components/feed/CommentItem.tsx`

Modifica della funzione `handleLike`:

```typescript
const handleLike = (reactionType: ReactionType = 'heart') => {
  // DEBUG: Log dettagliato per tracciare il flusso
  console.log('[CommentItem] handleLike called:', {
    commentId: comment.id,
    commentKind,
    reactionType,
    currentReactions: reactions,
    likedByMe: reactions?.likedByMe,
    myReactionType: reactions?.myReactionType,
    userId: user?.id
  });

  if (!user) {
    toast.error('Devi effettuare il login');
    return;
  }
  
  setIsLiking(true);
  haptics.light();
  
  // Calculate correct mode - gestisci undefined in modo robusto
  const liked = reactions?.likedByMe ?? false;
  const prevType = (reactions?.myReactionType || 'heart') as ReactionType;
  
  let mode: 'add' | 'remove' | 'update';
  if (!liked) {
    mode = 'add';
  } else if (prevType === reactionType) {
    mode = 'remove';
  } else {
    mode = 'update';
  }
  
  console.log('[CommentItem] Mutation params:', { mode, reactionType, commentKind });
  
  // Use correct mutation based on commentKind
  if (commentKind === 'media') {
    toggleMediaReaction.mutate(
      { mediaCommentId: comment.id, mode, reactionType },
      {
        onSuccess: () => console.log('[CommentItem] Media reaction success'),
        onError: (err) => console.error('[CommentItem] Media reaction error:', err)
      }
    );
  } else if (commentKind === 'focus') {
    toggleFocusReaction.mutate(
      { focusCommentId: comment.id, mode, reactionType },
      {
        onSuccess: () => console.log('[CommentItem] Focus reaction success'),
        onError: (err) => console.error('[CommentItem] Focus reaction error:', err)
      }
    );
  } else {
    togglePostReaction.mutate(
      { commentId: comment.id, mode, reactionType },
      {
        onSuccess: () => console.log('[CommentItem] Post reaction success'),
        onError: (err) => console.error('[CommentItem] Post reaction error:', err)
      }
    );
  }
  
  setTimeout(() => setIsLiking(false), 250);
};
```

### File: `src/components/feed/CommentsDrawer.tsx`

Rimuovere import inutilizzato:
```diff
- import { useCommentReactions, useToggleCommentReaction } from '@/hooks/useCommentReactions';
+ import { useCommentReactions } from '@/hooks/useCommentReactions';
```

### File: `src/components/feed/CommentsSheet.tsx`

Rimuovere import inutilizzato:
```diff
- import { useCommentReactions, useToggleCommentReaction } from '@/hooks/useCommentReactions';
+ import { useCommentReactions } from '@/hooks/useCommentReactions';
```

---

## Risultato Atteso

1. ✅ Console logs dettagliati per diagnosticare esattamente dove si interrompe il flusso
2. ✅ Reazione estesa (🔥 😂 😮 😢) salvata correttamente nel database
3. ✅ UI si aggiorna immediatamente (Optimistic UI già implementata)
4. ✅ Nessuna regressione sui flussi esistenti

---

## Note

I log di debug saranno utili per identificare se:
- La mutation viene effettivamente chiamata
- Il `reactionType` arriva corretto (es. 'fire' invece di 'heart')
- Ci sono errori durante la mutation

Una volta confermato che funziona, i log potranno essere rimossi o ridotti.
