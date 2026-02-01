
# Piano: Extended Reactions e Colore Rosso per Commenti

## Situazione Attuale

L'analisi del codice rivela che le Extended Reactions sono state implementate **solo parzialmente** per i commenti:

| Componente | Long Press | Picker | Colore Rosso | Summary |
|------------|------------|--------|--------------|---------|
| `CommentItem.tsx` | ✅ | ✅ | ⚠️ usa `text-red-400` | ❌ |
| `CommentsSheet.tsx` | ❌ | ❌ | ✅ `text-destructive` | ❌ |
| `CommentsDrawer.tsx` | ❌ | ❌ | ❌ usa `fill-primary` | ❌ |
| `PostCommentsView.tsx` | ❌ | ❌ | ✅ `text-destructive` | ❌ |
| `MediaCommentsSheet.tsx` | ❌ | ❌ | ⚠️ usa `text-red-500` | ❌ |

---

## Architettura Soluzione

### 1. Hook `useCommentReactions.ts` - Estensione con `byType`

Modifiche:
- Aggiungere campo `byType: Record<ReactionType, number>` alla risposta
- Aggregare le reazioni per tipo nel `queryFn`
- Aggiornare l'Optimistic UI per gestire `byType`

```typescript
interface CommentReactionData {
  likesCount: number;
  likedByMe: boolean;
  myReactionType?: ReactionType | null;
  byType: Record<ReactionType, number>; // NUOVO
}
```

### 2. Standardizzazione Colori

Tutti i cuori attivi devono usare:
```typescript
className={cn(
  "w-4 h-4 transition-all",
  reactions?.likedByMe && "text-destructive fill-destructive"
)}
```

### 3. Aggiornamento Componenti Commenti

Per ogni `CommentItem` in tutti i file:

1. **Importare**: `useLongPress`, `ReactionPicker`, `reactionToEmoji`, `ReactionSummary`
2. **Aggiungere stato**: `showReactionPicker`
3. **Configurare long press**: Sul bottone Like con threshold 500ms
4. **Modificare handleLike**: Accettare `reactionType` come parametro
5. **Visualizzare emoji dinamica**: Se `myReactionType !== 'heart'`
6. **Aggiungere ReactionSummary**: Sotto il testo del commento quando ci sono reazioni multiple

---

## File da Modificare

### `src/hooks/useCommentReactions.ts`

```typescript
// Estendere interface
interface CommentReactionData {
  likesCount: number;
  likedByMe: boolean;
  myReactionType?: ReactionType | null;
  byType: Record<ReactionType, number>;
}

// Nel queryFn, aggregare per tipo:
const byType: Record<ReactionType, number> = {};
data?.forEach(r => {
  const type = r.reaction_type as ReactionType;
  byType[type] = (byType[type] || 0) + 1;
});

// Nell'onMutate, aggiornare anche byType
```

### `src/components/feed/CommentItem.tsx`

- Già ha `useLongPress` e `ReactionPicker`
- Correggere colore: `text-red-400` → `text-destructive fill-destructive`
- Aggiungere `ReactionSummary` sotto il testo

### `src/components/feed/CommentsSheet.tsx`

```typescript
// Aggiungere imports
import { useLongPress } from '@/hooks/useLongPress';
import { ReactionPicker, reactionToEmoji, type ReactionType } from '@/components/ui/reaction-picker';
import { ReactionSummary, getReactionCounts } from '@/components/feed/ReactionSummary';

// Nel CommentItem:
const [showReactionPicker, setShowReactionPicker] = useState(false);

const likeHandlers = useLongPress({
  onLongPress: () => setShowReactionPicker(true),
  onTap: () => handleLike('heart'),
});

const handleLike = (reactionType: ReactionType = 'heart') => {
  toggleReaction.mutate({
    commentId: comment.id,
    isLiked: reactions?.likedByMe || false,
    reactionType
  });
};

// Render Like con emoji dinamica
<div className="relative">
  <button {...likeHandlers}>
    {reactions?.myReactionType && reactions.myReactionType !== 'heart' ? (
      <span className="text-base">{reactionToEmoji(reactions.myReactionType)}</span>
    ) : (
      <Heart className={cn(
        "w-4 h-4",
        reactions?.likedByMe && "text-destructive fill-destructive"
      )} />
    )}
  </button>
  <ReactionPicker ... />
</div>

// Sotto il contenuto, aggiungere ReactionSummary
{reactions?.likesCount > 1 && Object.keys(reactions.byType || {}).length > 1 && (
  <ReactionSummary
    reactions={getReactionCounts(reactions.byType)}
    totalCount={reactions.likesCount}
    showCount={false}
  />
)}
```

