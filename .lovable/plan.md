
# Piano: Fix Gesture e Icona Dinamica Reazioni

## Problema Attuale

### 1. Conflitto Gesture su Mobile
Il conteggio reazioni (es. "42") può essere selezionato accidentalmente durante il long-press sul tasto Like, causando comportamenti inaspettati.

### 2. Icona Statica su Post Feed
L'icona del Like nei post del feed (`ImmersivePostCard`) mostra sempre il cuore, anche quando l'utente ha scelto una reazione diversa (😂, 🔥, ecc.). 

**Nota**: I commenti (`CommentItem`) già implementano correttamente l'icona dinamica usando `reactions?.myReactionType`.

## Analisi Tecnica

### Stato Attuale per Componente

| Componente | Icona Dinamica | myReactionType | Status |
|------------|----------------|----------------|--------|
| CommentItem | ✅ Implementata | Da useCommentReactions | OK |
| CommentsDrawer | ✅ Implementata | Da useCommentReactions | OK |
| CommentsSheet | ✅ Implementata | Da useCommentReactions | OK |
| MediaCommentsSheet | ✅ Implementata | Da useCommentReactions | OK |
| ImmersiveEditorialCarousel | ⚠️ Parziale | Stato locale (perde sync) | Da fixare |
| ImmersivePostCard | ❌ Manca | Non disponibile nel Post type | Da implementare |

### Modifiche Necessarie

Per abilitare l'icona dinamica nei Post, serve estendere il tipo `Post` e la query `usePosts` per includere `myReactionType`.

## Soluzione Proposta

### Parte 1: Fix Conflitto Gesture (CSS)

Aggiungere `select-none` e `touch-action-none` al conteggio reazioni per prevenire selezione testo accidentale.

**File: `ImmersivePostCard.tsx`**
```tsx
// Count button - clickable to open reactions drawer
<button
  className="text-sm font-bold text-white select-none hover:text-white/80 transition-colors"
  onClick={...}
>
  {post.reactions?.hearts || 0}
</button>
```

**File: `ReactionSummary.tsx`**
```tsx
<button
  className={cn(
    "text-sm text-muted-foreground select-none",
    "cursor-pointer active:opacity-70",
    className
  )}
>
  ...
</button>
```

### Parte 2: Estendere Post Type con myReactionType

**File: `src/hooks/usePosts.ts`**

1. Aggiornare l'interfaccia `Post.user_reactions`:

```typescript
user_reactions: {
  has_hearted: boolean;
  has_bookmarked: boolean;
  myReactionType?: 'heart' | 'laugh' | 'wow' | 'sad' | 'fire' | null;
}
```

2. Nella query, estrarre il tipo di reazione dell'utente corrente:

```typescript
user_reactions: {
  has_hearted: post.reactions?.some((r: any) => 
    r.reaction_type !== 'bookmark' && r.user_id === user?.id
  ) || false,
  has_bookmarked: post.reactions?.some((r: any) => 
    r.reaction_type === 'bookmark' && r.user_id === user?.id
  ) || false,
  myReactionType: post.reactions?.find((r: any) => 
    r.reaction_type !== 'bookmark' && r.user_id === user?.id
  )?.reaction_type || null
}
```

3. Aggiornare l'optimistic update per gestire `myReactionType`:

```typescript
user_reactions: {
  ...post.user_reactions,
  has_hearted: reactionType !== 'bookmark' ? !wasActive : post.user_reactions.has_hearted,
  has_bookmarked: reactionType === 'bookmark' ? !post.user_reactions.has_bookmarked : post.user_reactions.has_bookmarked,
  myReactionType: reactionType !== 'bookmark' 
    ? (wasActive ? null : reactionType) 
    : post.user_reactions.myReactionType
}
```

### Parte 3: Icona Dinamica in ImmersivePostCard

**File: `src/components/feed/ImmersivePostCard.tsx`**

Modificare la sezione Like button (riga ~2023-2027):

```tsx
{/* Like button - Show emoji if non-heart reaction, otherwise Heart icon */}
<button 
  className="flex items-center justify-center gap-1.5 h-full"
  {...likeButtonHandlers}
  onClick={(e) => e.stopPropagation()}
>
  {post.user_reactions?.myReactionType && 
   post.user_reactions.myReactionType !== 'heart' ? (
    <span className="text-xl transition-transform active:scale-90">
      {reactionToEmoji(post.user_reactions.myReactionType)}
    </span>
  ) : (
    <Heart 
      className={cn(
        "w-6 h-6 transition-transform active:scale-90", 
        post.user_reactions?.has_hearted ? "text-red-500 fill-red-500" : "text-white"
      )}
      fill={post.user_reactions?.has_hearted ? "currentColor" : "none"}
    />
  )}
</button>
```

### Parte 4: Fix Stato Persistente per Editorial

**File: `src/components/feed/ImmersiveEditorialCarousel.tsx`**

Il `currentReaction` è attualmente uno stato locale che non persiste. Per un fix completo, servirebbe estendere `useFocusReactions` come fatto per i post. Tuttavia, dato il focus su UX immediata, propongo un approccio semplificato:

Sincronizzare `currentReaction` con `reactionsData.likedByMe` quando cambia:

```tsx
// Sync currentReaction with server state
useEffect(() => {
  if (reactionsData?.likedByMe) {
    // Keep current if user selected, else default to 'heart'
    if (!currentReaction) setCurrentReaction('heart');
  } else {
    setCurrentReaction(null);
  }
}, [reactionsData?.likedByMe]);
```

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/hooks/usePosts.ts` | Aggiungere myReactionType a Post type e query |
| `src/components/feed/ImmersivePostCard.tsx` | Icona dinamica + select-none sul count |
| `src/components/feed/ImmersiveEditorialCarousel.tsx` | Sync stato locale con server |
| `src/components/feed/ReactionSummary.tsx` | Aggiungere select-none |

## Garanzie Zero-Regressione

| Sistema | Status |
|---------|--------|
| Comprehension Gate | Non toccato |
| RLS Security | Non toccata |
| Deep Linking | Non toccato |
| ReactionsSheet (drawer) | Non toccato |
| Logica Follow | Non toccata |
| Colore rosso (text-destructive) | Mantenuto per cuore attivo |

## Risultato Atteso

1. **Gesture fluide**: Nessuna selezione testo accidentale durante long-press
2. **Icona dinamica**: Se utente sceglie 🔥, il tasto mostra 🔥 invece di ❤️
3. **Aggiornamento istantaneo**: Cambio icona con Optimistic UI (~0ms latenza)
4. **Consistenza globale**: Stesso comportamento su Feed, Editorial, Commenti
