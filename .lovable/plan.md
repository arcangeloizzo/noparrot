
# Piano: Fix Definitivo Conflitti Touch e Persistenza Reazioni

## Obiettivo
Risolvere definitivamente i conflitti di tocco durante il long-press e correggere il bug per cui la reazione selezionata (es. 😂) ritorna al cuore rosso dopo pochi istanti.

## Analisi del Problema

### Bug 1: Conflitto Gesture
Elementi testuali (contatori numerici) vicini ai tasti Like possono essere selezionati durante il long-press, interferendo con l'apertura del ReactionPicker.

**File coinvolti:**
- `ImmersivePostCard.tsx` - Contatore commenti senza `select-none`
- `ImmersiveEditorialCarousel.tsx` - Contatore commenti senza `select-none`
- `CommentItem.tsx` - Area azioni senza `select-none`

### Bug 2: Persistenza Reazione (Post Feed)
La logica `wasActive` in `usePosts.ts` verifica solo se `has_hearted && reactionType === 'heart'`. Questo significa:

```typescript
// PROBLEMA: Se l'utente ha 🔥 e clicca ❤️
const wasActive = post.user_reactions.has_hearted && reactionType === 'heart';
// wasActive = true && false = FALSE  ❌ (dovrebbe gestire lo switch)
```

Quando l'utente cambia reazione (es. da 🔥 a ❤️), il sistema non rimuove prima la reazione precedente.

### Bug 3: Persistenza Reazione (Editorial)
L'hook `useFocusReactions.ts` non traccia `myReactionType`, solo `likedByMe` (boolean). Dopo il refresh, non c'è modo di sapere quale emoji era stata scelta.

---

## Soluzione Proposta

### Parte 1: Protezione Globale con `select-none`

Applicare `select-none` a tutti i contatori e aree di azione per prevenire selezione testo accidentale.

**ImmersivePostCard.tsx** (riga ~2067):
```tsx
{/* Comments - aggiungere select-none */}
<button className="flex items-center justify-center gap-1.5 h-full select-none" ...>
  <MessageCircle className="w-6 h-6 text-white" />
  <span className="text-sm font-bold text-white select-none">{post.reactions?.comments || 0}</span>
</button>
```

**ImmersiveEditorialCarousel.tsx** (riga ~693):
```tsx
{/* Comments - aggiungere select-none */}
<button className="flex items-center justify-center gap-1.5 h-full select-none" ...>
  <MessageCircle className="w-6 h-6 text-white" />
  <span className="text-sm font-bold text-white select-none">{item.reactions?.comments ?? 0}</span>
</button>
```

**CommentItem.tsx** (righe ~240-264):
```tsx
{/* Footer actions - aggiungere select-none all'intero container */}
<div className="flex items-center gap-1 select-none">
  {/* Like button */}
  <button {...likeButtonHandlers} className="... select-none">
    ...
    <span className="text-xs font-medium select-none">{reactions?.likesCount}</span>
  </button>
  {/* Reply button */}
  <button className="... select-none">...</button>
</div>
```

### Parte 2: Fix Persistenza Reazioni (Post)

Correggere la logica `wasActive` in `usePosts.ts` per gestire correttamente lo switch tra tipi di reazione.

**Problema attuale:**
```typescript
const wasActive = isBookmark 
  ? post.user_reactions.has_bookmarked 
  : post.user_reactions.has_hearted && reactionType === 'heart';
```

**Soluzione:**
```typescript
// Verifica se la reazione corrente è esattamente quella che stiamo togglando
const wasActive = isBookmark 
  ? post.user_reactions.has_bookmarked 
  : post.user_reactions.myReactionType === reactionType;
```

Inoltre, nella mutationFn, prima di aggiungere una nuova reazione non-bookmark, rimuovere eventuali reazioni esistenti dell'utente sullo stesso post:

```typescript
mutationFn: async ({ postId, reactionType }) => {
  if (!user) throw new Error('Not authenticated');

  // Per reazioni non-bookmark, gestire lo switch
  if (reactionType !== 'bookmark') {
    // Trova reazione esistente di qualsiasi tipo (escluso bookmark)
    const { data: existing } = await supabase
      .from('reactions')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .neq('reaction_type', 'bookmark')
      .maybeSingle();

    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Stesso tipo -> rimuovi (toggle off)
        await supabase.from('reactions').delete().eq('id', existing.id);
        return { action: 'removed' };
      } else {
        // Tipo diverso -> aggiorna (switch)
        await supabase.from('reactions')
          .update({ reaction_type: reactionType })
          .eq('id', existing.id);
        return { action: 'switched' };
      }
    } else {
      // Nessuna reazione -> aggiungi
      await supabase.from('reactions').insert({
        post_id: postId,
        user_id: user.id,
        reaction_type: reactionType,
      });
      return { action: 'added' };
    }
  } else {
    // Logica bookmark esistente...
  }
}
```