### `src/components/feed/CommentsDrawer.tsx`

- Stesso pattern di `CommentsSheet.tsx`
- Correggere colore: `fill-primary text-primary` → `text-destructive fill-destructive`

### `src/components/feed/PostCommentsView.tsx`

- Stesso pattern
- Colore già corretto (`text-destructive`)

### `src/components/media/MediaCommentsSheet.tsx`

- Stesso pattern
- Correggere colore: `text-red-500 fill-red-500` → `text-destructive fill-destructive`

---

## Dettaglio Modifiche per Componente

### CommentItem.tsx (linee 228-261)

```typescript
// Correggere classe colore (linea 235)
reactions?.likedByMe && "text-destructive fill-destructive"

// Dopo linea 212 (dopo MentionText), aggiungere ReactionSummary:
{reactions && reactions.likesCount > 0 && 
 Object.keys(reactions.byType || {}).length > 1 && (
  <div className="mt-1 mb-2">
    <ReactionSummary
      reactions={getReactionCounts(reactions.byType)}
      totalCount={reactions.likesCount}
      showCount={false}
      className="text-xs"
    />
  </div>
)}
```

### CommentsSheet.tsx (linee 651-746)

- Aggiungere import useState
- Aggiungere imports per useLongPress, ReactionPicker, ReactionSummary
- Aggiungere stato `showReactionPicker`
- Creare `likeHandlers` con useLongPress
- Modificare `handleLike` per accettare `reactionType`
- Rendere bottone con emoji dinamica + picker
- Aggiungere ReactionSummary sotto il contenuto

### CommentsDrawer.tsx (linee 920-1010)

- Stesso pattern di CommentsSheet
- Correggere colore da `fill-primary` a `text-destructive fill-destructive`

### PostCommentsView.tsx (linee 264-376)

- Stesso pattern
- Colore già corretto

### MediaCommentsSheet.tsx (linee 177-259)

- Stesso pattern
- Correggere colore da `text-red-500` a `text-destructive`

---

## Garanzie Anti-Regressione

| Garanzia | Dettaglio |
|----------|-----------|
| Reply threading | Non toccare `parent_id`, `level`, o logica di nesting |
| Cognitive metrics | Non modificare `passed_gate` o analytics tracking |
| Double tap | Non presente sui commenti (solo long press per picker) |
| Deep linking | `id={comment-${comment.id}}` invariato |
| Delete flow | `onDelete` callback invariato |

---

## Ordine di Implementazione

1. **useCommentReactions.ts** - Aggiungere `byType` e aggiornare optimistic update
2. **CommentItem.tsx** - Correggere colore + aggiungere ReactionSummary
3. **CommentsSheet.tsx** - Aggiungere long press + picker + summary
4. **CommentsDrawer.tsx** - Aggiungere long press + picker + summary + fix colore
5. **PostCommentsView.tsx** - Aggiungere long press + picker + summary
6. **MediaCommentsSheet.tsx** - Aggiungere long press + picker + summary + fix colore

---

## Test Consigliati

1. Long press sul cuore di un commento → deve apparire il picker
2. Selezionare 🔥 → l'icona deve cambiare da cuore a 🔥
3. Tap singolo → deve aggiungere/rimuovere reazione heart
4. Commento con reazioni multiple → deve mostrare ReactionSummary
5. Colore cuore attivo → deve essere rosso NoParrot (`text-destructive`)
6. Reply funziona ancora → nessuna regressione
7. Delete funziona ancora → nessuna regressione
