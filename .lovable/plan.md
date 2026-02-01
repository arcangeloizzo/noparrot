
# Fix: Sincronizzazione UI Reazioni e Navigazione Post-Quiz

## Problema 1: Incoerenza UI Like/Salva sulla rotta `/post/:id`

### Diagnosi
La pagina `Post.tsx` usa la query key `['post', postId]` per caricare un singolo post. Tuttavia, l'hook `useToggleReaction` in `usePosts.ts`:
- Aggiorna ottimisticamente solo `['posts', user.id]` e `['saved-posts', user.id]`
- Invalida solo queste due query in `onSettled`
- **Non tocca mai** `['post', postId]`

Risultato: quando l'utente clicca Like o Salva dalla pagina `/post/:id`, l'icona non si aggiorna fino al ritorno al feed.

### Soluzione
Modificare `useToggleReaction` in `src/hooks/usePosts.ts` per:
1. Aggiungere l'update ottimistico anche per la query `['post', postId]`
2. Invalidare `['post', postId]` in `onSettled`

```typescript
// In onMutate - aggiungere dopo l'update di ['posts', user.id]:
const previousPost = queryClient.getQueryData(['post', postId]);

queryClient.setQueryData(['post', postId], (old: Post | undefined) => {
  if (!old) return old;
  const wasActive = reactionType === 'heart' 
    ? old.user_reactions.has_hearted 
    : old.user_reactions.has_bookmarked;
  
  return {
    ...old,
    reactions: {
      ...old.reactions,
      hearts: reactionType === 'heart' 
        ? old.reactions.hearts + (wasActive ? -1 : 1)
        : old.reactions.hearts
    },
    user_reactions: {
      ...old.user_reactions,
      has_hearted: reactionType === 'heart' ? !wasActive : old.user_reactions.has_hearted,
      has_bookmarked: reactionType === 'bookmark' ? !wasActive : old.user_reactions.has_bookmarked
    }
  };
});

// In onError - aggiungere rollback:
if (context?.previousPost) {
  queryClient.setQueryData(['post', variables.postId], context.previousPost);
}

// In onSettled - aggiungere invalidazione:
queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
```

---

## Problema 2: Crash "Ghost Quiz" (quiz_clea) durante Reshare da `/post/:id`

### Diagnosi
Flusso attuale quando si condivide da `/post/:id`:
1. Quiz completato → `quiz_closed` breadcrumb → `setShowQuiz(false)`
2. `onQuoteShare()` chiama `navigate('/', { state: { quotePost } })`
3. Componente quiz si smonta → `quiz_cleanup_done` breadcrumb
4. `Index.tsx` monta → `checkForRecentCrash()` eseguito
5. I breadcrumbs contengono ancora eventi dalla sessione precedente
6. `hasUnmatchedOpen` = false (perché `quiz_closed` è presente), MA...
7. Il toast mostra "quiz_clea" (troncato) perché l'ultimo evento è `quiz_cleanup_done`

Il problema è che la logica attuale in `Index.tsx` richiede `hasRealProblem` per mostrare il toast:
```typescript
const hasRealProblem = hadStaleLock || hasPendingPublish;
```

Ma in questo caso:
- `hadStaleLock` = false (lo scroll lock è stato rilasciato correttamente)
- `hasPendingPublish` potrebbe essere true se il marker non è stato pulito

### Causa Root
Il marker `publish_flow_step` viene impostato durante il flusso di pubblicazione ma non viene sempre pulito correttamente quando la navigazione avviene PRIMA della pubblicazione (durante il reshare, non la pubblicazione vera).

### Soluzione
Aggiungere un marker specifico per la "navigazione legittima post-share" che segnala all'Index.tsx di ignorare i breadcrumbs del quiz:

#### 1. In `Post.tsx` - Aggiungere breadcrumb prima della navigazione:
```typescript
onQuoteShare={(quotedPost) => {
  addBreadcrumb('share_navigation_to_composer', { from: 'post_page' });
  navigate('/', { state: { quotePost: quotedPost } });
}}
```

#### 2. In `Index.tsx` - Riconoscere la navigazione legittima:
```typescript
// Aggiungi questo controllo prima di mostrare il toast:
const lastEvents = breadcrumbs.slice(-3).map(b => b.event);
const isLegitimateShareNavigation = 
  lastEvents.includes('quiz_closed') && 
  lastEvents.includes('share_navigation_to_composer');

// Only show toast if there's a high-confidence real problem
if (hasRealProblem && !isSystemEvent && !isLegitimateShareNavigation) {
  toast.info(`Sessione precedente interrotta...`);
}
```

---

## Problema 3: Navigation State Non Consumato

### Diagnosi Aggiuntiva
Il `navigate('/', { state: { quotePost } })` in `Post.tsx` passa lo stato, ma `Feed.tsx` **non legge mai** `location.state`. Questo significa che quando l'utente arriva al Feed dopo il quiz, il Composer non si apre automaticamente.

### Soluzione
Modificare `Feed.tsx` per leggere e consumare la navigation state:

```typescript
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";

// In Feed component:
const location = useLocation();

// Effect per gestire navigation state da /post/:id
useEffect(() => {
  if (location.state?.quotePost) {
    setQuotedPost(location.state.quotePost);
    setShowComposer(true);
    // Clear state to prevent re-triggering on refresh
    navigate(location.pathname, { replace: true, state: {} });
  }
}, [location.state, navigate, location.pathname]);
```

---

## Riepilogo Modifiche

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/hooks/usePosts.ts` | Modifica | Aggiungere update ottimistico e invalidazione per `['post', postId]` |
| `src/pages/Post.tsx` | Modifica | Aggiungere breadcrumb `share_navigation_to_composer` prima di navigate |
| `src/pages/Index.tsx` | Modifica | Riconoscere navigazione legittima post-share e non mostrare toast |
| `src/pages/Feed.tsx` | Modifica | Leggere e consumare `location.state.quotePost` per aprire il Composer |

---

## Garanzie Anti-Regressione

| Garanzia | Dettaglio |
|----------|-----------|
| CommentsDrawer intatto | Nessuna modifica ai breadcrumbs già aggiunti nel fix precedente |
| SessionGuard intatto | Nessuna modifica alle logiche di autenticazione |
| Quiz validation intatto | Nessuna modifica alla validazione semantica dei quiz |
| Breadcrumb count corretto | `quiz_closed` + `quiz_cleanup_done` + `share_navigation` = 3 close events, open count = 1, no false positive |

---

## Test Consigliati

1. **Like/Save da Notifica**: Vai su un post da notifica, clicca Like → l'icona deve aggiornarsi immediatamente
2. **Like/Save da Saved**: Vai su un post salvato, rimuovi il salvataggio → l'icona deve aggiornarsi
3. **Reshare da /post/:id**: Condividi un post con fonte, completa il quiz → il Composer deve aprirsi senza toast di errore
4. **Reshare senza fonte**: Condividi un post senza fonte da /post/:id → il Composer deve aprirsi direttamente
5. **Annulla quiz**: Annulla un quiz durante la condivisione → nessun toast di errore al ritorno al feed
