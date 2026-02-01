
# Implementazione: Extended Reactions + Optimistic UI + Layout Alignment

## Panoramica

Questo piano implementa tre miglioramenti interconnessi:
1. **Reactions Estese (Long Press)** - Menu emoji multiple per Post, Commenti e Messaggi
2. **Optimistic UI** - Feedback istantaneo per reazioni Commenti e Messaggi
3. **Allineamento Layout "Il Punto"** - Correzione posizionamento icone azioni

---

## Architettura Tecnica

### Struttura Database Esistente

Le tabelle delle reazioni sono già predisposte per tipi multipli:
- `reactions` (Post): `reaction_type TEXT` (nessun default)
- `comment_reactions`: `reaction_type TEXT DEFAULT 'heart'`
- `message_reactions`: `reaction_type TEXT DEFAULT 'like'`
- `focus_reactions`: `reaction_type TEXT` (nessun default)
- `media_reactions`: `reaction_type TEXT DEFAULT 'heart'`

Nessuna migrazione richiesta - le colonne supportano già valori multipli.

### Emoji Supportate

```typescript
const REACTIONS_PALETTE = ['heart', 'laugh', 'wow', 'sad', 'fire'] as const;
// UI: ❤️ 😂 😮 😢 🔥
```

---

## Task 1: Reactions Estese (Long Press)

### 1.1 Nuovo Hook `useLongPress.ts`

Creare un hook riutilizzabile per gestire long press cross-platform:

```typescript
// src/hooks/useLongPress.ts
interface UseLongPressOptions {
  onLongPress: () => void;
  onTap?: () => void;
  threshold?: number; // ms, default 500
}

export const useLongPress = ({ onLongPress, onTap, threshold = 500 }: UseLongPressOptions) => {
  const timerRef = useRef<NodeJS.Timeout>();
  const isLongPressRef = useRef(false);

  const handlers = {
    onTouchStart: () => {
      isLongPressRef.current = false;
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        haptics.medium();
        onLongPress();
      }, threshold);
    },
    onTouchEnd: () => {
      clearTimeout(timerRef.current);
      if (!isLongPressRef.current && onTap) {
        onTap();
      }
    },
    onTouchCancel: () => clearTimeout(timerRef.current),
    onMouseDown: /* same logic */,
    onMouseUp: /* same logic */,
    onMouseLeave: () => clearTimeout(timerRef.current),
  };

  return handlers;
};
```

### 1.2 Componente `ReactionPicker.tsx`

Creare un componente popover animato per la selezione emoji:

```typescript
// src/components/ui/reaction-picker.tsx
interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (reactionType: ReactionType) => void;
  currentReaction?: ReactionType | null;
  position?: { x: number; y: number };
}

// Design: Pill orizzontale con emoji animate (scale-in staggered)
// Stile: bg-popover/95 backdrop-blur-xl rounded-full shadow-2xl
// Animazione: data-[state=open]:animate-scale-in
```

### 1.3 Integrazione nei Componenti

#### ImmersivePostCard.tsx

```typescript
// Bottone Like con long press
const [showReactionPicker, setShowReactionPicker] = useState(false);
const [reactionPickerPosition, setReactionPickerPosition] = useState({ x: 0, y: 0 });

const likeHandlers = useLongPress({
  onLongPress: () => setShowReactionPicker(true),
  onTap: () => handleHeart(), // Like rapido (heart default)
});

// Render:
<button {...likeHandlers}>
  <Heart className={...} />
</button>
<ReactionPicker 
  isOpen={showReactionPicker}
  onSelect={(type) => toggleReaction({ postId, reactionType: type })}
  onClose={() => setShowReactionPicker(false)}
/>
```

#### CommentItem.tsx

Stessa logica applicata al bottone like dei commenti.

#### MessageBubble.tsx

- Applicare long press handler al cuore nel popover azioni
- **FIX COLORE**: Cambiare `text-destructive` (rosso) al posto del blu per il cuore selezionato
- Attuale: `isLiked && 'text-destructive'` (già corretto nel codice!)
- Verificare che il cuore nella pill sotto la bolla usi rosso: già usa `text-destructive fill-destructive`

---

## Task 2: Optimistic UI per Commenti e Messaggi

### 2.1 Refactor `useCommentReactions.ts`

Attualmente manca l'optimistic UI. Aggiungere:

```typescript
export const useToggleCommentReaction = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ commentId, isLiked, reactionType = 'heart' }) => {
      // ... existing logic
    },
    
    // ===== OPTIMISTIC UI =====
    onMutate: async ({ commentId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: ['comment-reactions', commentId] });
      
      const previous = queryClient.getQueryData<{likesCount: number, likedByMe: boolean}>(
        ['comment-reactions', commentId]
      );
      
      queryClient.setQueryData(['comment-reactions', commentId], {
        likesCount: (previous?.likesCount || 0) + (isLiked ? -1 : 1),
        likedByMe: !isLiked,
      });
      
      return { previous };
    },
    
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['comment-reactions', variables.commentId], context.previous);
      }
      haptics.warning();
      toast.error('Errore nel like al commento');
    },
    
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comment-reactions', variables.commentId] });
    },
  });
};
```