**Aggiornamento optimistic update:**
```typescript
onMutate: async ({ postId, reactionType }) => {
  // ...cancella query e snapshot...
  
  queryClient.setQueryData(['posts', user.id], (old: Post[] | undefined) => {
    if (!old) return old;
    return old.map(post => {
      if (post.id !== postId) return post;
      
      const isBookmark = reactionType === 'bookmark';
      const currentReaction = post.user_reactions.myReactionType;
      const isSameReaction = currentReaction === reactionType;
      
      if (isBookmark) {
        // Logica bookmark invariata
        return {
          ...post,
          user_reactions: {
            ...post.user_reactions,
            has_bookmarked: !post.user_reactions.has_bookmarked
          }
        };
      }
      
      // Calcola nuovi conteggi byType
      const newByType = { ...post.reactions.byType };
      
      if (isSameReaction) {
        // Toggle off: rimuovi la reazione corrente
        newByType[reactionType] = Math.max(0, (newByType[reactionType] || 0) - 1);
        
        return {
          ...post,
          reactions: {
            ...post.reactions,
            hearts: post.reactions.hearts - 1,
            byType: newByType,
          },
          user_reactions: {
            ...post.user_reactions,
            has_hearted: false,
            myReactionType: null
          }
        };
      } else {
        // Aggiungi o Switch
        // Se c'era una reazione precedente, rimuovi il suo count
        if (currentReaction) {
          newByType[currentReaction] = Math.max(0, (newByType[currentReaction] || 0) - 1);
        }
        // Aggiungi il count per la nuova reazione
        newByType[reactionType] = (newByType[reactionType] || 0) + 1;
        
        return {
          ...post,
          reactions: {
            ...post.reactions,
            // hearts incrementa solo se non c'era già una reazione
            hearts: currentReaction 
              ? post.reactions.hearts 
              : post.reactions.hearts + 1,
            byType: newByType,
          },
          user_reactions: {
            ...post.user_reactions,
            has_hearted: true,
            myReactionType: reactionType as 'heart' | 'laugh' | 'wow' | 'sad' | 'fire'
          }
        };
      }
    });
  });
  
  // ... resto invariato ...
}
```

### Parte 3: Fix Persistenza Reazioni (Editorial)

Estendere `useFocusReactions.ts` per tracciare `myReactionType`.

**Aggiornamento interfaccia:**
```typescript
interface FocusReactionsResult {
  likes: number;
  likedByMe: boolean;
  myReactionType: ReactionType | null; // NUOVO
}
```

**Aggiornamento query:**
```typescript
queryFn: async (): Promise<FocusReactionsResult> => {
  // ... count likes ...

  let likedByMe = false;
  let myReactionType: ReactionType | null = null;
  
  if (user) {
    const { data: userReaction } = await supabase
      .from('focus_reactions')
      .select('id, reaction_type')
      .eq('focus_id', focusId)
      .eq('focus_type', focusType)
      .eq('user_id', user.id)
      .maybeSingle();
    
    likedByMe = !!userReaction;
    myReactionType = userReaction?.reaction_type as ReactionType || null;
  }

  return { likes, likedByMe, myReactionType };
}
```

**Aggiornamento `EditorialSlideInner`:**
```typescript
// Sync con server state
useEffect(() => {
  if (reactionsData?.myReactionType) {
    setCurrentReaction(reactionsData.myReactionType);
  } else if (!reactionsData?.likedByMe) {
    setCurrentReaction(null);
  }
}, [reactionsData?.myReactionType, reactionsData?.likedByMe]);
```

---

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/hooks/usePosts.ts` | Fix logica `wasActive` e mutationFn per gestire switch reazioni |
| `src/hooks/useFocusReactions.ts` | Aggiungere `myReactionType` alla query |
| `src/components/feed/ImmersivePostCard.tsx` | `select-none` su contatore commenti |
| `src/components/feed/ImmersiveEditorialCarousel.tsx` | `select-none` su contatore commenti + sync `myReactionType` |
| `src/components/feed/CommentItem.tsx` | `select-none` su tutta l'area azioni |

---

## Garanzie Zero-Regressione

| Sistema | Status |
|---------|--------|
| Comprehension Gate | Non toccato |
| RLS Security | Non toccata |
| Deep Linking | Non toccato |
| ReactionsSheet | Non toccato |
| Colore `text-destructive` per cuore | Mantenuto |
| Logica bookmark | Invariata |

---

## Risultato Atteso

1. **Long-press fluido**: Nessuna selezione testo blu durante l'uso del ReactionPicker
2. **Persistenza corretta**: Se scelgo 🔥, rimane 🔥 anche dopo refresh
3. **Switch intelligente**: Cambio da 😂 a 🔥 aggiorna la reazione senza duplicati
4. **Cuore rosso**: Mantenuto come default per reazione heart attiva