### 2.2 Verifica `useMessageReactions.ts`

Già implementa optimistic UI (righe 176-202). Nessuna modifica necessaria oltre all'estensione per emoji multiple.

---

## Task 3: Allineamento Layout "Il Punto"

### 3.1 Problema Attuale

In `ImmersiveEditorialCarousel.tsx` (riga 559-631), l'action bar è strutturata così:

```tsx
<div className="flex items-center gap-6">
  <button>Condividi</button>
  <div className="flex items-center gap-4">
    {/* Like, Comments, Bookmark */}
  </div>
</div>
```

Questo layout NON è allineato con `ImmersivePostCard.tsx` (riga 1977-2031):

```tsx
<div className="flex items-center justify-between gap-6 mr-12 sm:mr-16">
```

### 3.2 Soluzione

Modificare `ImmersiveEditorialCarousel.tsx` per usare lo stesso layout:

```tsx
// Prima (riga 559):
<div className="flex items-center gap-6">

// Dopo:
<div className="flex items-center justify-between gap-6 mr-12 sm:mr-16">
```

E modificare il wrapper delle icone (riga 577):

```tsx
// Prima:
<div className="flex items-center gap-4">

// Dopo:
<div className="flex items-center gap-4 h-11">
```

---

## Riepilogo File da Modificare

| File | Tipo | Descrizione |
|------|------|-------------|
| `src/hooks/useLongPress.ts` | Nuovo | Hook per long press cross-platform |
| `src/components/ui/reaction-picker.tsx` | Nuovo | Componente picker emoji animato |
| `src/hooks/useCommentReactions.ts` | Modifica | Aggiungere optimistic UI |
| `src/hooks/useMessageReactions.ts` | Modifica | Estendere per supportare emoji multiple |
| `src/hooks/usePosts.ts` | Modifica | Estendere per supportare emoji multiple |
| `src/components/feed/ImmersivePostCard.tsx` | Modifica | Integrare long press + reaction picker |
| `src/components/feed/ImmersiveEditorialCarousel.tsx` | Modifica | Allineare layout + long press |
| `src/components/feed/CommentItem.tsx` | Modifica | Long press + reaction picker |
| `src/components/messages/MessageBubble.tsx` | Modifica | Long press + emoji picker |

---

## Schema Visivo UI

```text
┌────────────────────────────────────────┐
│  Tap breve sul cuore                    │
│  └─> Toggle Like (heart) immediato      │
│                                          │
│  Long press (500ms) sul cuore           │
│  └─> Mostra picker:                      │
│      ┌─────────────────────────────┐    │
│      │  ❤️   😂   😮   😢   🔥     │    │
│      │  ↑                           │    │
│      │  Reazione attuale evidenziata│    │
│      └─────────────────────────────┘    │
│                                          │
│  Tap su emoji nel picker                │
│  └─> Sostituisce reazione corrente      │
│  └─> Aggiornamento ottimistico UI       │
│  └─> Haptic feedback                    │
└────────────────────────────────────────┘
```

---

## Garanzie Anti-Regressione

| Garanzia | Dettaglio |
|----------|-----------|
| Deep Linking notifiche | Nessuna modifica a `/post/:id` navigation o `scrollTo` logic |
| SessionGuard intatto | Nessuna modifica a breadcrumbs o crash detection |
| Realtime DM | Subscription in `useMessageReactions` non modificata |
| Quiz gate | Nessuna modifica a runGateBeforeAction o QuizModal |
| Colori coerenti | Rosso per cuori ovunque (feed, commenti, messaggi) |

---

## Ordine di Implementazione

1. **useLongPress.ts** - Hook base
2. **reaction-picker.tsx** - Componente UI
3. **useCommentReactions.ts** - Optimistic UI
4. **ImmersiveEditorialCarousel.tsx** - Layout fix (low risk)
5. **ImmersivePostCard.tsx** - Long press integration
6. **CommentItem.tsx** - Long press integration
7. **MessageBubble.tsx** - Long press + colore fix

---

## Test Consigliati

1. **Tap rapido Like**: Verifica toggle istantaneo senza delay percepibile
2. **Long press (500ms)**: Verifica apertura picker con haptic feedback
3. **Selezione emoji**: Verifica cambio reazione e aggiornamento UI
4. **Offline/Errore**: Verifica rollback ottimistico con toast errore
5. **Allineamento Il Punto**: Verifica icone allineate verticalmente con post standard
6. **Colore cuore messaggi**: Verifica rosso (non blu) per reazione attiva
